import express from "express";
import cors from "cors";

import {
  convertNumberWithComma,
  requiredFieldsOk,
  cleanValues,
  setOrderId,
  setShippingWeight,
  mapOrder,
} from "../helpers/checkout/index.js";

import {
  formatManufacturerValues,
  formatManufacturerObject,
} from "../helpers/filters/utils/index.js";

import {
  capitalizeWords,
  likeName,
  getSpecsDetailsFromES,
  getDynamicFilters,
  getRelatedProductsFromES,
  getProductAccessoriesFromES,
  getProductDetailsFromES,
  getProductListFromES,
  formateFiltersQuery,
} from "../helpers/products/es.js";

import {
  formateFiltersAgg,
  formateFiltersArray,
  formateProducts,
  formateSpecsAggregations,
  getBasicAggregations,
  clipParams,
  formateShouldArray,
  parseFilters,
  buildSearchQuery,
  buildRangeFilter,
  buildNestedFilter,
  buildBoolQuery,
} from "../helpers/filters/es/helper.js";

const app = express();

const CONFIG = {
  PORT: process.env.TEST_PORT || 3001,
  JSON_LIMIT: "10mb",
  MOCK_TAX_RATE: 8.25,
  FREE_SHIPPING_THRESHOLD: 29,
  ITEM_WEIGHT: 2.5,
};

const MOCK_DATA = {
  FILTERS: [
    {
      field: "manufacturers",
      title: "Manufacturers",
      values: ["Samsung", "Apple", "LG", "Sony"],
    },
    {
      field: "specs.voltage",
      title: "Voltage",
      specID: 1,
      values: ["110V", "220V", "240V"],
    },
    {
      field: "specs.power",
      title: "Power",
      specID: 2,
      values: ["100W", "200W", "500W"],
    },
  ],
};

app.use(cors());
app.use(express.json({ limit: CONFIG.JSON_LIMIT }));

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const createSuccessResponse = (data) => data;
const createErrorResponse = (error) => ({ error: error.message });

const handleESResult = (result, res) => {
  if (result.err) {
    return res.status(500).json(createErrorResponse(result.err));
  }
  res.json(result.res);
};

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "Test server is running",
  });
});

