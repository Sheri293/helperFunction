import { test, expect } from "@playwright/test";

const API_ENDPOINTS = {
  CONVERT_NUMBER: "/api/test-convert-number",
  VALIDATE_FIELDS: "/api/validate-required-fields",
  CLEAN_VALUES: "/api/clean-values",
  SET_ORDER_ID: "/api/set-order-id",
  SET_SHIPPING_WEIGHT: "/api/set-shipping-weight",
  CHECKOUT_COMPLETE: "/api/checkout/complete",
};

const TEST_DATA = {
  VALID_ORDER: {
    firstName: "John",
    lastName: "Doe",
    email: "john@test.com",
    phone: "1234567890",
    billingStreet: "123 Main St",
    billingCity: "City",
    billingZip: "12345",
    billingState: "CA",
    billingCountry: "US",
    shippingStreet: "123 Main St",
    shippingCity: "City",
    shippingZip: "12345",
    shippingState: "CA",
    shippingCountry: "US",
    shippingMethod: "Ground",
    shippingRate: 15.99,
    cardName: "John Doe",
    cardNumber: "1234567890123456",
    cardExp: "12/25",
    taxRate: 8.25,
    items: [{ name: "Product", condition: "New", quantity: 1, rate: "99.99" }],
  },

  COMPLETE_ORDER: {
    firstName: "John",
    lastName: "Doe",
    email: "john@test.com",
    phone: "1234567890",
    billingStreet: "123 Billing St",
    billingCity: "Billing City",
    billingZip: "12345",
    billingState: "CA",
    billingCountry: "US",
    shippingStreet: "456 Shipping Ave",
    shippingCity: "Shipping City",
    shippingZip: "67890",
    shippingState: "NY",
    shippingCountry: "US",
    shippingMethod: "Ground",
    shippingRate: 15.99,
    cardName: "John Doe",
    cardNumber: "4111111111111111",
    cardExp: "12/26",
    taxRate: 8.25,
    items: [
      {
        name: "Test Product 1",
        condition: "New",
        quantity: 2,
        rate: "99.99",
      },
    ],
  },

  INVALID_ORDER: {
    firstName: "John",
    email: "john@test.com",
  },

  INCOMPLETE_ORDER: {
    firstName: "John",
    email: "john@test.com",
    items: [],
  },

  DIRTY_DATA: {
    name: 'John<script>alert("xss")</script>',
    company: "Test & Co.",
  },

  EDGE_CASE_DATA: {
    nested: {
      field: "value<>with&special*chars",
    },
    array: ["item1", "item2"],
    number: 123,
    boolean: true,
    nullValue: null,
  },

  ORDER_WITH_WEIGHTS: {
    items: [
      { weight: 2.5, quantity: 2 },
      { weight: 1.0, quantity: 1 },
    ],
  },

  ORDER_NO_WEIGHTS: {
    items: [{ quantity: 2 }, { quantity: 1 }],
  },
};

const EXPECTED_VALUES = {
  CONVERTED_NUMBER: 1234.56,
  CONVERTED_UNCHANGED: 1000,
  CALCULATED_WEIGHT: 6.0,
  DEFAULT_WEIGHT: 1,
  VALIDATION_ERROR: "Missing required fields",
  BAD_REQUEST_STATUS: 400,
};

