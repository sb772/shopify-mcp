// src/shopify.ts
// Shopify Admin API client — wraps REST API calls

const BASE = (shop: string) =>
  `https://${shop}/admin/api/2025-01`;

interface ShopifyConfig {
  shop: string;          // e.g. mystore.myshopify.com
  accessToken: string;   // Admin API access token
}

let config: ShopifyConfig | null = null;

export function initShopify(cfg: ShopifyConfig) {
  config = cfg;
}

export function getConfig(): ShopifyConfig {
  if (!config) throw new Error("Shopify not configured. Set SHOPIFY_SHOP and SHOPIFY_ACCESS_TOKEN env vars.");
  return config;
}

async function shopifyFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const { shop, accessToken } = getConfig();
  const url = `${BASE(shop)}${path}`;
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── ORDERS ──────────────────────────────────────────────────────────────────

export async function listOrders(params: {
  status?: string;
  limit?: number;
  since_id?: string;
  financial_status?: string;
  fulfillment_status?: string;
}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.since_id) qs.set("since_id", params.since_id);
  if (params.financial_status) qs.set("financial_status", params.financial_status);
  if (params.fulfillment_status) qs.set("fulfillment_status", params.fulfillment_status);
  return shopifyFetch(`/orders.json?${qs}`);
}

export async function getOrder(orderId: string) {
  return shopifyFetch(`/orders/${orderId}.json`);
}

export async function createOrder(order: {
  line_items: Array<{ variant_id: string; quantity: number }>;
  customer?: { id?: string; email?: string };
  shipping_address?: Record<string, string>;
  billing_address?: Record<string, string>;
  financial_status?: string;
  email?: string;
  note?: string;
  tags?: string;
  send_receipt?: boolean;
  send_fulfillment_receipt?: boolean;
}) {
  return shopifyFetch("/orders.json", {
    method: "POST",
    body: { order },
  });
}

export async function updateOrder(
  orderId: string,
  updates: Record<string, unknown>
) {
  return shopifyFetch(`/orders/${orderId}.json`, {
    method: "PUT",
    body: { order: updates },
  });
}

export async function cancelOrder(
  orderId: string,
  options: { reason?: string; email?: boolean; refund?: boolean } = {}
) {
  return shopifyFetch(`/orders/${orderId}/cancel.json`, {
    method: "POST",
    body: options,
  });
}

export async function closeOrder(orderId: string) {
  return shopifyFetch(`/orders/${orderId}/close.json`, { method: "POST" });
}

export async function createRefund(
  orderId: string,
  refund: {
    notify?: boolean;
    note?: string;
    refund_line_items?: Array<{ line_item_id: string; quantity: number; restock_type?: string }>;
    shipping?: { full_refund?: boolean; amount?: string };
    transactions?: Array<{ kind: string; gateway: string; amount: string; parent_id: string }>;
  }
) {
  return shopifyFetch(`/orders/${orderId}/refunds.json`, {
    method: "POST",
    body: { refund },
  });
}

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

export async function listProducts(params: {
  limit?: number;
  vendor?: string;
  product_type?: string;
  status?: string;
  title?: string;
}) {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.vendor) qs.set("vendor", params.vendor);
  if (params.product_type) qs.set("product_type", params.product_type);
  if (params.status) qs.set("status", params.status);
  if (params.title) qs.set("title", params.title);
  return shopifyFetch(`/products.json?${qs}`);
}

export async function getProduct(productId: string) {
  return shopifyFetch(`/products/${productId}.json`);
}

export async function createProduct(product: {
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  status?: "active" | "draft" | "archived";
  variants?: Array<{
    price: string;
    sku?: string;
    inventory_quantity?: number;
    option1?: string;
  }>;
  images?: Array<{ src: string; alt?: string }>;
}) {
  return shopifyFetch("/products.json", {
    method: "POST",
    body: { product },
  });
}

export async function updateProduct(
  productId: string,
  updates: Record<string, unknown>
) {
  return shopifyFetch(`/products/${productId}.json`, {
    method: "PUT",
    body: { product: updates },
  });
}

export async function deleteProduct(productId: string) {
  return shopifyFetch(`/products/${productId}.json`, { method: "DELETE" });
}

export async function listProductVariants(productId: string) {
  return shopifyFetch(`/products/${productId}/variants.json`);
}

