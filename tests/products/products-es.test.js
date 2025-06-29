import { test, expect } from "@playwright/test";

const API_ENDPOINTS = {
  PRODUCT_LIST: "/api/product-list",
  PRODUCT_DETAILS: (productName) => `/api/product/${productName}`,
  PRODUCT_RELATED: (productName) => `/api/product/${productName}/related`,
  PRODUCT_ACCESSORIES: (productName) =>
    `/api/product/${productName}/accessories`,
  GET_SPECS_DETAILS: "/api/get-specs-details",
  GET_DYNAMIC_FILTERS: "/api/get-dynamic-filters",
};

const MOCK_ROUTES = {
  ELASTICSEARCH_PRODUCTS: "**/elasticsearch/products/**",
  ELASTICSEARCH_SUBCATEGORIES: "**/elasticsearch/subcategories/**",
  ELASTICSEARCH_ALL: "**/elasticsearch/**",
  CACHE: "**/cache/**",
};

const MOCK_RESPONSES = {
  PRODUCTS_SUCCESS: {
    hits: {
      hits: [
        {
          _source: {
            name: "Samsung Galaxy Phone",
            category: { name: "Electronics", slug: "electronics", id: "cat-1" },
            subcategory: {
              name: "Mobile Phones",
              slug: "mobile-phones",
              id: "subcat-1",
            },
            product_type: { name: "Smartphone" },
            manufacturers: ["Samsung", "Apple"],
            favorManufacturer: "Samsung",
            weight: 0.5,
            online: true,
            is_deleted: false,
            specs: [
              { name: "voltage", valueString: "5V" },
              { name: "power", valueInt: 25 },
              { name: "storage", valueInt: 128 },
            ],
            prices: [
              {
                condition: "newInBox",
                domain: "Electrical.com",
                type: "Default Price",
                value: 899.99,
              },
            ],
            inventory: [{ condition: "newInBox", value: 50 }],
            Accessories: [
              { name: "Phone Case", subCategoryId: "acc-1" },
              { name: "Screen Protector", subCategoryId: "acc-2" },
            ],
          },
        },
        {
          _source: {
            name: "iPhone 13 Pro",
            category: { name: "Electronics", slug: "electronics", id: "cat-1" },
            subcategory: {
              name: "Mobile Phones",
              slug: "mobile-phones",
              id: "subcat-1",
            },
            product_type: { name: "Smartphone" },
            manufacturers: ["Apple"],
            favorManufacturer: "Apple",
            weight: 0.6,
            online: true,
            is_deleted: false,
            specs: [
              { name: "voltage", valueString: "5V" },
              { name: "power", valueInt: 20 },
              { name: "storage", valueInt: 256 },
            ],
          },
        },
      ],
      total: { value: 2 },
    },
    aggregations: {
      manufacturers: {
        buckets: [
          { key: "Samsung", doc_count: 15 },
          { key: "Apple", doc_count: 12 },
        ],
      },
      "product_type.name": {
        buckets: [
          { key: "Smartphone", doc_count: 20 },
          { key: "Tablet", doc_count: 8 },
        ],
      },
      specs: {
        "specs.voltage": {
          unique_values: {
            buckets: [
              { key: "5V", doc_count: 25 },
              { key: "12V", doc_count: 5 },
            ],
          },
        },
        "specs.power": {
          unique_values: {
            buckets: [
              { key: 20, doc_count: 12 },
              { key: 25, doc_count: 13 },
            ],
          },
        },
      },
    },
  },

  SUBCATEGORIES_SUCCESS: {
    hits: {
      hits: [
        {
          _source: {
            categoryId: "cat-electronics",
            spec: { name: "voltage", type: "string" },
          },
        },
      ],
    },
    aggregations: {
      uniq_values: {
        specs: {
          buckets: [
            { key_as_string: "voltage|string", doc_count: 10 },
            { key_as_string: "power|int", doc_count: 8 },
          ],
        },
      },
    },
  },

  CACHE_SUCCESS: {
    domains: { res: [{ name: "Electrical.com" }] },
    leadTimeDomains: { res: [] },
    cutoffDomains: { res: [] },
  },

  PRODUCTS_EMPTY: {
    hits: { hits: [], total: { value: 0 } },
    aggregations: {},
  },

  PRODUCTS_NOT_FOUND: {
    hits: { hits: [], total: { value: 0 } },
  },

  ELASTICSEARCH_ERROR: {
    error: "Elasticsearch connection failed",
  },
};

