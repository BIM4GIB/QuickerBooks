#!/usr/bin/env bash
# QuickBooks MCP Server — One-line installer for macOS / Linux
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/BIM4GIB/QuickerBooks/main/install.sh | bash
#
set -euo pipefail

REPO="BIM4GIB/QuickerBooks"
BRANCH="main"
BASE="https://raw.githubusercontent.com/$REPO/$BRANCH"
INSTALL_DIR="$HOME/.mcp-quickbooks"

echo ""
echo "=== QuickBooks MCP Server — Installer ==="
echo ""

# ---- Step 1: Check for Node.js ----

install_node() {
  echo "Node.js is required but not installed."
  echo ""

  # Detect OS
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if command -v brew &>/dev/null; then
      echo "Installing Node.js via Homebrew..."
      brew install node
    else
      echo "Installing Homebrew first..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      # Add brew to PATH for this session
      if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      fi
      echo "Installing Node.js via Homebrew..."
      brew install node
    fi
  else
    # Linux
    if command -v apt-get &>/dev/null; then
      echo "Installing Node.js via apt..."
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo apt-get install -y nodejs
    elif command -v dnf &>/dev/null; then
      echo "Installing Node.js via dnf..."
      curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
      sudo dnf install -y nodejs
    else
      echo "Could not auto-install Node.js for your system."
      echo "Please install Node.js 20+ manually: https://nodejs.org/"
      exit 1
    fi
  fi
}

if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Node.js $NODE_VERSION found, but version 20+ is required."
    read -rp "Install Node.js 22? [Y/n] " yn
    case "${yn:-Y}" in
      [nN]*) echo "Please upgrade Node.js manually: https://nodejs.org/"; exit 1 ;;
      *) install_node ;;
    esac
  else
    echo "✓ Node.js $(node -v) found"
  fi
else
  read -rp "Node.js not found. Install it now? [Y/n] " yn
  case "${yn:-Y}" in
    [nN]*) echo "Please install Node.js 20+ from https://nodejs.org/"; exit 1 ;;
    *) install_node ;;
  esac
fi

# ---- Step 2: Download bundles ----

echo ""
echo "Downloading QuickBooks MCP server..."
mkdir -p "$INSTALL_DIR"

curl -fsSL "$BASE/bundle/server.mjs"    -o "$INSTALL_DIR/server.mjs"
curl -fsSL "$BASE/bundle/cli.mjs"       -o "$INSTALL_DIR/cli.mjs"
curl -fsSL "$BASE/GETTING_STARTED.md"   -o "$INSTALL_DIR/GETTING_STARTED.md"

# Verify checksums
curl -fsSL "$BASE/bundle/SHA256SUMS" -o "$INSTALL_DIR/SHA256SUMS"
echo "Verifying downloads..."
(cd "$INSTALL_DIR" && sha256sum -c SHA256SUMS --quiet 2>/dev/null) || \
(cd "$INSTALL_DIR" && shasum -a 256 -c SHA256SUMS --quiet 2>/dev/null) || {
  echo "ERROR: Checksum verification failed! Files may have been tampered with."
  echo "Aborting."
  exit 1
}
echo "✓ Checksums verified"

# macOS: strip quarantine flag so Gatekeeper doesn't block execution
if [[ "$OSTYPE" == "darwin"* ]]; then
  xattr -d com.apple.quarantine "$INSTALL_DIR/server.mjs" 2>/dev/null || true
  xattr -d com.apple.quarantine "$INSTALL_DIR/cli.mjs" 2>/dev/null || true
fi

echo "✓ Downloaded to $INSTALL_DIR"

# ---- Step 3: Run setup wizard ----

echo ""
node "$INSTALL_DIR/cli.mjs" setup

echo ""
echo "A getting-started guide has been saved to:"
echo "  $INSTALL_DIR/GETTING_STARTED.md"
echo ""
echo "Open it for example prompts and tips on testing safely."