export async function updateVariant(
  variantId: string,
  updates: Record<string, unknown>
) {
  return shopifyFetch(`/variants/${variantId}.json`, {
    method: "PUT",
    body: { variant: updates },
  });
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

export async function listCustomers(params: {
  limit?: number;
  query?: string;
  since_id?: string;
}) {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.query) qs.set("query", params.query);
  if (params.since_id) qs.set("since_id", params.since_id);
  return shopifyFetch(`/customers.json?${qs}`);
}

export async function getCustomer(customerId: string) {
  return shopifyFetch(`/customers/${customerId}.json`);
}

export async function searchCustomers(query: string, limit = 10) {
  const qs = new URLSearchParams({ query, limit: String(limit) });
  return shopifyFetch(`/customers/search.json?${qs}`);
}

export async function createCustomer(customer: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  tags?: string;
  note?: string;
  accepts_marketing?: boolean;
  addresses?: Array<Record<string, string>>;
}) {
  return shopifyFetch("/customers.json", {
    method: "POST",
    body: { customer },
  });
}

export async function updateCustomer(
  customerId: string,
  updates: Record<string, unknown>
) {
  return shopifyFetch(`/customers/${customerId}.json`, {
    method: "PUT",
    body: { customer: updates },
  });
}

export async function getCustomerOrders(customerId: string) {
  return shopifyFetch(`/customers/${customerId}/orders.json`);
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────

export async function listInventoryItems(ids: string[]) {
  const qs = new URLSearchParams({ ids: ids.join(",") });
  return shopifyFetch(`/inventory_items.json?${qs}`);
}

export async function getInventoryLevels(params: {
  inventory_item_ids?: string;
  location_ids?: string;
}) {
  const qs = new URLSearchParams();
  if (params.inventory_item_ids) qs.set("inventory_item_ids", params.inventory_item_ids);
  if (params.location_ids) qs.set("location_ids", params.location_ids);
  return shopifyFetch(`/inventory_levels.json?${qs}`);
}

export async function adjustInventory(params: {
  location_id: string;
  inventory_item_id: string;
  available_adjustment: number;
}) {
  return shopifyFetch("/inventory_levels/adjust.json", {
    method: "POST",
    body: params,
  });
}

export async function setInventory(params: {
  location_id: string;
  inventory_item_id: string;
  available: number;
}) {
  return shopifyFetch("/inventory_levels/set.json", {
    method: "POST",
    body: params,
  });
}

export async function listLocations() {
  return shopifyFetch("/locations.json");
}

// ─── FULFILLMENTS ─────────────────────────────────────────────────────────────

export async function listFulfillments(orderId: string) {
  return shopifyFetch(`/orders/${orderId}/fulfillments.json`);
}

export async function createFulfillment(
  orderId: string,
  fulfillment: {
    location_id?: string;
    tracking_number?: string;
    tracking_company?: string;
    tracking_url?: string;
    notify_customer?: boolean;
    line_items?: Array<{ id: string; quantity: number }>;
  }
) {
  return shopifyFetch(`/orders/${orderId}/fulfillments.json`, {
    method: "POST",
    body: { fulfillment },
  });
}

// ─── DISCOUNTS & PRICE RULES ──────────────────────────────────────────────────

export async function listPriceRules(limit = 25) {
  return shopifyFetch(`/price_rules.json?limit=${limit}`);
}

export async function createPriceRule(rule: {
  title: string;
  target_type: "line_item" | "shipping_line";
  target_selection: "all" | "entitled";
  allocation_method: "across" | "each";
  value_type: "fixed_amount" | "percentage";
  value: string;
  customer_selection: "all" | "prerequisite";
  starts_at?: string;
  ends_at?: string;
  usage_limit?: number;
  once_per_customer?: boolean;
}) {
  return shopifyFetch("/price_rules.json", {
    method: "POST",
    body: { price_rule: rule },
  });
}

export async function createDiscountCode(priceRuleId: string, code: string) {
  return shopifyFetch(`/price_rules/${priceRuleId}/discount_codes.json`, {
    method: "POST",
    body: { discount_code: { code } },
  });
}

// ─── SHOP INFO ────────────────────────────────────────────────────────────────

export async function getShopInfo() {
  return shopifyFetch("/shop.json");
}

export async function runGraphQL(query: string, variables?: Record<string, unknown>) {
  const { shop, accessToken } = getConfig();
  const res = await fetch(
    `https://${shop}/admin/api/2025-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!res.ok) throw new Error(`GraphQL error ${res.status}: ${await res.text()}`);
  return res.json();
}
