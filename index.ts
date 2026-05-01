// src/index.ts
// Shopify MCP Server — HTTP/SSE transport for Claude.ai connector

import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { initShopify } from "./shopify.js";
import { registerTools } from "./tools.js";

// ─── Configuration ─────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);
const API_SECRET = process.env.MCP_API_SECRET; // Optional: protect your endpoint

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;           // e.g. mystore.myshopify.com
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!SHOPIFY_SHOP || !SHOPIFY_ACCESS_TOKEN) {
  console.error("❌  Missing required environment variables:");
  console.error("    SHOPIFY_SHOP         — your Shopify domain (e.g. mystore.myshopify.com)");
  console.error("    SHOPIFY_ACCESS_TOKEN — Admin API access token");
  process.exit(1);
}

initShopify({ shop: SHOPIFY_SHOP, accessToken: SHOPIFY_ACCESS_TOKEN });

// ─── MCP Server ────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "shopify-mcp",
  version: "1.0.0",
  description: "Shopify Admin MCP Server — orders, products, customers, inventory, discounts",
});

registerTools(server);

// ─── Express App ───────────────────────────────────────────────────────────

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
}));

app.use(express.json());

// Auth middleware (optional but recommended)
function checkAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_SECRET) return next(); // No secret set — open access
  const key = req.headers["x-api-key"] ?? req.headers["authorization"]?.replace("Bearer ", "");
  if (key !== API_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "shopify-mcp",
    shop: SHOPIFY_SHOP,
    timestamp: new Date().toISOString(),
  });
});

// Active SSE connections
const transports = new Map<string, SSEServerTransport>();

// SSE endpoint — Claude connects here
app.get("/sse", checkAuth, async (req, res) => {
  console.log(`[SSE] New connection from ${req.ip}`);

  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  transports.set(sessionId, transport);

  res.on("close", () => {
    console.log(`[SSE] Connection closed: ${sessionId}`);
    transports.delete(sessionId);
  });

  await server.connect(transport);
  console.log(`[SSE] Connected: ${sessionId}`);
});

// Message endpoint — Claude POSTs tool calls here
app.post("/messages", checkAuth, async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: `No active session: ${sessionId}` });
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║      Shopify MCP Server — Running         ║
╠═══════════════════════════════════════════╣
║  Port    : ${PORT}                            ║
║  Shop    : ${SHOPIFY_SHOP?.slice(0, 28)}
║  Auth    : ${API_SECRET ? "✅ API secret set" : "⚠️  No auth (open)"}
╠═══════════════════════════════════════════╣
║  SSE URL : http://localhost:${PORT}/sse       ║
║  Health  : http://localhost:${PORT}/health    ║
╚═══════════════════════════════════════════╝
  `);
});

export default app;
