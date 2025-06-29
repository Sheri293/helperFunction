import { test, expect } from "@playwright/test";

const API_ENDPOINTS = {
  CAPITALIZE_WORDS: "/api/capitalize-words",
  LIKE_NAME: "/api/like-name",
  FORMAT_MANUFACTURERS: "/api/format-manufacturers",
  FORMAT_MANUFACTURER_OBJECT: "/api/format-manufacturer-object",
  FORMATE_SHOULD_ARRAY: "/api/formate-should-array",
  GET_BASIC_AGGREGATIONS: "/api/get-basic-aggregations",
  CLIP_PARAMS: "/api/clip-params",
  NONEXISTENT_ENDPOINT: "/api/nonexistent-endpoint",
};

const TEST_DATA = {
  CAPITALIZE_WORDS: {
    CAMEL_CASE: { text: "firstName" },
    UNDERSCORE: { text: "first_name" },
    EDGE_CASES: ["", null, undefined],
    ALREADY_CAPITALIZED: { text: "Product" },
    SINGLE_WORD: { text: "product" },
    INVALID_FIELD: { invalidField: "test" },
  },

  LIKE_NAME: {
    BASIC: { name: "Samsung Galaxy Phone", type: "Phone" },
    STARTS_WITH_TYPE: { name: "Phone Samsung Galaxy", type: "Phone" },
    SPECIAL_CHARS: { name: "Product-Name@123!", type: "Product" },
    EMPTY_NAME: { name: "", type: "Product" },
    WITH_SPACES: { name: "Product Name With Spaces", type: "Product" },
  },

  MANUFACTURERS: {
    SINGLE_STRING: { manufacturers: "Samsung Electronics" },
    ARRAY: { manufacturers: ["Samsung Electronics", "Apple Inc"] },
    SINGLE_WORD: { manufacturers: "Samsung" },
    EDGE_CASES: ["", null, undefined],
  },

  MANUFACTURER_OBJECTS: {
    WITH_DISTRIBUTOR: {
      manufacturers: [
        { name: "Samsung", country: "Korea", authorized_distributor: true },
        { name: "Apple", country: "USA", authorized_distributor: false },
      ],
    },
    EMPTY_ARRAY: { manufacturers: [] },
  },

  SHOULD_ARRAY: {
    BASIC_SPECS: {
      specs: [{ name: "voltage" }, { name: "current" }, { name: "power" }],
    },
    EMPTY_SPECS: { specs: [] },
    COMPLEX_NAMES: {
      specs: [
        { name: "voltage-rating" },
        { name: "power_consumption" },
        { name: "current.max" },
      ],
    },
  },

  BASIC_AGGREGATIONS: {
    STANDARD: {
      aggregations: ["manufacturers", "product_type.name", "familyNames"],
      isStaticQuery: false,
    },
    STATIC_QUERY: {
      aggregations: ["subcategory.name"],
      isStaticQuery: true,
    },
    EMPTY: {
      aggregations: [],
      isStaticQuery: false,
    },
    SIZE_CHECK: {
      aggregations: ["manufacturers", "product_type.name"],
      isStaticQuery: false,
    },
  },

  CLIP_PARAMS: {
    MIXED_PARAMS: {
      category: "electronics",
      subcategory: "phones",
      slug: "test-slug",
      amplifyId: "amp-123",
      count: 10,
      search_text: "samsung",
      validParam: "keep-this",
      manufacturers: ["Samsung", "Apple"],
      "specs.voltage": ["110V", "220V"],
    },
    EMPTY: {},
    ONLY_UNWANTED: {
      category: "electronics",
      slug: "test-slug",
      count: 10,
    },
    COMPLEX_NAMES: {
      "specs.voltage": ["110V"],
      "specs.power.rating": ["100W"],
      "product_type.name": "Electronics",
      category: "remove-this",
    },
  },

  ERROR_TEST: { test: "data" },
};

const EXPECTED_VALUES = {
  CAPITALIZE_WORDS: {
    FIRST_NAME: "First Name",
    PRODUCT: "Product",
    NULL: null,
  },

  LIKE_NAME: {
    SAMSUNG_GALAXY: "Samsung Galaxy",
  },

  MANUFACTURERS: {
    SAMSUNG_ELECTRONICS: "Samsung Electronics",
    SAMSUNG_ELECTRONICS_HYPHEN: "Samsung-Electronics",
    APPLE_INC: "Apple Inc",
    APPLE_INC_HYPHEN: "Apple-Inc",
    SAMSUNG_ONLY: ["Samsung"],
    EMPTY: [],
  },

  SHOULD_ARRAY: {
    VOLTAGE_TERM: { term: { "specs.name": "voltage" } },
    CURRENT_TERM: { term: { "specs.name": "current" } },
    POWER_TERM: { term: { "specs.name": "power" } },
    VOLTAGE_RATING_TERM: { term: { "specs.name": "voltage-rating" } },
    POWER_CONSUMPTION_TERM: { term: { "specs.name": "power_consumption" } },
    CURRENT_MAX_TERM: { term: { "specs.name": "current.max" } },
  },

  AGGREGATIONS: {
    SIZE: 500,
    SUBCATEGORY_FIELDS: ["subcategory.name", "subcategory.slug"],
  },

  CLIP_PARAMS: {
    VALID_PARAM: "keep-this",
  },

  HTTP_STATUS: {
    NOT_FOUND: 404,
  },
};

