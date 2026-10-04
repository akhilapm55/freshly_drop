const SHOPIFY_STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;
const SHOPIFY_STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

const SHOPIFY_API_URL = `https://${SHOPIFY_STORE_DOMAIN}/api/2026-07/graphql.json`;

interface ShopifyCartLine {
  merchandiseId: string;
  quantity: number;
}

async function shopifyRequest<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(SHOPIFY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Shopify request failed: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }

  return result.data;
}

export async function createShopifyCart(
    lines: ShopifyCartLine[],
    attributes: { key: string; value: string }[] = []
    ): Promise<string> {
    const mutation = `
        mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
            cart {
                id
                checkoutUrl
                attributes {
                    key
                    value
                }
            }
            userErrors {
            field
            message
            }
        }
        }
    `;

    const data = await shopifyRequest<any>(mutation, {
        input: {
        lines,
        attributes,
        },
    });

    const userErrors = data.cartCreate.userErrors;

    if (userErrors?.length) {
        throw new Error(userErrors[0].message);
    }

    const cart = data.cartCreate.cart;

    if (!cart?.id || !cart?.checkoutUrl) {
        throw new Error('Shopify did not return a checkout URL.');
    }
    return cart.checkoutUrl;
}