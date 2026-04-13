# QuickerBooks

Connect Claude Desktop to your QuickBooks Online account. Ask Claude to look up customers, create invoices, record payments, and more — all in plain English.

## What You Need

1. **Claude Desktop** — [download here](https://claude.ai/download) if you don't have it
2. **QuickBooks Online credentials** — your admin will send you a Client ID and Client Secret

That's it. The installer handles everything else (including Node.js if you don't have it).

## Setup (5 minutes)

**Mac / Linux** — open Terminal and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/BIM4GIB/QuickerBooks/main/install.sh | bash
```

**Windows** — open PowerShell and paste:

```powershell
irm https://raw.githubusercontent.com/BIM4GIB/QuickerBooks/main/install.ps1 | iex
```

The installer will:
1. Install Node.js if you don't have it
2. Download the QuickBooks server
3. Ask you to paste the Client ID and Client Secret
4. Open your browser — sign into QuickBooks and click "Connect"
5. Automatically configure Claude Desktop

When it's done, **restart Claude Desktop**.

## Try It Out

Open Claude Desktop and ask things like:

- "What company is connected to QuickBooks?"
- "List my recent invoices"
- "Create a new customer named Jane Smith with email jane@example.com"
- "Show me all unpaid invoices for customer 42"
- "Record a $500 payment from customer 42 against invoice 101"
- "Show me the P&L for Q1 2025"
- "Create an estimate for customer 42 with 10 widgets at $50 each"
- "List all unpaid bills"
- "What's our chart of accounts look like?"

## Available Tools (32)

| Area | What Claude Can Do |
|------|-------------------|
| **Customers** | List, search, view details, create, update |
| **Invoices** | List, search, view details, create, send by email |
| **Payments** | List, view details, record payments against invoices |
| **Vendors** | List, search, view details, create, update |
| **Items** | List, search, view details, create, update products/services |
| **Estimates** | List, view details, create quotes for customers |
| **Bills** | List, view details, create vendor payables |
| **Journal Entries** | List, view details, create manual adjustments |
| **Accounts** | List and view Chart of Accounts |
| **Reports** | P&L, Balance Sheet, Cash Flow, Trial Balance, Aged Receivables/Payables, and more |
| **Company** | View connected company information |

## Safe sandbox testing

The installer defaults to **sandbox mode** — Intuit's free test environment with fake companies and dummy data. Nothing you do in sandbox touches any real QuickBooks account. Create invoices, delete customers, run reports — it's all disposable.

When you're comfortable, run the installer again and pick "Production" to connect to your real books.

## Re-Authorize

QuickBooks tokens expire after about 100 days. If Claude says it can't connect, re-run the installer or run:

```
node ~/.mcp-quickbooks/cli.mjs auth
```

## Troubleshooting

**"No credentials found"** — Run the installer again (the one-liner from above).

**Claude doesn't show QuickBooks tools** — Make sure you restarted Claude Desktop after setup. Check that `claude_desktop_config.json` has a `quickbooks` entry under `mcpServers`.

**Browser didn't open during auth** — Copy the URL printed in the terminal and paste it into your browser manually.

## For Developers

```bash
git clone <repo>
cd QuickerBooks
npm install
npm run dev        # watch mode
npm test           # run 142 tests
npx @modelcontextprotocol/inspector node dist/index.js   # test tools interactively
```