const TEST_DATA = {
  BASIC_FILTERING: {
    page: 1,
    size: 10,
    manufacturers: ["Samsung"],
  },

  ADVANCED_FILTERING: {
    page: 1,
    size: 5,
    manufacturers: ["Samsung", "Apple"],
    "specs.voltage": ["5V"],
    "specs.power": [20, 25],
    sortByPrice: "asc",
    inStock: true,
    search_text: "phone",
  },

  MANUFACTURER_SORTING: {
    page: 1,
    size: 10,
    sortByManuf: "asc",
  },

  MANUFACTURER_SORTING_DESC: {
    page: 1,
    size: 10,
    sortByManuf: "desc",
  },

  PRICE_SORTING_DESC: {
    sortByPrice: "desc",
    page: 1,
    size: 10,
  },

  COUNT_ONLY: {
    count: true,
    manufacturers: ["Samsung"],
  },

  PAGINATION_PAGE_2: {
    page: 2,
    size: 1,
  },

  LARGE_PAGE: {
    page: 1000,
    size: 10,
  },

  RELEVANCE_FILTERING: {
    relevant: "Samsung Galaxy Phone",
    page: 1,
    size: 10,
  },

  COMPLEX_SPECS: {
    "specs.voltage": ["5V", "12V"],
    "specs.power": [20],
    "specs.storage": [128, 256],
  },

  SEARCH_TEXT: {
    search_text: "Samsung",
    page: 1,
    size: 10,
  },

  IN_STOCK: {
    inStock: true,
    page: 1,
    size: 10,
  },

  INVALID_PARAMS: {
    page: "invalid",
    size: "invalid",
    sortByPrice: "invalid",
  },

  EMPTY_QUERY: {},

  SPECS_DETAILS: {
    amplifyId: "cat-electronics",
  },

  DYNAMIC_FILTERS: {
    amplifyId: "cat-electronics",
    manufacturers: ["Samsung", "Apple"],
    "specs.voltage": ["5V"],
    "specs.power": [20, 25],
  },

  BASIC_LIST: {
    page: 1,
    size: 10,
  },

  SINGLE_ITEM: {
    page: 1,
    size: 1,
  },
};

const EXPECTED_VALUES = {
  PRODUCT_NAME: "Samsung Galaxy Phone",
  ENCODED_PRODUCT_NAME: "Samsung%20Galaxy%20Phone",
  TOTAL_COUNT: 2,
  HTTP_STATUS: {
    OK: 200,
    SERVER_ERROR: 500,
  },
};

const REQUIRED_PROPERTIES = {
  PRODUCT_LIST: ["records", "count"],
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
  PRODUCT_BASIC: [
    "name",
    "category",
    "subcategory",
    "manufacturers",
    "favorManufacturer",
    "url",
    "image",
  ],
  RELATED_PRODUCT: ["name", "subcategory", "favorManufacturer", "url"],
  CATEGORY_NESTED: ["name", "slug"],
  SPEC_ITEM: ["name", "value"],
  SPECS_DETAILS: ["categoryId", "specs"],
  SPEC_DEFINITION: ["name", "type"],
  DYNAMIC_FILTERS: ["filters"],
};

