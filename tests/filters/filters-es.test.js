import { test, expect } from "@playwright/test";

const API_ENDPOINTS = {
  GET_SPECS_DETAILS: "/api/get-specs-details",
  FORMAT_FILTERS_QUERY: "/api/format-filters-query",
  GET_DYNAMIC_FILTERS: "/api/get-dynamic-filters",
  PRODUCT_RELATED: (productName) => `/api/product/${productName}/related`,
  PRODUCT_ACCESSORIES: (productName) =>
    `/api/product/${productName}/accessories`,
  PRODUCT_DETAILS: (productName) => `/api/product/${productName}`,
};

const MOCK_ROUTES = {
  ELASTICSEARCH: "**/elasticsearch/**",
  DATABASE: "**/database/**",
};

const MOCK_RESPONSES = {
  ELASTICSEARCH: {
    hits: {
      hits: [
        {
          _source: {
            categoryId: "cat-123",
            spec: {
              name: "voltage",
              type: "string",
            },
          },
        },
      ],
    },
    aggregations: {
      uniq_values: {
        specs: {
          buckets: [
            {
              key_as_string: "voltage|string",
              doc_count: 10,
            },
            {
              key_as_string: "power|int",
              doc_count: 15,
            },
          ],
        },
      },
    },
  },

  DATABASE: [
    { title: "Electronics", slug: "electronics" },
    { title: "Accessories", slug: "accessories" },
  ],

  ELASTICSEARCH_EMPTY: {
    hits: { hits: [] },
    aggregations: {},
  },

  ELASTICSEARCH_ERROR: {
    error: "Elasticsearch connection failed",
  },
};

const TEST_DATA = {
  SPECS_DETAILS: {
    amplifyId: "test-category-id",
  },

  FILTER_QUERY: {
    amplifyId: "test-amp-id",
    aggregations: {
      "specs.voltage": {
        filter: {
          bool: {
            filter: [{ term: { "specs.name": "voltage" } }],
          },
        },
      },
    },
    filter: [{ term: { manufacturers: "Samsung" } }],
    should: [],
    baseAggregations: ["manufacturers", "product_type.name"],
    isStaticQuery: false,
  },

  DYNAMIC_FILTERS: {
    amplifyId: "test-category",
    manufacturers: ["Samsung", "Apple"],
    "specs.voltage": ["110V", "220V"],
  },

  EMPTY_CATEGORY: {
    amplifyId: "empty-category",
  },

  ERROR_TEST: {
    amplifyId: "test",
  },
};

const PRODUCT_NAMES = {
  TEST_PRODUCT: "Test Product 1",
};

const EXPECTED_PROPERTIES = {
  SPECS_DETAILS: ["categoryId", "specs"],
  SPEC_ITEM: ["name", "type"],
  FILTER_QUERY: ["query", "aggs"],
  QUERY_BOOL: ["must", "filter"],
  AGGREGATIONS: ["specs", "manufacturers"],
  FILTER_ITEM: ["field", "title", "values"],
  RELATED_PRODUCT: ["name", "subcategory", "favorManufacturer", "url"],
  ACCESSORY: ["name", "subcategory", "favorManufacturer", "url"],
  PRODUCT_DETAILS: [
    "name",
    "category",
    "subcategory",
    "manufacturers",
    "favorManufacturer",
    "description",
    "specs",
    "weight",
    "conditions",
  ],
};

const HTTP_STATUS = {
  OK: 200,
  SERVER_ERROR: 500,
};