const UNWANTED_PROPERTIES = [
  "category",
  "subcategory",
  "slug",
  "amplifyId",
  "count",
  "search_text",
];

const REQUIRED_PROPERTIES = {
  MANUFACTURER_FORMATTED: ["name", "country"],
  AGGREGATION_TERMS: ["terms"],
  SUBCATEGORY_MULTI_TERMS: ["multi_terms"],
};

test.describe("Filter Helper Functions Tests", () => {
  let baseURL;

  test.beforeAll(async () => {
    baseURL = process.env.BASE_URL || "http://localhost:3001";
  });

  const makePostRequest = async (request, endpoint, data) => {
    return await request.post(`${baseURL}${endpoint}`, { data });
  };

  const expectSuccessfulResponse = async (response) => {
    expect(response.ok()).toBeTruthy();
    return await response.json();
  };

  const expectErrorResponse = async (response, expectedStatus) => {
    expect(response.status()).toBe(expectedStatus);
    return await response.json();
  };

  const testCapitalizeWordsEdgeCases = async (request) => {
    for (const testCase of TEST_DATA.CAPITALIZE_WORDS.EDGE_CASES) {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CAPITALIZE_WORDS,
        { text: testCase }
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.capitalized).toBe(EXPECTED_VALUES.CAPITALIZE_WORDS.NULL);
    }
  };

  const testManufacturerEdgeCases = async (request) => {
    for (const testCase of TEST_DATA.MANUFACTURERS.EDGE_CASES) {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.FORMAT_MANUFACTURERS,
        { manufacturers: testCase }
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.formatted).toEqual(EXPECTED_VALUES.MANUFACTURERS.EMPTY);
    }
  };

  const validateAggregationSizes = (result) => {
    Object.values(result).forEach((agg) => {
      expect(agg.terms.size).toBe(EXPECTED_VALUES.AGGREGATIONS.SIZE);
    });
  };

  const validateNoUnwantedProperties = (clipped) => {
    UNWANTED_PROPERTIES.forEach((prop) => {
      expect(clipped).not.toHaveProperty(prop);
    });
  };

  test.describe("capitalizeWords via API", () => {
    test("should capitalize camelCase words", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CAPITALIZE_WORDS,
        TEST_DATA.CAPITALIZE_WORDS.CAMEL_CASE
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.capitalized).toBe(
        EXPECTED_VALUES.CAPITALIZE_WORDS.FIRST_NAME
      );
    });

    test("should capitalize underscore separated words", async ({
      request,
    }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CAPITALIZE_WORDS,
        TEST_DATA.CAPITALIZE_WORDS.UNDERSCORE
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.capitalized).toBe(
        EXPECTED_VALUES.CAPITALIZE_WORDS.FIRST_NAME
      );
    });

    test("should handle edge cases", async ({ request }) => {
      await testCapitalizeWordsEdgeCases(request);
    });

    test("should handle already capitalized words", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CAPITALIZE_WORDS,
        TEST_DATA.CAPITALIZE_WORDS.ALREADY_CAPITALIZED
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.capitalized).toBe(EXPECTED_VALUES.CAPITALIZE_WORDS.PRODUCT);
    });

    test("should handle single words", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CAPITALIZE_WORDS,
        TEST_DATA.CAPITALIZE_WORDS.SINGLE_WORD
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.capitalized).toBe(EXPECTED_VALUES.CAPITALIZE_WORDS.PRODUCT);
    });
  });

  test.describe("likeName via API", () => {
    test("should extract partial name correctly", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.LIKE_NAME,
        TEST_DATA.LIKE_NAME.BASIC
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.result).toBe(EXPECTED_VALUES.LIKE_NAME.SAMSUNG_GALAXY);
    });

    test("should handle name starting with type", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.LIKE_NAME,
        TEST_DATA.LIKE_NAME.STARTS_WITH_TYPE
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.result.length).toBeGreaterThan(0);
      expect(typeof result.result).toBe("string");
    });

    test("should remove special characters", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.LIKE_NAME,
        TEST_DATA.LIKE_NAME.SPECIAL_CHARS
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.result).not.toContain("@");
      expect(result.result).not.toContain("!");
    });

    test("should handle empty inputs", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.LIKE_NAME,
        TEST_DATA.LIKE_NAME.EMPTY_NAME
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.result).toBe("");
    });

    test("should preserve allowed characters", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.LIKE_NAME,
        TEST_DATA.LIKE_NAME.WITH_SPACES
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.result).toContain(" ");
    });
  });

  test.describe("formatManufacturerValues via API", () => {
    test("should format single manufacturer string", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.FORMAT_MANUFACTURERS,
        TEST_DATA.MANUFACTURERS.SINGLE_STRING
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.formatted).toContain(
        EXPECTED_VALUES.MANUFACTURERS.SAMSUNG_ELECTRONICS
      );
      expect(result.formatted).toContain(
        EXPECTED_VALUES.MANUFACTURERS.SAMSUNG_ELECTRONICS_HYPHEN
      );
    });

    test("should format array of manufacturers", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.FORMAT_MANUFACTURERS,
        TEST_DATA.MANUFACTURERS.ARRAY
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.formatted).toContain(
        EXPECTED_VALUES.MANUFACTURERS.SAMSUNG_ELECTRONICS
      );
      expect(result.formatted).toContain(
        EXPECTED_VALUES.MANUFACTURERS.SAMSUNG_ELECTRONICS_HYPHEN
      );
      expect(result.formatted).toContain(
        EXPECTED_VALUES.MANUFACTURERS.APPLE_INC
      );
      expect(result.formatted).toContain(
        EXPECTED_VALUES.MANUFACTURERS.APPLE_INC_HYPHEN
      );
    });

    test("should handle single word manufacturers", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.FORMAT_MANUFACTURERS,
        TEST_DATA.MANUFACTURERS.SINGLE_WORD
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.formatted).toEqual(
        EXPECTED_VALUES.MANUFACTURERS.SAMSUNG_ONLY
      );
    });

    test("should handle empty or invalid input", async ({ request }) => {
      await testManufacturerEdgeCases(request);
    });
  });

  test.describe("formatManufacturerObject via API", () => {
    test("should remove authorized_distributor property", async ({
      request,
    }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.FORMAT_MANUFACTURER_OBJECT,
        TEST_DATA.MANUFACTURER_OBJECTS.WITH_DISTRIBUTOR
      );
      const result = await expectSuccessfulResponse(response);

      expect(result.formatted).toHaveLength(2);
      expect(result.formatted[0]).not.toHaveProperty("authorized_distributor");
      expect(result.formatted[1]).not.toHaveProperty("authorized_distributor");

      REQUIRED_PROPERTIES.MANUFACTURER_FORMATTED.forEach((prop) => {
        expect(result.formatted[0]).toHaveProperty(prop);
      });
    });

    test("should handle empty array", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.FORMAT_MANUFACTURER_OBJECT,
        TEST_DATA.MANUFACTURER_OBJECTS.EMPTY_ARRAY
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.formatted).toEqual([]);
    });
  });

  test.describe("formateShouldArray via API", () => {
    test("should create should array from specs", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.FORMATE_SHOULD_ARRAY,
        TEST_DATA.SHOULD_ARRAY.BASIC_SPECS
      );
      const result = await expectSuccessfulResponse(response);

      expect(result.shouldArray).toHaveLength(3);
      expect(result.shouldArray[0]).toEqual(
        EXPECTED_VALUES.SHOULD_ARRAY.VOLTAGE_TERM
      );
      expect(result.shouldArray[1]).toEqual(
        EXPECTED_VALUES.SHOULD_ARRAY.CURRENT_TERM
      );
      expect(result.shouldArray[2]).toEqual(
        EXPECTED_VALUES.SHOULD_ARRAY.POWER_TERM
      );
    });

    test("should handle empty specs array", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.FORMATE_SHOULD_ARRAY,
        TEST_DATA.SHOULD_ARRAY.EMPTY_SPECS
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.shouldArray).toHaveLength(0);
      expect(Array.isArray(result.shouldArray)).toBe(true);
    });

    test("should handle specs with complex names", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.FORMATE_SHOULD_ARRAY,
        TEST_DATA.SHOULD_ARRAY.COMPLEX_NAMES
      );
      const result = await expectSuccessfulResponse(response);

      expect(result.shouldArray).toHaveLength(3);
      expect(result.shouldArray[0]).toEqual(
        EXPECTED_VALUES.SHOULD_ARRAY.VOLTAGE_RATING_TERM
      );
      expect(result.shouldArray[1]).toEqual(
        EXPECTED_VALUES.SHOULD_ARRAY.POWER_CONSUMPTION_TERM
      );
      expect(result.shouldArray[2]).toEqual(
        EXPECTED_VALUES.SHOULD_ARRAY.CURRENT_MAX_TERM
      );
    });
  });

  test.describe("getBasicAggregations via API", () => {
    test("should create basic aggregations", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.GET_BASIC_AGGREGATIONS,
        TEST_DATA.BASIC_AGGREGATIONS.STANDARD
      );
      const result = await expectSuccessfulResponse(response);

      expect(result).toHaveProperty("manufacturers");
      expect(result).toHaveProperty("product_type.name");
      expect(result).toHaveProperty("familyNames");

      REQUIRED_PROPERTIES.AGGREGATION_TERMS.forEach((prop) => {
        expect(result.manufacturers).toHaveProperty(prop);
      });
      expect(result.manufacturers.terms.field).toBe("manufacturers");
      expect(result.manufacturers.terms.size).toBe(
        EXPECTED_VALUES.AGGREGATIONS.SIZE
      );
    });

    test("should handle static query for subcategory", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.GET_BASIC_AGGREGATIONS,
        TEST_DATA.BASIC_AGGREGATIONS.STATIC_QUERY
      );
      const result = await expectSuccessfulResponse(response);

      REQUIRED_PROPERTIES.SUBCATEGORY_MULTI_TERMS.forEach((prop) => {
        expect(result["subcategory.name"]).toHaveProperty(prop);
      });
      expect(result["subcategory.name"].multi_terms.terms).toHaveLength(2);
      expect(result["subcategory.name"].multi_terms.terms[0].field).toBe(
        EXPECTED_VALUES.AGGREGATIONS.SUBCATEGORY_FIELDS[0]
      );
      expect(result["subcategory.name"].multi_terms.terms[1].field).toBe(
        EXPECTED_VALUES.AGGREGATIONS.SUBCATEGORY_FIELDS[1]
      );
    });

    test("should handle empty aggregations array", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.GET_BASIC_AGGREGATIONS,
        TEST_DATA.BASIC_AGGREGATIONS.EMPTY
      );
      const result = await expectSuccessfulResponse(response);
      expect(Object.keys(result)).toHaveLength(0);
    });

    test("should set correct size for all aggregations", async ({
      request,
    }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.GET_BASIC_AGGREGATIONS,
        TEST_DATA.BASIC_AGGREGATIONS.SIZE_CHECK
      );
      const result = await expectSuccessfulResponse(response);
      validateAggregationSizes(result);
    });
  });

  test.describe("clipParams via API", () => {
    test("should remove unwanted parameters", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CLIP_PARAMS,
        TEST_DATA.CLIP_PARAMS.MIXED_PARAMS
      );
      const result = await expectSuccessfulResponse(response);

      validateNoUnwantedProperties(result.clipped);

      expect(result.clipped).toHaveProperty("validParam");
      expect(result.clipped.validParam).toBe(
        EXPECTED_VALUES.CLIP_PARAMS.VALID_PARAM
      );
      expect(result.clipped).toHaveProperty("manufacturers");
      expect(result.clipped).toHaveProperty("specs.voltage");
    });

    test("should handle empty params", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CLIP_PARAMS,
        TEST_DATA.CLIP_PARAMS.EMPTY
      );
      const result = await expectSuccessfulResponse(response);
      expect(Object.keys(result.clipped)).toHaveLength(0);
    });

    test("should handle params with only unwanted fields", async ({
      request,
    }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CLIP_PARAMS,
        TEST_DATA.CLIP_PARAMS.ONLY_UNWANTED
      );
      const result = await expectSuccessfulResponse(response);
      expect(Object.keys(result.clipped)).toHaveLength(0);
    });

    test("should preserve complex parameter names", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CLIP_PARAMS,
        TEST_DATA.CLIP_PARAMS.COMPLEX_NAMES
      );
      const result = await expectSuccessfulResponse(response);

      expect(result.clipped).toHaveProperty("specs.voltage");
      expect(result.clipped).toHaveProperty("specs.power.rating");
      expect(result.clipped).toHaveProperty("product_type.name");
      expect(result.clipped).not.toHaveProperty("category");
    });
  });

  test.describe("API error handling", () => {
    test("should handle malformed requests gracefully", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.CAPITALIZE_WORDS,
        TEST_DATA.CAPITALIZE_WORDS.INVALID_FIELD
      );
      const result = await expectSuccessfulResponse(response);
      expect(result.capitalized).toBe(EXPECTED_VALUES.CAPITALIZE_WORDS.NULL);
    });

    test("should handle server errors", async ({ request }) => {
      const response = await makePostRequest(
        request,
        API_ENDPOINTS.NONEXISTENT_ENDPOINT,
        TEST_DATA.ERROR_TEST
      );
      await expectErrorResponse(
        response,
        EXPECTED_VALUES.HTTP_STATUS.NOT_FOUND
      );
    });
  });
});