app.post("/api/test-convert-number", (req, res) => {
  try {
    const { input } = req.body;
    const converted = convertNumberWithComma(input);
    res.json({ input, converted });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/validate-required-fields", (req, res) => {
  try {
    const order = req.body;
    const isValid = requiredFieldsOk(order);
    res.json({ valid: isValid, order });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/clean-values", (req, res) => {
  try {
    const data = req.body;
    const cleaned = cleanValues(data);
    res.json({ original: data, cleaned });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/set-order-id", (req, res) => {
  try {
    const order = req.body;
    const orderWithId = setOrderId(order);
    res.json(orderWithId);
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/set-shipping-weight", (req, res) => {
  try {
    const order = req.body;
    const result = setShippingWeight(order);
    res.json(result);
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/map-order", (req, res) => {
  try {
    const order = req.body;
    const mappedOrder = mapOrder(order);
    res.json(mappedOrder);
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/capitalize-words", (req, res) => {
  try {
    const { text } = req.body;
    const capitalized = capitalizeWords(text);
    res.json({ original: text, capitalized });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/like-name", (req, res) => {
  try {
    const { name, type } = req.body;
    const result = likeName({ name, type });
    res.json({ original: { name, type }, result });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/format-manufacturers", (req, res) => {
  try {
    const { manufacturers } = req.body;
    const formatted = formatManufacturerValues(manufacturers);
    res.json({ original: manufacturers, formatted });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/format-manufacturer-object", (req, res) => {
  try {
    const { manufacturers } = req.body;
    const formatted = formatManufacturerObject(manufacturers);
    res.json({ original: manufacturers, formatted });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/clip-params", (req, res) => {
  try {
    const params = req.body;
    const clipped = clipParams(params);
    res.json({ original: params, clipped });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/get-basic-aggregations", (req, res) => {
  try {
    const { aggregations, isStaticQuery } = req.body;
    const result = getBasicAggregations(aggregations, isStaticQuery);
    res.json(result);
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/formate-should-array", (req, res) => {
  try {
    const { specs } = req.body;
    const shouldArray = formateShouldArray(specs);
    res.json({ specs, shouldArray });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/formate-filters-agg", (req, res) => {
  try {
    const { aggregationRawResult } = req.body;
    const formatted = formateFiltersAgg(aggregationRawResult);
    res.json({ original: aggregationRawResult, formatted });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post(
  "/api/formate-filters-array",
  asyncHandler(async (req, res) => {
    const params = req.body;
    const filtersArray = await formateFiltersArray(params);
    res.json({ original: params, filtersArray });
  })
);

app.post("/api/formate-products", (req, res) => {
  try {
    const { records, type, sortByPrice, domains } = req.body;
    const formatted = formateProducts(records, type, sortByPrice, domains);
    res.json({ original: records, formatted });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/formate-specs-aggregations", (req, res) => {
  try {
    const { specsList, filters } = req.body;
    const aggregations = formateSpecsAggregations(specsList, filters);
    res.json({ specsList, filters, aggregations });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/parse-filters", (req, res) => {
  try {
    const { filterString } = req.body;
    const parsed = parseFilters(filterString);
    res.json({ original: filterString, parsed });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/build-search-query", (req, res) => {
  try {
    const { searchText, fields } = req.body;
    const query = buildSearchQuery(searchText, fields);
    res.json({ searchText, fields, query });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/build-range-filter", (req, res) => {
  try {
    const { field, min, max } = req.body;
    const filter = buildRangeFilter(field, min, max);
    res.json({ field, min, max, filter });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/build-nested-filter", (req, res) => {
  try {
    const { path, query } = req.body;
    const filter = buildNestedFilter(path, query);
    res.json({ path, query, filter });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post("/api/build-bool-query", (req, res) => {
  try {
    const { must, filter, should, mustNot } = req.body;
    const query = buildBoolQuery(must, filter, should, mustNot);
    res.json({ must, filter, should, mustNot, query });
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post(
  "/api/get-specs-details",
  asyncHandler(async (req, res) => {
    const filters = req.body;
    const result = await getSpecsDetailsFromES(filters);
    handleESResult(result, res);
  })
);

app.post("/api/format-filters-query", (req, res) => {
  try {
    const filterData = req.body;
    const query = formateFiltersQuery(filterData);
    res.json(query);
  } catch (error) {
    res.status(500).json(createErrorResponse(error));
  }
});

app.post(
  "/api/get-dynamic-filters",
  asyncHandler(async (req, res) => {
    const filters = req.body;
    const result = await getDynamicFilters(filters);
    if (result.err) {
      return res.status(500).json(createErrorResponse(result.err));
    }
    res.json({ filters: result.res });
  })
);

app.get(
  "/api/product/:name/related",
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const result = await getRelatedProductsFromES(decodeURIComponent(name));
    handleESResult(result, res);
  })
);

app.get(
  "/api/product/:name/accessories",
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const result = await getProductAccessoriesFromES(decodeURIComponent(name));
    handleESResult(result, res);
  })
);

app.get(
  "/api/product/:name",
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const result = await getProductDetailsFromES(decodeURIComponent(name));
    handleESResult(result, res);
  })
);

app.post(
  "/api/product-list",
  asyncHandler(async (req, res) => {
    const filters = req.body;
    const result = await getProductListFromES(filters);
    handleESResult(result, res);
  })
);

app.post(
  "/api/build-items",
  asyncHandler(async (req, res) => {
    const order = req.body;
    const mockResult = {
      ...order,
      subtotal: order.items.reduce((sum, item) => {
        const itemSubtotal = Number(item.quantity) * Number(item.rate);
        const warrantySubtotal = item.warranty
          ? Number(item.quantity) * Number(item.warranty.price)
          : 0;
        return sum + itemSubtotal + warrantySubtotal;
      }, 0),
      warnings: [],
      items: order.items.map((item, index) => ({
        ...item,
        weight: CONFIG.ITEM_WEIGHT,
        rate: Number(item.rate),
        quantity: Number(item.quantity),
        subtotal:
          Number(item.quantity) * Number(item.rate) +
          (item.warranty
            ? Number(item.quantity) * Number(item.warranty.price)
            : 0),
        subtotalForShipping: Number(item.quantity) * Number(item.rate),
        subcategory: "Electronics",
        favorManufacturer: "Samsung",
        expected_ship_date: new Date().toISOString(),
        cartReason: "inventory",
      })),
      productsStock: 85.5,
      quantity_flag: "10/10",
      referrer: "organic",
    };

    res.json(mockResult);
  })
);

app.post(
  "/api/set-shipping-rate",
  asyncHandler(async (req, res) => {
    const order = req.body;
    const mockResult = {
      ...order,
      shippingRate: Number(order.shippingRate),
      warnings: order.warnings || [],
    };

    if (order.freeShipping && order.items) {
      const subTotal = order.items.reduce(
        (sum, item) => sum + (item.subtotalForShipping || 0),
        0
      );
      if (
        subTotal > CONFIG.FREE_SHIPPING_THRESHOLD &&
        order.shippingMethod &&
        order.shippingMethod.toLowerCase() === "ground"
      ) {
        mockResult.shippingRate = 0;
      }
    }

    res.json(mockResult);
  })
);

app.post(
  "/api/set-tax-rate",
  asyncHandler(async (req, res) => {
    const order = req.body;
    const result = {
      ...order,
      taxRate: CONFIG.MOCK_TAX_RATE.toFixed(2),
      warnings: order.warnings || [],
    };

    if (Number(order.taxRate).toFixed(2) !== CONFIG.MOCK_TAX_RATE.toFixed(2)) {
      result.warnings.push(
        `Tax should have been: ${CONFIG.MOCK_TAX_RATE.toFixed(2)}`
      );
    }

    res.json(result);
  })
);

app.post(
  "/api/checkout/complete",
  asyncHandler(async (req, res) => {
    let order = req.body;

    if (!requiredFieldsOk(order)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    order = cleanValues(order);
    order = setOrderId(order);

    const result = {
      orderId: order.orderId,
      subtotal: order.items.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.rate),
        0
      ),
      shippingWeight:
        order.items.reduce(
          (sum, item) => sum + CONFIG.ITEM_WEIGHT * Number(item.quantity),
          0
        ) || 1,
      taxRate: "8.25",
      warnings: [],
      netsuiteSuccess: true,
      orderSaved: true,
      emailSent: true,
      yotpoCreated: true,
      klaviyoSubscribed: true,
    };

    res.json(result);
  })
);

app.post(
  "/api/fetch-filters",
  asyncHandler(async (req, res) => {
    res.json({ filters: MOCK_DATA.FILTERS });
  })
);

app.use((error, _req, res, _next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
});

app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.originalUrl,
    method: req.method,
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(` Complete Test API server running on port ${CONFIG.PORT}`);
  console.log(` Health check: http://localhost:${CONFIG.PORT}/api/health`);
  console.log(` Total API endpoints: 25+`);
  console.log(` All helper functions covered`);
});

export default app;
