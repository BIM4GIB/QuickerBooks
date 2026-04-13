#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { buildAuthUrl, startOAuthCallbackServer } from "./auth/oauth.js";
import { loadCredentials, CONFIG_DIR, CREDS_FILE } from "./auth/credentials.js";

const command = process.argv[2];

if (command === "auth") {
  await runAuth();
} else if (command === "setup") {
  await runSetup();
} else {
  console.log("mcp-quickbooks — MCP server for QuickBooks Online");
  console.log("");
  console.log("Commands:");
  console.log("  setup   Full guided setup (recommended for first time)");
  console.log("  auth    Just run the OAuth flow (needs env vars set)");
  console.log("");
  console.log("Quick start:");
  console.log("  node ~/.mcp-quickbooks/cli.mjs setup");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// setup — interactive wizard
// ---------------------------------------------------------------------------

async function runSetup(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  console.log("=== QuickBooks MCP Server — Setup Wizard ===");
  console.log("");

  // Step 1 — Check if they already have credentials
  const hasCredentials = (await rl.question("Do you already have a Client ID and Client Secret? [y/N]: ")).trim().toLowerCase() === "y";

  if (!hasCredentials) {
    console.log("");
    console.log("No problem! Here's how to get them (takes ~3 minutes):");
    console.log("");
    console.log("  1. Go to: https://developer.intuit.com");
    console.log("  2. Sign in with your QuickBooks account (same login you use for QBO)");
    console.log("  3. Click 'Dashboard' then 'Create an app'");
    console.log("  4. Choose 'QuickBooks Online and Payments'");
    console.log("  5. Give it any name (e.g. 'Claude QuickBooks')");
    console.log("  6. In the app settings, go to 'Keys & credentials'");
    console.log("  7. Under 'Redirect URIs', add: http://localhost:9876/callback");
    console.log("  8. Copy the 'Client ID' and 'Client Secret'");
    console.log("");
    console.log("Tip: Start with the 'Development' (sandbox) keys to test safely.");
    console.log("You can switch to 'Production' keys later when you're ready.");
    console.log("");
    await rl.question("Press Enter when you have your Client ID and Client Secret...");
  }

  // Step 2 — Choose mode: sandbox (safe) or production
  console.log("");
  console.log("How would you like to start?");
  console.log("");
  console.log("  1. Sandbox (recommended) — uses fake test data, nothing touches");
  console.log("     your real books. Perfect for trying things out safely.");
  console.log("");
  console.log("  2. Production — connects to your real QuickBooks account.");
  console.log("");
  const modeChoice = (await rl.question("Choose [1] or 2: ")).trim();
  const useSandbox = modeChoice !== "2";

  if (useSandbox) {
    console.log("");
    console.log("Great — sandbox mode. This uses Intuit's test environment with");
    console.log("fake companies and data. Nothing you do here affects real books.");
  } else {
    console.log("");
    console.log("Production mode — this will connect to your real QuickBooks data.");
  }
  console.log("");

  // Step 3 — Collect credentials
  console.log("From the Intuit Developer Dashboard, copy your keys:");
  console.log("(Use the 'Development' keys for sandbox, 'Production' for real data)");
  console.log("");
  const clientId = (await rl.question("Paste your Client ID: ")).trim();
  if (!clientId) {
    console.error("Client ID is required.");
    rl.close();
    process.exit(1);
  }

  const clientSecret = (await rl.question("Paste your Client Secret: ")).trim();
  if (!clientSecret) {
    console.error("Client Secret is required.");
    rl.close();
    process.exit(1);
  }

  // Save credentials for the MCP server to use
  await saveCredentials(clientId, clientSecret, useSandbox);
  console.log("");
  console.log("Credentials saved.");

  // Step 3 — OAuth
  console.log("");
  console.log("Opening your browser to connect to QuickBooks...");
  if (useSandbox) {
    console.log("(Sign in with your Intuit developer account, then pick a sandbox company.)");
  } else {
    console.log("(Sign in and authorize access to your QuickBooks company.)");
  }
  console.log("");

  const redirectUri = "http://localhost:9876/callback";
  const config = { clientId, clientSecret, redirectUri };
  const { url, state, codeVerifier } = buildAuthUrl(config);

  const { default: open } = await import("open");
  await open(url);

  console.log("Waiting for authorization...");
  console.log("(If the browser didn't open, visit this URL:)");
  console.log(url);
  console.log("");

  try {
    const tokens = await startOAuthCallbackServer(config, state, codeVerifier);
    console.log(`Connected to QuickBooks company (realm: ${tokens.realm_id})`);
  } catch (err) {
    console.error("Authorization failed:", err);
    rl.close();
    process.exit(1);
  }

  // Step 4 — Configure Claude Desktop
  console.log("");
  console.log("Configuring Claude Desktop...");

  const patched = await patchClaudeDesktopConfig(clientId, clientSecret, useSandbox);
  if (patched) {
    console.log("Claude Desktop config updated.");
  } else {
    console.log("Could not auto-patch Claude Desktop config.");
    printManualConfig(clientId, clientSecret, useSandbox);
  }

  // Done
  console.log("");
  console.log("=== Setup complete! ===");
  console.log("");
  console.log("Restart Claude Desktop, then try asking:");
  console.log('  "What company is connected to QuickBooks?"');
  if (useSandbox) {
    console.log("");
    console.log("You're in sandbox mode — all data is fake and safe to experiment with.");
    console.log("When you're ready for real data, run this setup again and choose Production.");
  }
  console.log("");

  rl.close();
}

// ---------------------------------------------------------------------------
// auth — standalone OAuth (env-var driven, for advanced users)
// ---------------------------------------------------------------------------

async function runAuth(): Promise<void> {
  // Try credentials file first, fall back to env vars
  const creds = await loadCredentials();
  const clientId = creds?.clientId || process.env.QBO_CLIENT_ID;
  const clientSecret = creds?.clientSecret || process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI || "http://localhost:9876/callback";

  if (!clientId || !clientSecret) {
    console.error("No credentials found. Either:");
    console.error("  1. Run `node ~/.mcp-quickbooks/cli.mjs setup` first, or");
    console.error("  2. Set QBO_CLIENT_ID and QBO_CLIENT_SECRET env vars");
    process.exit(1);
  }

  const config = { clientId, clientSecret, redirectUri };
  const { url, state, codeVerifier } = buildAuthUrl(config);

  console.log("Opening browser for QuickBooks authorization...");
  console.log("");
  console.log("If the browser doesn't open, visit this URL:");
  console.log(url);
  console.log("");

  const { default: open } = await import("open");
  await open(url);

  try {
    const tokens = await startOAuthCallbackServer(config, state, codeVerifier);
    console.log("");
    console.log(`Connected to QuickBooks company (realmId: ${tokens.realm_id})`);
    console.log("Tokens saved to ~/.mcp-quickbooks/tokens.json");
  } catch (err) {
    console.error("Authorization failed:", err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Credentials file — so the MCP server can read them at runtime without
// needing env vars in the Claude Desktop config
// ---------------------------------------------------------------------------

async function saveCredentials(clientId: string, clientSecret: string, sandbox: boolean): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CREDS_FILE, JSON.stringify({ clientId, clientSecret, sandbox }, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

// ---------------------------------------------------------------------------
// Claude Desktop config patching
// ---------------------------------------------------------------------------

function getClaudeDesktopConfigPath(): string {
  const p = platform();
  if (p === "darwin") {
    return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (p === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  }
  // Linux / fallback
  return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
}

async function patchClaudeDesktopConfig(
  clientId: string,
  clientSecret: string,
  sandbox: boolean,
): Promise<boolean> {
  const configPath = getClaudeDesktopConfigPath();
  let fileExists = false;

  let config: Record<string, unknown> = {};
  try {
    const raw = await readFile(configPath, "utf-8");
    fileExists = true;
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    if (fileExists) {
      // File exists but has invalid JSON — don't overwrite it
      console.error("Warning: Existing Claude Desktop config has invalid JSON. Skipping auto-patch.");
      return false;
    }
    // File doesn't exist yet — we'll create it
  }

  // Backup existing config before modifying
  if (fileExists) {
    try {
      await copyFile(configPath, configPath + ".bak");
    } catch {
      // Non-fatal — proceed without backup
    }
  }

  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    config.mcpServers = {};
  }

  const servers = config.mcpServers as Record<string, unknown>;

  const env: Record<string, string> = {
    QBO_CLIENT_ID: clientId,
    QBO_CLIENT_SECRET: clientSecret,
  };
  if (sandbox) {
    env.QBO_SANDBOX = "true";
  }

  // Determine how to invoke the server: bundle at ~/.mcp-quickbooks/server.mjs
  // if it exists, otherwise fall back to npx
  const serverPath = join(CONFIG_DIR, "server.mjs");
  let serverConfig: { command: string; args: string[] };
  try {
    await readFile(serverPath);
    serverConfig = { command: "node", args: [serverPath] };
  } catch {
    serverConfig = { command: "npx", args: ["-y", "mcp-quickbooks"] };
  }

  servers.quickbooks = {
    ...serverConfig,
    env,
  };

  try {
    const dir = join(configPath, "..");
    await mkdir(dir, { recursive: true });
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

function printManualConfig(clientId: string, clientSecret: string, sandbox: boolean): void {
  const env: Record<string, string> = {
    QBO_CLIENT_ID: clientId,
    QBO_CLIENT_SECRET: clientSecret,
  };
  if (sandbox) env.QBO_SANDBOX = "true";

  const serverPath = join(CONFIG_DIR, "server.mjs");
  const snippet = {
    quickbooks: {
      command: "node",
      args: [serverPath],
      env,
    },
  };

  console.log("");
  console.log("Add this to your Claude Desktop config (mcpServers section):");
  console.log("");
  console.log(JSON.stringify(snippet, null, 2));
  console.log("");
  console.log("Config file locations:");
  console.log("  macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json");
  console.log("  Windows: %APPDATA%\\Claude\\claude_desktop_config.json");
  console.log("  Linux:   ~/.config/Claude/claude_desktop_config.json");
}
