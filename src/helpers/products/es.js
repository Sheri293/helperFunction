const MOCK_PRODUCTS = [
  {
    name: "Samsung Galaxy Phone",
    category: { name: "Electronics", slug: "electronics", id: "cat-1" },
    subcategory: {
      name: "Mobile Phones",
      slug: "mobile-phones",
      id: "subcat-1",
    },
    product_type: { name: "Smartphone" },
    manufacturers: ["Samsung"],
    favorManufacturer: "Samsung",
    weight: 0.5,
    online: true,
    is_deleted: false,
    specs: [
      { name: "voltage", valueString: "5V", type: "string" },
      { name: "power", valueInt: 25, type: "int" },
      { name: "storage", valueInt: 128, type: "int" },
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
  {
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
      { name: "voltage", valueString: "5V", type: "string" },
      { name: "power", valueInt: 20, type: "int" },
      { name: "storage", valueInt: 256, type: "int" },
    ],
    prices: [
      {
        condition: "newInBox",
        domain: "Electrical.com",
        type: "Default Price",
        value: 999.99,
      },
    ],
    inventory: [{ condition: "newInBox", value: 30 }],
  },
  {
    name: "Dell Laptop",
    category: { name: "Electronics", slug: "electronics", id: "cat-1" },
    subcategory: { name: "Computers", slug: "computers", id: "subcat-2" },
    product_type: { name: "Laptop" },
    manufacturers: ["Dell"],
    favorManufacturer: "Dell",
    weight: 2.5,
    online: true,
    is_deleted: false,
    specs: [
      { name: "voltage", valueString: "19V", type: "string" },
      { name: "power", valueInt: 65, type: "int" },
      { name: "storage", valueInt: 512, type: "int" },
    ],
    prices: [
      {
        condition: "newInBox",
        domain: "Electrical.com",
        type: "Default Price",
        value: 1299.99,
      },
    ],
    inventory: [{ condition: "newInBox", value: 15 }],
  },
];

const MOCK_SPECS = [
  { name: "voltage", type: "string" },
  { name: "power", type: "int" },
  { name: "storage", type: "int" },
  { name: "weight", type: "float" },
  { name: "color", type: "string" },
  { name: "brand", type: "string" },
];

const MOCK_AGGREGATIONS = {
  manufacturers: {
    buckets: [
      { key: "Samsung", doc_count: 15 },
      { key: "Apple", doc_count: 12 },
      { key: "Dell", doc_count: 8 },
    ],
  },
  "product_type.name": {
    buckets: [
      { key: "Smartphone", doc_count: 20 },
      { key: "Laptop", doc_count: 8 },
      { key: "Tablet", doc_count: 5 },
    ],
  },
  "specs.voltage": {
    unique_values: {
      buckets: [
        { key: "5V", doc_count: 25 },
        { key: "19V", doc_count: 8 },
        { key: "12V", doc_count: 5 },
      ],
    },
  },
  "specs.power": {
    unique_values: {
      buckets: [
        { key: 20, doc_count: 12 },
        { key: 25, doc_count: 13 },
        { key: 65, doc_count: 8 },
      ],
    },
  },
};

const MOCK_ACCESSORIES = [
  {
    name: "Phone Case",
    subcategory: "Accessories",
    favorManufacturer: "Generic",
    url: "/product/phone-case",
    manufacturers: ["Generic"],
  },
  {
    name: "Screen Protector",
    subcategory: "Accessories",
    favorManufacturer: "Generic",
    url: "/product/screen-protector",
    manufacturers: ["Generic"],
  },
  {
    name: "Laptop Bag",
    subcategory: "Accessories",
    favorManufacturer: "Generic",
    url: "/product/laptop-bag",
    manufacturers: ["Generic"],
  },
];

const BASIC_AGGREGATIONS = [
  "manufacturers",
  "product_type.name",
  "familyNames",
];

const mockESResponse = (data) => ({ res: data, err: null });
const mockESError = (error) => ({ res: null, err: error });

const capitalizeFirstLetter = (str) =>
  str.charAt(0).toUpperCase() + str.substring(1);

const processCamelCase = (str) =>
  str
    .replace(/([a-z])([A-Z])/, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const processUnderscoreCase = (str) => {
  const words = str.replace(/_/g, " ").toLowerCase().split(" ");
  return words.map(capitalizeFirstLetter).join(" ");
};

export function capitalizeWords(str) {
  if (!str) return null;

  if (!str.includes("_")) {
    return processCamelCase(str);
  }

  return processUnderscoreCase(str);
}

export function likeName({ name = "", type = "" }) {
  let nameLength = Math.floor(name.length / 2);

  if (name.indexOf(type) === 0) {
    nameLength += Math.floor(type.length / 2);
  }

  return name.slice(0, nameLength).replace(/[^\w\s-]/g, "");
}

export async function getSpecsDetailsFromES(filters = {}) {
  try {
    const categoryId = filters.amplifyId || "cat-electronics";

    return mockESResponse({
      categoryId,
      specs: MOCK_SPECS,
    });
  } catch (error) {
    return mockESError(error);
  }
}

const createBaseQuery = (amplifyId) => ({
  bool: {
    must: [
      { term: { online: true } },
      { term: { is_deleted: false } },
      ...(amplifyId
        ? [
            {
              multi_match: {
                query: amplifyId,
                fields: ["subcategory.id", "category.id"],
              },
            },
          ]
        : []),
    ],
  },
});

const createAggregations = (
  aggregations,
  baseAggregations = BASIC_AGGREGATIONS
) => ({
  specs: {
    nested: { path: "specs" },
    aggs: aggregations,
  },
  manufacturers: { terms: { field: "manufacturers", size: 500 } },
  "product_type.name": { terms: { field: "product_type.name", size: 500 } },
  familyNames: { terms: { field: "familyNames", size: 500 } },
});

export function formateFiltersQuery(filters) {
  const {
    aggregations = [],
    filter = [],
    should = [],
    amplifyId = null,
    baseAggregations = BASIC_AGGREGATIONS,
    isStaticQuery = false,
  } = filters;

  const baseQuery = createBaseQuery(amplifyId);

  return {
    query: {
      ...baseQuery,
      bool: {
        ...baseQuery.bool,
        filter,
        should,
      },
    },
    aggs: createAggregations(aggregations, baseAggregations),
  };
}

const createFilterFromBuckets = (field, title, buckets) => ({
  field,
  title,
  values: buckets.map((bucket) => bucket.key),
});

const createSpecFilter = (spec, aggregation) => ({
  field: `specs.${spec.name}`,
  title: capitalizeWords(spec.name),
  specID: spec.id || null,
  values: aggregation.unique_values.buckets.map((bucket) => bucket.key),
});

export async function getDynamicFilters(filters) {
  try {
    const { categoryId, specs } = await getSpecsDetailsFromES(filters);
    const formattedFilters = [];

    if (MOCK_AGGREGATIONS.manufacturers?.buckets) {
      formattedFilters.push(
        createFilterFromBuckets(
          "manufacturers",
          "Manufacturers",
          MOCK_AGGREGATIONS.manufacturers.buckets
        )
      );
    }

    if (MOCK_AGGREGATIONS["product_type.name"]?.buckets) {
      formattedFilters.push(
        createFilterFromBuckets(
          "product_type.name",
          "Product Type",
          MOCK_AGGREGATIONS["product_type.name"].buckets
        )
      );
    }

    specs.forEach((spec) => {
      const specKey = `specs.${spec.name}`;
      const aggregation = MOCK_AGGREGATIONS[specKey];

      if (aggregation?.unique_values?.buckets) {
        formattedFilters.push(createSpecFilter(spec, aggregation));
      }
    });

    return mockESResponse(formattedFilters);
  } catch (error) {
    return mockESError(error);
  }
}

const findProductByName = (name) =>
  MOCK_PRODUCTS.find(
    (product) => product.name.toLowerCase() === name.toLowerCase()
  );

const selectProductFields = (product, fields) => {
  if (fields.length === 0) return product;

  const filteredProduct = {};
  fields.forEach((field) => {
    if (product[field] !== undefined) {
      filteredProduct[field] = product[field];
    }
  });
  return filteredProduct;
};

async function getProductDetail(name, select = []) {
  const product = findProductByName(name);
  if (!product) return null;

  return selectProductFields(product, select);
}

const filterRelatedProducts = (name, subcategory, type) =>
  MOCK_PRODUCTS.filter(
    (product) =>
      product.subcategory.name === subcategory &&
      product.product_type.name === type &&
      product.name !== name
  );

const formatRelatedProduct = (product) => ({
  name: product.name,
  subcategory: product.subcategory.name,
  favorManufacturer: product.favorManufacturer,
  url: `/product/${encodeURIComponent(product.name)}`,
  specs: product.specs || [],
});

async function getProductRelated(name, subcategory, type) {
  if (!name || !subcategory || !type) return null;

  const relatedProducts = filterRelatedProducts(name, subcategory, type);
  return relatedProducts.map(formatRelatedProduct);
}

async function getProductAccessory(accessoryNames) {
  if (!Array.isArray(accessoryNames) || accessoryNames.length === 0)
    return null;

  return MOCK_ACCESSORIES.filter((accessory) =>
    accessoryNames.includes(accessory.name)
  );
}

export async function getRelatedProductsFromES(name) {
  try {
    const product = await getProductDetail(name, [
      "name",
      "subcategory",
      "product_type",
    ]);
    if (!product) return mockESResponse([]);

    const relatedProducts =
      (await getProductRelated(
        name,
        product.subcategory?.name,
        product.product_type?.name
      )) || [];

    return mockESResponse(relatedProducts);
  } catch (error) {
    return mockESError(error);
  }
}

export async function getProductAccessoriesFromES(name) {
  try {
    const product = await getProductDetail(name, ["name", "Accessories"]);
    if (!product || !product.Accessories) return mockESResponse([]);

    const accessoryNames = product.Accessories.map(
      (accessory) => accessory.name
    );
    const accessories = (await getProductAccessory(accessoryNames)) || [];

    return mockESResponse(accessories);
  } catch (error) {
    return mockESError(error);
  }
}

const formatProductSpecs = (specs) =>
  specs?.map((spec) => ({
    name: capitalizeWords(spec.name),
    value: spec.valueString || spec.valueInt || spec.valueFloat,
    type: spec.type,
  })) || [];

const calculateAvailability = (inventory) => ({
  inStock: inventory?.some((inv) => inv.value > 0) || false,
  totalStock: inventory?.reduce((sum, inv) => sum + inv.value, 0) || 0,
});

const calculatePricing = (prices) => ({
  lowest: Math.min(...(prices?.map((price) => price.value) || [99.99])),
  conditions: prices?.map((price) => price.condition) || ["newInBox"],
});

export async function getProductDetailsFromES(name) {
  try {
    const product = await getProductDetail(name);
    if (!product) return mockESResponse({});

    const formattedProduct = {
      ...product,
      formattedSpecs: formatProductSpecs(product.specs),
      availability: calculateAvailability(product.inventory),
      pricing: calculatePricing(product.prices),
    };

    return mockESResponse(formattedProduct);
  } catch (error) {
    return mockESError(error);
  }
}

const applyFilters = (products, filters) => {
  let filteredProducts = [...products];

  if (filters.manufacturers) {
    filteredProducts = filteredProducts.filter((product) =>
      filters.manufacturers.some((manufacturer) =>
        product.manufacturers.includes(manufacturer)
      )
    );
  }

  if (filters["product_type.name"]) {
    filteredProducts = filteredProducts.filter((product) =>
      filters["product_type.name"].includes(product.product_type.name)
    );
  }

  return filteredProducts;
};

const applySearch = (products, searchText) => {
  if (!searchText) return products;

  return products.filter((product) =>
    product.name.toLowerCase().includes(searchText.toLowerCase())
  );
};

const applyStockFilter = (products, inStock) => {
  if (!inStock) return products;

  return products.filter((product) =>
    product.inventory?.some((inv) => inv.value > 0)
  );
};

const applySorting = (products, sortByManuf, sortByPrice) => {
  if (sortByManuf && ["asc", "desc"].includes(sortByManuf)) {
    return products.sort((a, b) => {
      const comparison = a.favorManufacturer.localeCompare(b.favorManufacturer);
      return sortByManuf === "asc" ? comparison : -comparison;
    });
  }

  if (sortByPrice && ["asc", "desc"].includes(sortByPrice)) {
    return products.sort((a, b) => {
      const priceA = a.prices?.[0]?.value || 0;
      const priceB = b.prices?.[0]?.value || 0;
      return sortByPrice === "asc" ? priceA - priceB : priceB - priceA;
    });
  }

  return products;
};

const formatProductForList = (product) => ({
  name: product.name,
  category: product.category.name,
  subcategory: product.subcategory.name,
  manufacturers: product.manufacturers,
  favorManufacturer: product.favorManufacturer,
  url: `/product/${encodeURIComponent(product.name)}`,
  image: `${product.name.toLowerCase().replace(/\s+/g, "-")}.jpg`,
  leastPrice: {
    condition: product.prices?.[0]?.condition || "New",
    value: product.prices?.[0]?.value?.toString() || "99.99",
  },
  weight: product.weight,
  specs: product.specs || [],
});

export async function getProductListFromES(filters = {}) {
  try {
    const {
      page = 1,
      size = 10,
      inStock = false,
      sortByManuf = false,
      sortByPrice = false,
      relevant = null,
      amplifyId = "",
      search_text = "",
      count = null,
      ...filterParams
    } = filters;

    let filteredProducts = applyFilters(MOCK_PRODUCTS, filterParams);
    filteredProducts = applySearch(filteredProducts, search_text);
    filteredProducts = applyStockFilter(filteredProducts, inStock);
    filteredProducts = applySorting(filteredProducts, sortByManuf, sortByPrice);

    if (count) {
      return mockESResponse({ count: filteredProducts.length });
    }

    const offset = (page - 1) * size;
    const paginatedProducts = filteredProducts.slice(offset, offset + size);
    const formattedProducts = paginatedProducts.map(formatProductForList);

    return mockESResponse({
      records: formattedProducts,
      count: filteredProducts.length,
    });
  } catch (error) {
    return mockESError(error);
  }
}
