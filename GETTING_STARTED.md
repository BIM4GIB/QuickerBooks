# Getting Started with QuickBooks + Claude

Hey! You're about to connect Claude to your QuickBooks. The whole thing takes
about 10 minutes and starts in a safe sandbox — nothing touches your real books
until you're ready.

---

## Part 1: Create your Intuit Developer App (5 min)

This is a one-time setup. It's free and uses your existing QBO login.

1. Open **https://developer.intuit.com** in your browser
2. Click **Sign In** — use the same email and password you use for QuickBooks
   Online (your regular QBO login)
3. You'll land on a Dashboard. Click **Create an app**
4. Select **QuickBooks Online and Payments**
5. Give it a name — anything works (e.g. "Claude QuickBooks")
6. Once created, click on your app, then go to **Keys & credentials** in the
   left sidebar
7. You'll see two tabs at the top: **Development** and **Production**
   - **Development** = sandbox (fake test data, safe to experiment)
   - **Production** = your real QuickBooks data (use this later)
8. Stay on the **Development** tab for now
9. Scroll down to **Redirect URIs** and click **Add URI**
10. Paste this exactly: `http://localhost:9876/callback` and save
11. Scroll back up — copy your **Client ID** and **Client Secret** (you'll need
    these in a moment)

That's it for the Intuit side. Keep that browser tab open.

---

## Part 2: Install the server (5 min)

Open **Terminal** on your Mac (search for "Terminal" in Spotlight) and paste
this one command:

```
curl -fsSL https://raw.githubusercontent.com/BIM4GIB/QuickerBooks/main/install.sh | bash
```

The installer will:
- Install Node.js if you don't have it (via Homebrew)
- Download the QuickBooks server
- Launch a setup wizard

**The wizard will ask you:**

1. **"Do you already have a Client ID?"** — say **yes** (you just got them
   from the Intuit dashboard)
2. **"Choose 1 or 2"** — pick **1 (Sandbox)** to test safely first
3. **"Paste your Client ID"** — paste it from the Intuit dashboard
4. **"Paste your Client Secret"** — paste it from the Intuit dashboard
5. Your browser will open — sign in with your QBO account and click **Connect**
6. Pick one of the sandbox test companies (any one is fine — it's all fake data)

When you see "Setup complete!", close the wizard and **restart Claude Desktop**.

---

## Part 3: Try it out

Open Claude Desktop and start a new conversation. Try these:

**Check the connection works:**
> What company is connected to QuickBooks?

You should see a sandbox company name (like "Sandbox Company_US_1"). That
means it's working.

**Browse your (fake) data:**
> List my customers
>
> Show me recent invoices
>
> What's the chart of accounts look like?
>
> Run a Profit and Loss report for this year

**Create things (it's all fake, go wild):**
> Create a customer named "Test Corp" with email test@example.com
>
> Create an invoice for Test Corp: 5 widgets at $20 each, due in 30 days
>
> Send that invoice by email
>
> Record a $100 payment from Test Corp against that invoice

**Run reports:**
> Run a P&L for this quarter
>
> Show me the Balance Sheet
>
> Run an Aged Receivables report

**More advanced:**
> Create an estimate for customer 1 with 10 hours of consulting at $150/hr
>
> List all unpaid bills
>
> Create a journal entry: debit Office Supplies $500, credit Cash $500

Everything here is sandbox data. Delete things, create weird invoices, go
nuts — nothing is real.

---

## Part 4: When you're ready for real data

Once you've tested and feel comfortable, switching to production is simple:

### Step 1: Get your production keys

Go back to **https://developer.intuit.com**, open your app, go to
**Keys & credentials**, and switch to the **Production** tab.

**Important:** You need to add the redirect URI here too:
1. Scroll to **Redirect URIs** under the Production tab
2. Click **Add URI**
3. Paste: `http://localhost:9876/callback`
4. Save

Copy the **Production** Client ID and Client Secret.

### Step 2: Re-run setup

Open Terminal and run:
```
node ~/.mcp-quickbooks/cli.mjs setup
```

This time:
- Say **yes** to "Do you have a Client ID?"
- Choose **2 (Production)**
- Paste your **Production** Client ID and Client Secret
- Authorize in the browser — this time you'll see your real company

Restart Claude Desktop.

### Step 3: Take it easy at first

- **Start with reads.** Ask Claude to list customers, show invoices, run
  reports. Get a feel for it before creating or changing anything.
- **Review before you approve.** When Claude wants to create an invoice or
  record a payment, it tells you what it's about to do. Read it before
  saying yes.
- **You can always switch back.** Run `node ~/.mcp-quickbooks/cli.mjs setup`
  again and pick Sandbox to go back to the test environment anytime.

---

## Quick reference

| What Claude can do | Details |
|---|---|
| **Customers & Vendors** | Search, view, create, update |
| **Invoices** | Create, send by email, track balances |
| **Payments** | Record and apply to invoices |
| **Estimates** | Create quotes for clients |
| **Bills** | Track vendor payables |
| **Journal Entries** | Manual adjustments |
| **Reports** | P&L, Balance Sheet, Cash Flow, Trial Balance, Aging |
| **Chart of Accounts** | Browse your account structure |
| **Company Info** | View connected company details |

## Troubleshooting

**Claude says "not authenticated"**
Your tokens expired (happens after ~100 days). Run:
```
node ~/.mcp-quickbooks/cli.mjs auth
```

**Claude doesn't show QuickBooks tools**
Make sure you restarted Claude Desktop after setup.

**macOS "operation not permitted" error**
Run this in Terminal:
```
xattr -d com.apple.quarantine ~/.mcp-quickbooks/*.mjs
```

**Something broke**
Re-run the install command from Part 2 to start fresh.

**Want to switch between sandbox and production**
Just run `node ~/.mcp-quickbooks/cli.mjs setup` again and pick the other mode.

