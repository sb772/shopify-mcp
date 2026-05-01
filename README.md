# Shopify MCP Server

A custom **Model Context Protocol (MCP) server** for Shopify that lets Claude place orders, manage products, customers, inventory, and more — all via natural language.

## Tools Exposed

| Category | Tools |
|---|---|
| **Shop** | `get_shop_info` |
| **Orders** | `list_orders`, `get_order`, `create_order`, `update_order`, `cancel_order`, `create_refund`, `fulfill_order` |
| **Products** | `list_products`, `get_product`, `create_product`, `update_product`, `update_variant`, `delete_product` |
| **Customers** | `search_customers`, `get_customer`, `get_customer_orders`, `create_customer`, `update_customer` |
| **Inventory** | `list_locations`, `get_inventory_levels`, `adjust_inventory`, `set_inventory` |
| **Discounts** | `list_price_rules`, `create_discount` |
| **Escape Hatch** | `run_graphql` — raw GraphQL for anything not covered above |

---

## Step 1: Get Shopify Credentials

1. Go to your Shopify Admin → **Settings → Apps and sales channels → Develop apps**
2. Click **Create an app** → give it a name (e.g. "Claude MCP")
3. Click **Configure Admin API scopes** and enable:
   - `read_orders`, `write_orders`
   - `read_products`, `write_products`
   - `read_customers`, `write_customers`
   - `read_inventory`, `write_inventory`
   - `read_price_rules`, `write_price_rules`
   - `read_fulfillments`, `write_fulfillments`
4. Click **Save** → **Install app** → **Install**
5. Copy the **Admin API access token** (shown once — save it!)

---

## Step 2: Local Development

```bash
git clone <your-repo>
cd shopify-mcp

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Shopify credentials

# Run in dev mode
npm run dev

# Or build and run
npm run build && npm start
```

The server starts at `http://localhost:3000`.

Test it:
```bash
curl http://localhost:3000/health
```

---

## Step 3: Deploy

### Option A — Railway (Recommended, free tier available)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Select the repo
4. Add environment variables in Railway dashboard:
   - `SHOPIFY_SHOP`
   - `SHOPIFY_ACCESS_TOKEN`
   - `MCP_API_SECRET` (optional but recommended)
5. Railway will build and deploy — note the public URL it gives you

### Option B — Render

1. Connect your GitHub repo at [render.com](https://render.com)
2. **New Web Service** → Docker runtime
3. Add the same environment variables
4. Set health check path: `/health`

### Option C — Fly.io

```bash
fly launch
fly secrets set SHOPIFY_SHOP=mystore.myshopify.com
fly secrets set SHOPIFY_ACCESS_TOKEN=shpat_xxx
fly deploy
```

### Option D — Vercel (Serverless)

The SSE transport requires persistent connections — use Railway or Fly.io instead for proper SSE support.

---

## Step 4: Add to Claude.ai as a Connector

1. Go to [claude.ai](https://claude.ai) → **Settings → Integrations**
2. Click **Add custom integration** (or MCP server)
3. Enter:
   - **URL**: `https://your-deployment-url.railway.app/sse`
   - **Name**: Shopify
   - If you set `MCP_API_SECRET`, add it as a header: `x-api-key: your_secret`
4. Claude will list all available tools — you're connected!

---

## Usage Examples

Once connected, you can ask Claude things like:

```
"Show me all open orders from today"
"Place an order for variant 12345678 qty 2 for customer sam@healf.com"
"Cancel order #1234 and refund it"
"Create a 20% off discount code SUMMER25 that expires July 31st"
"Update inventory for item 98765 at location 11111 to 50 units"
"Find the customer john.doe@example.com and show their order history"
"Create a new product called 'Protein Bar' at £2.99 in draft status"
```

---

## Adding Custom Logic

To add your own tools, edit `src/tools.ts` and add a new `server.tool(...)` block:

```typescript
server.tool(
  "my_custom_tool",
  "Description of what this tool does",
  {
    param1: z.string().describe("What this param does"),
    param2: z.number().optional(),
  },
  async ({ param1, param2 }) => {
    // Your custom logic here
    const result = await doSomething(param1, param2);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);
```

---

## Security Notes

- Always set `MCP_API_SECRET` in production
- The access token has broad admin access — treat it like a password
- Consider IP allowlisting if your hosting provider supports it
- Rotate the access token periodically via Shopify Admin
