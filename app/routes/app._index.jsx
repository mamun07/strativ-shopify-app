import { useEffect } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Box,
  Link,
  InlineStack,
  Icon,
  Button,
} from "@shopify/polaris";
import { EditIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// --- Loader: Fetch products and shop domain ---
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(`
    {
      products(first: 20) {
        edges {
          node {
            id
            title
            handle
            featuredImage {
              url
              altText
            }
            variants(first: 1) {
              edges {
                node {
                  price
                }
              }
            }
          }
        }
      }
    }
  `);

  const json = await response.json();
  const products = json.data.products.edges.map((edge) => {
    const node = edge.node;
    return {
      ...node,
      price: node.variants.edges[0]?.node.price || "N/A",
    };
  });

  return {
    products,
    shop: session.shop,
  };
};

// --- Action: Create a new random product ---
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];

  const response = await admin.graphql(
    `#graphql
    mutation populateProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product {
          id
          title
          handle
          status
          variants(first: 10) {
            edges {
              node {
                id
                price
                barcode
                createdAt
              }
            }
          }
        }
      }
    }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    }
  );

  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;

  const variantId = product.variants.edges[0].node.id;

  await admin.graphql(
    `#graphql
    mutation updateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    }
  );

  return { product };
};

// --- Main Component ---
export default function Index() {
  const { products, shop } = useLoaderData();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === "submitting";

  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <Page title="Product Customization">
      <Layout>
        <Layout.Section>
          <Button onClick={generateProduct} loading={isSubmitting}>
            Generate a Product
          </Button>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Product List
              </Text>

              {products.map((product) => (
                <InlineStack
                  key={product.id}
                  align="space-between"
                  blockAlign="center"
                >
                  <InlineStack gap="300" blockAlign="center">
                    {product.featuredImage?.url && (
                      <Box width="50px" height="50px">
                        <img
                          src={product.featuredImage.url}
                          alt={product.featuredImage.altText || product.title}
                          style={{ width: "100%", height: "auto", borderRadius: 6 }}
                        />
                      </Box>
                    )}
                    <BlockStack spacing="none">
                      <Text fontWeight="medium">{product.title}</Text>
                      <Text variant="bodySm" tone="subdued">
                        ${product.price}
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  <Link
                    url={`https://${shop}/admin/products/${product.id.replace(
                      "gid://shopify/Product/",
                      ""
                    )}`}
                    target="_blank"
                  >
                    <Icon source={EditIcon} tone="base" />
                  </Link>
                </InlineStack>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <Text as="h2" variant="headingMd">
              Total Products: {products.length}
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
