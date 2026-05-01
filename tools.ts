// src/tools.ts
// All MCP tool definitions and their handlers

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as shopify from "./shopify.js";

export function registerTools(server: McpServer) {

  // ─── SHOP ──────────────────────────────────────────────────────────────────

  server.tool(
    "get_shop_info",
    "Get general information about the Shopify store (name, email, currency, plan, etc.)",
    {},
    async () => {
      const data = await shopify.getShopInfo();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ─── ORDERS ────────────────────────────────────────────────────────────────

  server.tool(
    "list_orders",
    "List orders from the Shopify store with optional filters",
    {
      status: z.enum(["open", "closed", "cancelled", "any"]).optional().describe("Order status filter"),
      financial_status: z.enum(["paid", "unpaid", "refunded", "partially_refunded", "pending", "voided"]).optional(),
      fulfillment_status: z.enum(["shipped", "unshipped", "fulfilled", "partial", "restocked"]).optional(),
      limit: z.number().min(1).max(250).optional().default(25).describe("Number of orders to return"),
      since_id: z.string().optional().describe("Return orders after this order ID"),
    },
    async (params) => {
      const data = await shopify.listOrders(params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_order",
    "Get full details of a specific order by ID",
    { order_id: z.string().describe("Shopify order ID") },
    async ({ order_id }) => {
      const data = await shopify.getOrder(order_id);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_order",
    "Create a new order in Shopify (draft or immediate). Use this to place orders programmatically.",
    {
      line_items: z.array(z.object({
        variant_id: z.string(),
        quantity: z.number().min(1),
      })).describe("Products and quantities for the order"),
      customer_email: z.string().email().optional(),
      customer_id: z.string().optional().describe("Existing customer ID"),
      note: z.string().optional().describe("Internal order note"),
      tags: z.string().optional().describe("Comma-separated tags"),
      financial_status: z.enum(["pending", "paid"]).optional().default("pending"),
      send_receipt: z.boolean().optional().default(false),
      shipping_address: z.object({
        first_name: z.string(), last_name: z.string(),
        address1: z.string(), city: z.string(),
        province: z.string().optional(), country: z.string(),
        zip: z.string(), phone: z.string().optional(),
      }).optional(),
    },
    async (params) => {
      const order: Parameters<typeof shopify.createOrder>[0] = {
        line_items: params.line_items,
        financial_status: params.financial_status,
        note: params.note,
        tags: params.tags,
        send_receipt: params.send_receipt,
        email: params.customer_email,
      };
      if (params.customer_id) order.customer = { id: params.customer_id };
      if (params.shipping_address) order.shipping_address = params.shipping_address as Record<string, string>;
      const data = await shopify.createOrder(order);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_order",
    "Update an existing order (tags, note, email, shipping address, etc.)",
    {
      order_id: z.string(),
      note: z.string().optional(),
      tags: z.string().optional(),
      email: z.string().email().optional(),
      buyer_accepts_marketing: z.boolean().optional(),
    },
    async ({ order_id, ...updates }) => {
      const data = await shopify.updateOrder(order_id, updates);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "cancel_order",
    "Cancel an existing order",
    {
      order_id: z.string(),
      reason: z.enum(["customer", "inventory", "fraud", "declined", "other"]).optional(),
      email: z.boolean().optional().default(true).describe("Send cancellation email to customer"),
      refund: z.boolean().optional().default(false).describe("Refund any payments"),
    },
    async (params) => {
      const data = await shopify.cancelOrder(params.order_id, {
        reason: params.reason,
        email: params.email,
        refund: params.refund,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_refund",
    "Create a refund for an order",
    {
      order_id: z.string(),
      notify: z.boolean().optional().default(true),
      note: z.string().optional(),
      full_shipping_refund: z.boolean().optional(),
      line_item_refunds: z.array(z.object({
        line_item_id: z.string(),
        quantity: z.number().min(1),
        restock_type: z.enum(["return", "cancel", "no_restock"]).optional(),
      })).optional(),
    },
    async (params) => {
      const data = await shopify.createRefund(params.order_id, {
        notify: params.notify,
        note: params.note,
        shipping: params.full_shipping_refund ? { full_refund: true } : undefined,
        refund_line_items: params.line_item_refunds,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "fulfill_order",
    "Create a fulfillment for an order (mark as shipped)",
    {
      order_id: z.string(),
      tracking_number: z.string().optional(),
      tracking_company: z.string().optional().describe("e.g. DHL, UPS, FedEx, Royal Mail"),
      tracking_url: z.string().url().optional(),
      notify_customer: z.boolean().optional().default(true),
      location_id: z.string().optional(),
      line_item_ids: z.array(z.string()).optional().describe("Specific line items to fulfill. Omit for all."),
    },
    async (params) => {
      const lineItems = params.line_item_ids?.map(id => ({ id, quantity: 1 }));
      const data = await shopify.createFulfillment(params.order_id, {
        tracking_number: params.tracking_number,
        tracking_company: params.tracking_company,
        tracking_url: params.tracking_url,
        notify_customer: params.notify_customer,
        location_id: params.location_id,
        line_items: lineItems,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ─── PRODUCTS ──────────────────────────────────────────────────────────────

  server.tool(
    "list_products",
    "List products in the Shopify store",
    {
      limit: z.number().min(1).max(250).optional().default(25),
      status: z.enum(["active", "draft", "archived"]).optional(),
      vendor: z.string().optional(),
      product_type: z.string().optional(),
      title: z.string().optional().describe("Filter by title (partial match)"),
    },
    async (params) => {
      const data = await shopify.listProducts(params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_product",
    "Get full details of a specific product including variants and images",
    { product_id: z.string() },
    async ({ product_id }) => {
      const data = await shopify.getProduct(product_id);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_product",
    "Create a new product in Shopify",
    {
      title: z.string(),
      body_html: z.string().optional().describe("Product description (HTML supported)"),
      vendor: z.string().optional(),
      product_type: z.string().optional(),
      tags: z.string().optional().describe("Comma-separated tags"),
      status: z.enum(["active", "draft", "archived"]).optional().default("draft"),
      price: z.string().optional().describe("Variant price e.g. '29.99'"),
      sku: z.string().optional(),
      inventory_quantity: z.number().optional(),
      image_url: z.string().url().optional(),
    },
    async (params) => {
      const data = await shopify.createProduct({
        title: params.title,
        body_html: params.body_html,
        vendor: params.vendor,
        product_type: params.product_type,
        tags: params.tags,
        status: params.status,
        variants: params.price ? [{ price: params.price, sku: params.sku, inventory_quantity: params.inventory_quantity }] : undefined,
        images: params.image_url ? [{ src: params.image_url }] : undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_product",
    "Update an existing product's details",
    {
      product_id: z.string(),
      title: z.string().optional(),
      body_html: z.string().optional(),
      vendor: z.string().optional(),
      tags: z.string().optional(),
      status: z.enum(["active", "draft", "archived"]).optional(),
    },
    async ({ product_id, ...updates }) => {
      const data = await shopify.updateProduct(product_id, updates);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_variant",
    "Update a product variant (price, SKU, inventory, weight, etc.)",
    {
      variant_id: z.string(),
      price: z.string().optional(),
      compare_at_price: z.string().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      weight: z.number().optional(),
      weight_unit: z.enum(["kg", "g", "lb", "oz"]).optional(),
    },
    async ({ variant_id, ...updates }) => {
      const data = await shopify.updateVariant(variant_id, updates);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_product",
    "Permanently delete a product from Shopify",
    { product_id: z.string() },
    async ({ product_id }) => {
      const data = await shopify.deleteProduct(product_id);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ─── CUSTOMERS ─────────────────────────────────────────────────────────────

  server.tool(
    "search_customers",
    "Search for customers by name, email, phone, or any field",
    {
      query: z.string().describe("Search query e.g. 'john@example.com' or 'John Smith'"),
      limit: z.number().optional().default(10),
    },
    async ({ query, limit }) => {
      const data = await shopify.searchCustomers(query, limit);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_customer",
    "Get full details of a specific customer",
    { customer_id: z.string() },
    async ({ customer_id }) => {
      const data = await shopify.getCustomer(customer_id);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_customer_orders",
    "Get all orders for a specific customer",
    { customer_id: z.string() },
    async ({ customer_id }) => {
      const data = await shopify.getCustomerOrders(customer_id);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_customer",
    "Create a new customer in Shopify",
    {
      first_name: z.string(),
      last_name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      tags: z.string().optional(),
      note: z.string().optional(),
      accepts_marketing: z.boolean().optional().default(false),
    },
    async (params) => {
      const data = await shopify.createCustomer(params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_customer",
    "Update a customer's details, tags, or notes",
    {
      customer_id: z.string(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      tags: z.string().optional(),
      note: z.string().optional(),
      accepts_marketing: z.boolean().optional(),
    },
    async ({ customer_id, ...updates }) => {
      const data = await shopify.updateCustomer(customer_id, updates);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ─── INVENTORY ─────────────────────────────────────────────────────────────

  server.tool(
    "list_locations",
    "List all Shopify fulfillment locations",
    {},
    async () => {
      const data = await shopify.listLocations();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_inventory_levels",
    "Get inventory levels for specific inventory items or locations",
    {
      inventory_item_ids: z.string().optional().describe("Comma-separated inventory item IDs"),
      location_ids: z.string().optional().describe("Comma-separated location IDs"),
    },
    async (params) => {
      const data = await shopify.getInventoryLevels(params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "adjust_inventory",
    "Adjust inventory quantity by a delta (positive to add, negative to remove)",
    {
      location_id: z.string(),
      inventory_item_id: z.string(),
      adjustment: z.number().describe("Amount to add (positive) or remove (negative)"),
    },
    async ({ location_id, inventory_item_id, adjustment }) => {
      const data = await shopify.adjustInventory({
        location_id,
        inventory_item_id,
        available_adjustment: adjustment,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "set_inventory",
    "Set inventory to an exact quantity at a location",
    {
      location_id: z.string(),
      inventory_item_id: z.string(),
      quantity: z.number().min(0),
    },
    async ({ location_id, inventory_item_id, quantity }) => {
      const data = await shopify.setInventory({ location_id, inventory_item_id, available: quantity });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ─── DISCOUNTS ─────────────────────────────────────────────────────────────

  server.tool(
    "list_price_rules",
    "List all price rules (discount configurations)",
    { limit: z.number().optional().default(25) },
    async ({ limit }) => {
      const data = await shopify.listPriceRules(limit);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_discount",
    "Create a discount code (e.g. percentage off, fixed amount off)",
    {
      title: z.string().describe("Internal name for the price rule"),
      code: z.string().describe("The discount code customers will enter"),
      value_type: z.enum(["percentage", "fixed_amount"]),
      value: z.string().describe("Value as a string e.g. '-10.00' (negative) or '-15.0' for 15%"),
      usage_limit: z.number().optional().describe("Max total uses. Omit for unlimited."),
      once_per_customer: z.boolean().optional().default(false),
      starts_at: z.string().optional().describe("ISO 8601 start date"),
      ends_at: z.string().optional().describe("ISO 8601 expiry date"),
    },
    async (params) => {
      const rule = await shopify.createPriceRule({
        title: params.title,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: params.value_type,
        value: params.value,
        customer_selection: "all",
        usage_limit: params.usage_limit,
        once_per_customer: params.once_per_customer,
        starts_at: params.starts_at,
        ends_at: params.ends_at,
      }) as { price_rule: { id: string } };

      const priceRuleId = String(rule.price_rule.id);
      const discount = await shopify.createDiscountCode(priceRuleId, params.code);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ price_rule: rule.price_rule, discount_code: discount }, null, 2),
        }],
      };
    }
  );

  // ─── GRAPHQL (ESCAPE HATCH) ────────────────────────────────────────────────

  server.tool(
    "run_graphql",
    "Run a raw Shopify Admin GraphQL query or mutation. Use this for advanced operations not covered by other tools.",
    {
      query: z.string().describe("GraphQL query or mutation string"),
      variables: z.record(z.unknown()).optional().describe("GraphQL variables object"),
    },
    async ({ query, variables }) => {
      const data = await shopify.runGraphQL(query, variables);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
