import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string
): Promise<boolean> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SHOPIFY_CLIENT_SECRET),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    base64ToBytes(hmacHeader),
    encoder.encode(rawBody)
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const hmacHeader = req.headers.get("X-Shopify-Hmac-SHA256");

    if (!hmacHeader) {
      return new Response("Missing Shopify HMAC", { status: 401 });
    }

    const rawBody = await req.text();

    const valid = await verifyShopifyWebhook(rawBody, hmacHeader);

    if (!valid) {
      return new Response("Invalid Shopify HMAC", { status: 401 });
    }

    const shopifyOrder = JSON.parse(rawBody);

    console.log("Verified Shopify order webhook:", JSON.stringify(shopifyOrder));

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    return Response.json({
      received: true,
      shopify_order_id: String(shopifyOrder.id),
    });
  } catch (error) {
    console.error("Shopify webhook error:", error);

    return new Response("Webhook processing failed", {
      status: 500,
    });
  }
});