test.describe("Filter ES Functions Tests", () => {
  const setupMockRoute = async (
    context,
    route,
    response,
    status = HTTP_STATUS.OK
  ) => {
    await context.route(route, (route) => {
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });
  };

  const setupDefaultMocks = async (context) => {
    await setupMockRoute(
      context,
      MOCK_ROUTES.ELASTICSEARCH,
      MOCK_RESPONSES.ELASTICSEARCH
    );
    await setupMockRoute(
      context,
      MOCK_ROUTES.DATABASE,
      MOCK_RESPONSES.DATABASE
    );
  };

  const makePostRequest = async (request, endpoint, data) => {
    return await request.post(endpoint, { data });
  };

  const makeGetRequest = async (request, endpoint) => {
    return await request.get(endpoint);
  };

  const expectSuccessfulResponse = async (response) => {
    expect(response.ok()).toBeTruthy();
    return await response.json();
  };

  const expectErrorResponse = async (response, expectedStatus) => {
    expect(response.status()).toBe(expectedStatus);
    return await response.json();
  };

  const validateObjectProperties = (obj, properties) => {
    properties.forEach((prop) => {
      expect(obj).toHaveProperty(prop);
    });
  };

  const validateArrayResponse = (result, itemValidator = null) => {
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0 && itemValidator) {
      itemValidator(result[0]);
    }
  };

  test.beforeEach(async ({ context }) => {
    await setupDefaultMocks(context);
  });

  test("should get specs details from ES correctly", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.GET_SPECS_DETAILS,
      TEST_DATA.SPECS_DETAILS
    );
    const result = await expectSuccessfulResponse(response);

    validateObjectProperties(result, EXPECTED_PROPERTIES.SPECS_DETAILS);
    expect(Array.isArray(result.specs)).toBe(true);
    expect(result.specs.length).toBeGreaterThan(0);
    validateObjectProperties(result.specs[0], EXPECTED_PROPERTIES.SPEC_ITEM);
  });

  test("should format filters query correctly", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.FORMAT_FILTERS_QUERY,
      TEST_DATA.FILTER_QUERY
    );
    const result = await expectSuccessfulResponse(response);

    validateObjectProperties(result, EXPECTED_PROPERTIES.FILTER_QUERY);
    validateObjectProperties(result.query, ["bool"]);
    validateObjectProperties(result.query.bool, EXPECTED_PROPERTIES.QUERY_BOOL);
    validateObjectProperties(result.aggs, EXPECTED_PROPERTIES.AGGREGATIONS);
  });

  test("should get dynamic filters with proper structure", async ({
    request,
  }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.GET_DYNAMIC_FILTERS,
      TEST_DATA.DYNAMIC_FILTERS
    );
    const result = await expectSuccessfulResponse(response);

    expect(result).toHaveProperty("filters");
    validateArrayResponse(result.filters, (filter) => {
      validateObjectProperties(filter, EXPECTED_PROPERTIES.FILTER_ITEM);
      expect(Array.isArray(filter.values)).toBe(true);
    });
  });

  test("should get related products from ES", async ({ request }) => {
    const response = await makeGetRequest(
      request,
      API_ENDPOINTS.PRODUCT_RELATED(PRODUCT_NAMES.TEST_PRODUCT)
    );
    const result = await expectSuccessfulResponse(response);

    validateArrayResponse(result, (relatedProduct) => {
      validateObjectProperties(
        relatedProduct,
        EXPECTED_PROPERTIES.RELATED_PRODUCT
      );
    });
  });

  test("should get product accessories from ES", async ({ request }) => {
    const response = await makeGetRequest(
      request,
      API_ENDPOINTS.PRODUCT_ACCESSORIES(PRODUCT_NAMES.TEST_PRODUCT)
    );
    const result = await expectSuccessfulResponse(response);

    validateArrayResponse(result, (accessory) => {
      validateObjectProperties(accessory, EXPECTED_PROPERTIES.ACCESSORY);
    });
  });

  test("should get product details from ES", async ({ request }) => {
    const response = await makeGetRequest(
      request,
      API_ENDPOINTS.PRODUCT_DETAILS(PRODUCT_NAMES.TEST_PRODUCT)
    );
    const result = await expectSuccessfulResponse(response);

    validateObjectProperties(result, EXPECTED_PROPERTIES.PRODUCT_DETAILS);
  });

  test("should handle ES errors gracefully", async ({ context, request }) => {
    await setupMockRoute(
      context,
      MOCK_ROUTES.ELASTICSEARCH,
      MOCK_RESPONSES.ELASTICSEARCH_ERROR,
      HTTP_STATUS.SERVER_ERROR
    );

    const response = await makePostRequest(
      request,
      API_ENDPOINTS.GET_SPECS_DETAILS,
      TEST_DATA.ERROR_TEST
    );
    const result = await expectErrorResponse(
      response,
      HTTP_STATUS.SERVER_ERROR
    );

    expect(result).toHaveProperty("error");
  });

  test("should validate filter query parameters", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.FORMAT_FILTERS_QUERY,
      TEST_DATA.FILTER_QUERY
    );
    const result = await expectSuccessfulResponse(response);

    validateObjectProperties(result, EXPECTED_PROPERTIES.FILTER_QUERY);
  });

  test("should handle empty filter results", async ({ context, request }) => {
    await setupMockRoute(
      context,
      MOCK_ROUTES.ELASTICSEARCH,
      MOCK_RESPONSES.ELASTICSEARCH_EMPTY
    );

    const response = await makePostRequest(
      request,
      API_ENDPOINTS.GET_DYNAMIC_FILTERS,
      TEST_DATA.EMPTY_CATEGORY
    );
    const result = await expectSuccessfulResponse(response);

    expect(result).toHaveProperty("filters");
    expect(Array.isArray(result.filters)).toBe(true);
  });
});