test.describe("Product ES Functions Tests", () => {
  const setupMockRoute = async (
    context,
    route,
    response,
    status = EXPECTED_VALUES.HTTP_STATUS.OK
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
      MOCK_ROUTES.ELASTICSEARCH_PRODUCTS,
      MOCK_RESPONSES.PRODUCTS_SUCCESS
    );
    await setupMockRoute(
      context,
      MOCK_ROUTES.ELASTICSEARCH_SUBCATEGORIES,
      MOCK_RESPONSES.SUBCATEGORIES_SUCCESS
    );
    await setupMockRoute(
      context,
      MOCK_ROUTES.CACHE,
      MOCK_RESPONSES.CACHE_SUCCESS
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

  const validateArrayResponse = (result, validator = null) => {
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0 && validator) {
      validator(result[0]);
    }
  };

  const validateProductListResponse = (result) => {
    validateObjectProperties(result, REQUIRED_PROPERTIES.PRODUCT_LIST);
    expect(Array.isArray(result.records)).toBe(true);
    expect(typeof result.count).toBe("number");

    if (result.records.length > 0) {
      validateObjectProperties(
        result.records[0],
        REQUIRED_PROPERTIES.PRODUCT_BASIC
      );
    }
  };

  const validateProductDetailsResponse = (
    result,
    expectedName = EXPECTED_VALUES.PRODUCT_NAME
  ) => {
    validateObjectProperties(result, REQUIRED_PROPERTIES.PRODUCT_DETAILS);
    expect(result.name).toBe(expectedName);

    if (result.category) {
      validateObjectProperties(
        result.category,
        REQUIRED_PROPERTIES.CATEGORY_NESTED
      );
    }

    if (result.subcategory) {
      validateObjectProperties(
        result.subcategory,
        REQUIRED_PROPERTIES.CATEGORY_NESTED
      );
    }

    if (result.specs && result.specs.length > 0) {
      validateObjectProperties(result.specs[0], REQUIRED_PROPERTIES.SPEC_ITEM);
    }
  };

  const validateRelatedProductsResponse = (result) => {
    validateArrayResponse(result, (product) => {
      validateObjectProperties(product, REQUIRED_PROPERTIES.RELATED_PRODUCT);
    });
  };

  const validateSpecsDetailsResponse = (result) => {
    validateObjectProperties(result, REQUIRED_PROPERTIES.SPECS_DETAILS);
    expect(Array.isArray(result.specs)).toBe(true);

    if (result.specs.length > 0) {
      validateObjectProperties(
        result.specs[0],
        REQUIRED_PROPERTIES.SPEC_DEFINITION
      );
    }
  };

  const validateDynamicFiltersResponse = (result) => {
    validateObjectProperties(result, REQUIRED_PROPERTIES.DYNAMIC_FILTERS);
    expect(Array.isArray(result.filters)).toBe(true);
  };

  const validateCountOnlyResponse = (result) => {
    expect(result).toHaveProperty("count");
    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThanOrEqual(0);
  };

  const validateManufacturerFiltering = (records) => {
    records.forEach((product) => {
      expect(
        product.manufacturers.includes("Samsung") ||
          product.favorManufacturer === "Samsung"
      ).toBe(true);
    });
  };

  const validateProductDataTypes = (product) => {
    expect(typeof product.name).toBe("string");
    expect(typeof product.category).toBe("string");
    expect(typeof product.subcategory).toBe("string");
    expect(Array.isArray(product.manufacturers)).toBe(true);
    expect(typeof product.favorManufacturer).toBe("string");
    expect(typeof product.url).toBe("string");
    expect(typeof product.image).toBe("string");
  };

  test.beforeEach(async ({ context }) => {
    await setupDefaultMocks(context);
  });

  test("should get product list with basic filtering", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.BASIC_FILTERING
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
    expect(result.count).toBe(EXPECTED_VALUES.TOTAL_COUNT);
  });

  test("should get product list with advanced filtering", async ({
    request,
  }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.ADVANCED_FILTERING
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
    expect(result.records.length).toBeLessThanOrEqual(5);
  });

  test("should get product list with sorting", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.MANUFACTURER_SORTING
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
  });

  test("should get product count only", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.COUNT_ONLY
    );
    const result = await expectSuccessfulResponse(response);

    validateCountOnlyResponse(result);
  });

  test("should get product details", async ({ request }) => {
    const response = await makeGetRequest(
      request,
      API_ENDPOINTS.PRODUCT_DETAILS(EXPECTED_VALUES.PRODUCT_NAME)
    );
    const result = await expectSuccessfulResponse(response);

    validateProductDetailsResponse(result);
  });

  test("should get related products", async ({ request }) => {
    const response = await makeGetRequest(
      request,
      API_ENDPOINTS.PRODUCT_RELATED(EXPECTED_VALUES.PRODUCT_NAME)
    );
    const result = await expectSuccessfulResponse(response);

    validateRelatedProductsResponse(result);
  });

  test("should get product accessories", async ({ request }) => {
    const response = await makeGetRequest(
      request,
      API_ENDPOINTS.PRODUCT_ACCESSORIES(EXPECTED_VALUES.PRODUCT_NAME)
    );
    const result = await expectSuccessfulResponse(response);

    validateArrayResponse(result);
  });

  test("should handle product not found", async ({ context, request }) => {
    await setupMockRoute(
      context,
      MOCK_ROUTES.ELASTICSEARCH_PRODUCTS,
      MOCK_RESPONSES.PRODUCTS_NOT_FOUND
    );

    const response = await makeGetRequest(
      request,
      API_ENDPOINTS.PRODUCT_DETAILS("NonExistentProduct")
    );
    const result = await expectSuccessfulResponse(response);

    expect(result).toEqual({});
  });

  test("should handle elasticsearch errors", async ({ context, request }) => {
    await setupMockRoute(
      context,
      MOCK_ROUTES.ELASTICSEARCH_ALL,
      MOCK_RESPONSES.ELASTICSEARCH_ERROR,
      EXPECTED_VALUES.HTTP_STATUS.SERVER_ERROR
    );

    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.BASIC_LIST
    );
    await expectErrorResponse(
      response,
      EXPECTED_VALUES.HTTP_STATUS.SERVER_ERROR
    );
  });

  test("should validate filter parameters", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.INVALID_PARAMS
    );
    const result = await expectErrorResponse(
      response,
      EXPECTED_VALUES.HTTP_STATUS.SERVER_ERROR
    );
    expect(result).toHaveProperty("error");
  });

  test("should handle pagination correctly", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.PAGINATION_PAGE_2
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
    expect(result.records.length).toBeLessThanOrEqual(1);
  });

  test("should filter by relevance", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.RELEVANCE_FILTERING
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
  });

  test("should handle complex specs filtering", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.COMPLEX_SPECS
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
  });

  test("should handle search text filtering", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.SEARCH_TEXT
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
  });

  test("should handle in-stock filtering", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.IN_STOCK
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
  });

  test("should handle price sorting", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.PRICE_SORTING_DESC
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
  });

  test("should handle manufacturer sorting", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.MANUFACTURER_SORTING_DESC
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
  });

  test("should get specs details correctly", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.GET_SPECS_DETAILS,
      TEST_DATA.SPECS_DETAILS
    );
    const result = await expectSuccessfulResponse(response);

    validateSpecsDetailsResponse(result);
  });

  test("should format product data correctly", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.SINGLE_ITEM
    );
    const result = await expectSuccessfulResponse(response);

    if (result.records.length > 0) {
      const product = result.records[0];
      validateObjectProperties(product, REQUIRED_PROPERTIES.PRODUCT_BASIC);
      validateProductDataTypes(product);
    }
  });

  test("should handle empty results gracefully", async ({
    context,
    request,
  }) => {
    await setupMockRoute(
      context,
      MOCK_ROUTES.ELASTICSEARCH_PRODUCTS,
      MOCK_RESPONSES.PRODUCTS_EMPTY
    );

    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.BASIC_LIST
    );
    const result = await expectSuccessfulResponse(response);

    expect(result.records).toEqual([]);
    expect(result.count).toBe(0);
  });

  test("should validate query structure", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.EMPTY_QUERY
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
  });

  test("should handle large page numbers", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.LARGE_PAGE
    );
    const result = await expectSuccessfulResponse(response);

    validateProductListResponse(result);
  });

  test("should handle product detail with all fields", async ({ request }) => {
    const response = await makeGetRequest(
      request,
      API_ENDPOINTS.PRODUCT_DETAILS(EXPECTED_VALUES.PRODUCT_NAME)
    );
    const result = await expectSuccessfulResponse(response);

    validateProductDetailsResponse(result);
  });

  test("should handle URL encoding in product names", async ({ request }) => {
    const response = await makeGetRequest(
      request,
      API_ENDPOINTS.PRODUCT_DETAILS(EXPECTED_VALUES.ENCODED_PRODUCT_NAME)
    );
    const result = await expectSuccessfulResponse(response);

    expect(result.name).toBe(EXPECTED_VALUES.PRODUCT_NAME);
  });

  test("should validate manufacturer filtering works correctly", async ({
    request,
  }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.PRODUCT_LIST,
      TEST_DATA.BASIC_FILTERING
    );
    const result = await expectSuccessfulResponse(response);

    validateManufacturerFiltering(result.records);
  });

  test("should handle complex aggregation queries", async ({ request }) => {
    const response = await makePostRequest(
      request,
      API_ENDPOINTS.GET_DYNAMIC_FILTERS,
      TEST_DATA.DYNAMIC_FILTERS
    );
    const result = await expectSuccessfulResponse(response);

    validateDynamicFiltersResponse(result);
  });
});
