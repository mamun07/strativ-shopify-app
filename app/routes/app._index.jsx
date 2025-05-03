import { useFetcher, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { useEffect, useState } from "react";

import {
  Page,
  IndexTable,
  Text,
  Layout,
  Button,
  Toast,
} from "@shopify/polaris";

// GraphQL query to fetch products
const GET_PRODUCTS_QUERY = `
  query {
    products(first: 10, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          status
          createdAt
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
`;

// GraphQL mutation to toggle product status
const UPDATE_PRODUCT_MUTATION = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Loader to fetch products
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const res = await admin.graphql(GET_PRODUCTS_QUERY);
  const data = await res.json();

  return {
    products: data.data.products.edges.map((edge) => edge.node),
  };
};

// Action to handle the status toggle
export const action = async ({ request }) => {
  const formData = new URLSearchParams(await request.text());
  const productId = formData.get("productId");
  const currentStatus = formData.get("currentStatus");

  const newStatus = currentStatus === "ACTIVE" ? "DRAFT" : "ACTIVE";

  const { admin } = await authenticate.admin(request);
  const res = await admin.graphql(UPDATE_PRODUCT_MUTATION, {
    variables: { input: { id: productId, status: newStatus } },
  });

  const data = await res.json();

  if (data.errors || data.data.productUpdate.userErrors.length) {
    return {
      error:
        data.errors?.[0]?.message ||
        data.data.productUpdate.userErrors?.[0]?.message ||
        "Failed to update product.",
    };
  }

  return { success: true };
};

// Main component
export default function Index() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();
  const [toast, setToast] = useState({ active: false, content: "" });
  const [submittingProductId, setSubmittingProductId] = useState(null);

  useEffect(() => {
    if (fetcher.state === "idle") {
      setSubmittingProductId(null); // reset loading state
    }

    if (fetcher.data?.success) {
      setToast({ active: true, content: "Product status updated!" });
    } else if (fetcher.data?.error) {
      setToast({ active: true, content: fetcher.data.error });
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <Page title="Latest Products" fullWidth>
      <Layout>
        <Layout.Section>
          <IndexTable
            resourceName={{ singular: "product", plural: "products" }}
            itemCount={products.length}
            headings={[
              { title: "SL" },
              { title: "Title" },
              { title: "Status" },
              { title: "Price" },
              { title: "Published" },
              { title: "Actions" },
            ]}
            selectable={false}
          >
            {products.map((product, index) => {
              const variant = product.variants.edges[0]?.node;
              return (
                <IndexTable.Row
                  id={product.id}
                  key={product.id}
                  position={index}
                >
                  <IndexTable.Cell>
                    <Text>{index + 1}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" fontWeight="bold">
                      {product.title}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{product.status}</IndexTable.Cell>
                  <IndexTable.Cell>
                    {variant?.price} {variant?.currencyCode}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {new Date(product.createdAt).toLocaleString()}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <fetcher.Form method="post">
                      <input type="hidden" name="productId" value={product.id} />
                      <input
                        type="hidden"
                        name="currentStatus"
                        value={product.status}
                      />
                      <Button
                        submit
                        primary
                        onClick={() => setSubmittingProductId(product.id)}
                        loading={
                          fetcher.state === "submitting" &&
                          submittingProductId === product.id
                        }
                        disabled={
                          fetcher.state === "submitting" &&
                          submittingProductId === product.id
                        }
                      >
                        Toggle to {product.status === "ACTIVE" ? "Draft" : "Active"}
                      </Button>
                    </fetcher.Form>
                  </IndexTable.Cell>
                </IndexTable.Row>
              );
            })}
          </IndexTable>
        </Layout.Section>
      </Layout>

      {toast.active && (
        <Toast
          content={toast.content}
          onDismiss={() => setToast({ ...toast, active: false })}
        />
      )}
    </Page>
  );
}
