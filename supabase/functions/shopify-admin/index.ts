import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHOPIFY_API_VERSION = "2026-07";

async function getShopifyAdminToken(
  shopifyDomain: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const response = await fetch(
    `https://${shopifyDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    },
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error("Shopify token request failed:", data);

    throw new Error(
      data.error_description ||
        data.error ||
        "Failed to obtain Shopify Admin API token",
    );
  }

  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const shopifyDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");

    if (!shopifyDomain || !clientId || !clientSecret) {
      throw new Error(
        "Shopify environment variables are not configured",
      );
    }

    const shopifyToken = await getShopifyAdminToken(
      shopifyDomain,
      clientId,
      clientSecret,
    );

    const body = await req.json();

    const query = body.query;
    const variables = body.variables ?? {};

    if (!query) {
      return new Response(
        JSON.stringify({
          error: "GraphQL query is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const response = await fetch(
      `https://${shopifyDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": shopifyToken,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      },
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Shopify Admin API error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error
          ? error.message
          : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});