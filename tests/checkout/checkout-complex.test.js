import { test, expect } from "@playwright/test";

const MOCK_RESPONSES = {
  ELASTICSEARCH: {
    status: 200,
    contentType: "application/json",
    body: {
      hits: {
        hits: [
          {
            _source: {
              name: "Test Product",
              weight: 2.5,
            },
          },
        ],
      },
    },
  },
};

const TEST_DATA = {
  ORDER: {
    firstName: "John",
    lastName: "Doe",
    email: "john@test.com",
    phone: "1234567890",
    shippingRate: 15.99,
    taxRate: 8.25,
    items: [
      {
        name: "Test Product",
        condition: "New",
        quantity: 1,
        rate: "99.99",
      },
    ],
  },
};

const API_ENDPOINTS = {
  CHECKOUT_COMPLETE: "/api/checkout/complete",
  ELASTICSEARCH: "**/elasticsearch/**",
};

const setupElasticsearchMock = async (context) => {
  await context.route(API_ENDPOINTS.ELASTICSEARCH, (route) => {
    route.fulfill({
      ...MOCK_RESPONSES.ELASTICSEARCH,
      body: JSON.stringify(MOCK_RESPONSES.ELASTICSEARCH.body),
    });
  });
};

const performCheckoutRequest = async (request, orderData = TEST_DATA.ORDER) => {
  return await request.post(API_ENDPOINTS.CHECKOUT_COMPLETE, {
    data: orderData,
  });
};

const validateCheckoutResponse = async (response) => {
  expect(response.ok()).toBeTruthy();

  const result = await response.json();
  expect(result.orderId).toBeDefined();
  expect(result.subtotal).toBeGreaterThan(0);

  return result;
};

test.describe("Complex Functions with Mocks", () => {
  test.beforeEach(async ({ context }) => {
    await setupElasticsearchMock(context);
  });

  test("should handle complex checkout flow", async ({ request }) => {
    const response = await performCheckoutRequest(request);
    await validateCheckoutResponse(response);
  });
});