test.describe("Simple Checkout Helper Functions", () => {
  let baseURL;

  test.beforeAll(async () => {
    baseURL = process.env.BASE_URL || "http://localhost:3001";
  });

  const makeRequest = async (request, endpoint, data) => {
    return await request.post(`${baseURL}${endpoint}`, { data });
  };

  const expectSuccessfulResponse = async (response) => {
    expect(response.ok()).toBeTruthy();
    return await response.json();
  };

  test("convertNumberWithComma should work via API", async ({ request }) => {
    const response = await makeRequest(request, API_ENDPOINTS.CONVERT_NUMBER, {
      input: "1,234.56",
    });

    const result = await expectSuccessfulResponse(response);
    expect(result.converted).toBe(EXPECTED_VALUES.CONVERTED_NUMBER);
  });

  test("should handle number input for convertNumberWithComma", async ({
    request,
  }) => {
    const response = await makeRequest(request, API_ENDPOINTS.CONVERT_NUMBER, {
      input: 1000,
    });

    const result = await expectSuccessfulResponse(response);
    expect(result.converted).toBe(EXPECTED_VALUES.CONVERTED_UNCHANGED);
  });

  test("requiredFieldsOk should validate correctly", async ({ request }) => {
    const response = await makeRequest(
      request,
      API_ENDPOINTS.VALIDATE_FIELDS,
      TEST_DATA.VALID_ORDER
    );

    const result = await expectSuccessfulResponse(response);
    expect(result.valid).toBe(true);
  });

  test("requiredFieldsOk should fail with missing fields", async ({
    request,
  }) => {
    const response = await makeRequest(
      request,
      API_ENDPOINTS.VALIDATE_FIELDS,
      TEST_DATA.INVALID_ORDER
    );

    const result = await expectSuccessfulResponse(response);
    expect(result.valid).toBeFalsy();
  });

  test("cleanValues should sanitize input", async ({ request }) => {
    const response = await makeRequest(
      request,
      API_ENDPOINTS.CLEAN_VALUES,
      TEST_DATA.DIRTY_DATA
    );

    const result = await expectSuccessfulResponse(response);
    expect(result.cleaned.name).not.toContain("<script>");
    expect(result.cleaned.company).toBe("Test & Co.");
  });

  test("setOrderId should generate unique IDs", async ({ request }) => {
    const testOrder = { test: "data" };

    const [response1, response2] = await Promise.all([
      makeRequest(request, API_ENDPOINTS.SET_ORDER_ID, testOrder),
      makeRequest(request, API_ENDPOINTS.SET_ORDER_ID, testOrder),
    ]);

    expect(response1.ok()).toBeTruthy();
    expect(response2.ok()).toBeTruthy();

    const result1 = await response1.json();
    const result2 = await response2.json();

    expect(result1.orderId).toBeDefined();
    expect(result2.orderId).toBeDefined();
    expect(result1.orderId).not.toBe(result2.orderId);
  });

  test("setShippingWeight should calculate correctly", async ({ request }) => {
    const response = await makeRequest(
      request,
      API_ENDPOINTS.SET_SHIPPING_WEIGHT,
      TEST_DATA.ORDER_WITH_WEIGHTS
    );

    const result = await expectSuccessfulResponse(response);
    expect(result.shippingWeight).toBe(EXPECTED_VALUES.CALCULATED_WEIGHT);
  });

  test("setShippingWeight should handle missing weight", async ({
    request,
  }) => {
    const response = await makeRequest(
      request,
      API_ENDPOINTS.SET_SHIPPING_WEIGHT,
      TEST_DATA.ORDER_NO_WEIGHTS
    );

    const result = await expectSuccessfulResponse(response);
    expect(result.shippingWeight).toBe(EXPECTED_VALUES.DEFAULT_WEIGHT);
  });

  test("complete checkout flow should work", async ({ request }) => {
    const response = await makeRequest(
      request,
      API_ENDPOINTS.CHECKOUT_COMPLETE,
      TEST_DATA.COMPLETE_ORDER
    );

    const result = await expectSuccessfulResponse(response);

    expect(result.orderId).toBeDefined();
    expect(result.subtotal).toBeGreaterThan(0);
    expect(result.shippingWeight).toBeGreaterThan(0);
    expect(result.taxRate).toBeDefined();
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.netsuiteSuccess).toBe(true);
    expect(result.orderSaved).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.yotpoCreated).toBe(true);
    expect(result.klaviyoSubscribed).toBe(true);
  });

  test("should handle checkout with missing required fields", async ({
    request,
  }) => {
    const response = await makeRequest(
      request,
      API_ENDPOINTS.CHECKOUT_COMPLETE,
      TEST_DATA.INCOMPLETE_ORDER
    );

    expect(response.status()).toBe(EXPECTED_VALUES.BAD_REQUEST_STATUS);
    const result = await response.json();
    expect(result.error).toBe(EXPECTED_VALUES.VALIDATION_ERROR);
  });

  test("should handle edge cases for cleanValues", async ({ request }) => {
    const response = await makeRequest(
      request,
      API_ENDPOINTS.CLEAN_VALUES,
      TEST_DATA.EDGE_CASE_DATA
    );

    const result = await expectSuccessfulResponse(response);

    expect(result.cleaned.nested.field).not.toContain("<>");
    expect(result.cleaned.nested.field).not.toContain("*");
    expect(result.cleaned.array).toEqual(["item1", "item2"]);
    expect(result.cleaned.number).toBe(123);
    expect(result.cleaned.boolean).toBe(true);
    expect(result.cleaned.nullValue).toBe(null);
  });
});
