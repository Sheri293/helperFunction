const UNWANTED_PARAMS = [
  "category",
  "subcategory",
  "slug",
  "amplifyId",
  "count",
  "search_text",
];

const FILTER_MAPPINGS = {
  manufacturers: "Manufacturers",
  "product_type.name": "Product Type",
  familyNames: "Family Names",
  subcategories: "Subcategories",
};

const DEFAULT_SEARCH_FIELDS = ["name", "description"];
const AGGREGATION_SIZE = 500;
const SPECS_AGGREGATION_SIZE = 100;

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

  return str.includes("_") ? processUnderscoreCase(str) : processCamelCase(str);
}

export function likeName({ name = "", type = "" }) {
  let nameLength = Math.floor(name.length / 2);

  if (name.indexOf(type) === 0) {
    nameLength += Math.floor(type.length / 2);
  }

  return name.slice(0, nameLength).replace(/[^\w\s-]/g, "");
}

export function clipParams(params) {
  const clipped = {};

  Object.keys(params).forEach((key) => {
    if (!UNWANTED_PARAMS.includes(key)) {
      clipped[key] = params[key];
    }
  });

  return clipped;
}

const createTermsAggregation = (field) => ({
  terms: { field, size: AGGREGATION_SIZE },
});

const createMultiTermsAggregation = (field) => ({
  multi_terms: {
    terms: [{ field: `${field}.name` }, { field: `${field}.slug` }],
    size: AGGREGATION_SIZE,
  },
});

export function getBasicAggregations(baseAggregations, isStaticQuery = false) {
  const aggregations = {};

  baseAggregations.forEach((agg) => {
    aggregations[agg] =
      agg === "subcategory.name" && isStaticQuery
        ? createMultiTermsAggregation("subcategory")
        : createTermsAggregation(agg);
  });

  return aggregations;
}

const extractBucketValues = (buckets) =>
  buckets?.map((bucket) => bucket.key) || [];

const createSpecsFilterFromAgg = (key, aggregationRawResult) => {
  const specName = key.replace("specs.", "");
  const values = extractBucketValues(
    aggregationRawResult[key]?.unique_values?.buckets
  );

  return values.length > 0
    ? {
        field: key,
        title: capitalizeWords(specName),
        specID: aggregationRawResult[key].id || null,
        values,
      }
    : null;
};

const createStandardFilter = (key, aggregationRawResult) => {
  const values = extractBucketValues(aggregationRawResult[key]?.buckets);

  return values.length > 0
    ? {
        field: key,
        title: FILTER_MAPPINGS[key],
        values,
      }
    : null;
};

const createSubcategoriesFilter = (key, aggregationRawResult) => {
  const subcategories = aggregationRawResult[key];

  return Array.isArray(subcategories) && subcategories.length > 0
    ? {
        field: "subcategory",
        title: "Subcategories",
        values: subcategories.map((sub) => ({
          title: sub.title,
          slug: sub.slug,
        })),
      }
    : null;
};

export function formateFiltersAgg(aggregationRawResult) {
  const filters = [];

  Object.keys(aggregationRawResult).forEach((key) => {
    let filter = null;

    if (key.startsWith("specs.")) {
      filter = createSpecsFilterFromAgg(key, aggregationRawResult);
    } else if (key === "subcategories") {
      filter = createSubcategoriesFilter(key, aggregationRawResult);
    } else if (FILTER_MAPPINGS[key]) {
      filter = createStandardFilter(key, aggregationRawResult);
    }

    if (filter) filters.push(filter);
  });

  return filters;
}

const createBaseFilters = () => [
  { term: { online: true } },
  { term: { is_deleted: false } },
];

const createSpecsFilterForArray = (key, value) => {
  const specName = key.replace("specs.", "");
  return {
    nested: {
      path: "specs",
      query: {
        bool: {
          must: [
            { term: { "specs.name": specName } },
            { terms: { "specs.valueString": value } },
          ],
        },
      },
    },
  };
};

const createTermsFilter = (key, value) => ({ terms: { [key]: value } });
const createTermFilter = (key, value) => ({ term: { [key]: value } });

const processFilterValue = (key, value) => {
  if (key.startsWith("specs.")) {
    return createSpecsFilterForArray(key, value);
  }

  const fieldMap = {
    manufacturers: "manufacturers",
    "product_type.name": "product_type.name",
    familyNames: "familyNames",
  };

  return createTermsFilter(fieldMap[key] || key, value);
};

export async function formateFiltersArray(params) {
  const filters = createBaseFilters();

  Object.keys(params).forEach((key) => {
    const value = params[key];

    if (Array.isArray(value) && value.length > 0) {
      filters.push(processFilterValue(key, value));
    } else if (typeof value === "string" && value.length > 0) {
      filters.push(createTermFilter(key, value));
    }
  });

  return filters;
}

const createBaseProduct = (product) => ({
  name: product.name || "Unknown Product",
  category: product.category?.name || product.category || "Unknown",
  subcategory: product.subcategory?.name || product.subcategory || "Unknown",
  manufacturers: Array.isArray(product.manufacturers)
    ? product.manufacturers
    : [product.manufacturers || "Unknown"],
  favorManufacturer:
    product.favorManufacturer || product.manufacturers?.[0] || "Unknown",
  url: `/product/${encodeURIComponent(product.name || "unknown")}`,
  image: `${(product.name || "unknown")
    .toLowerCase()
    .replace(/\s+/g, "-")}.jpg`,
  weight: product.weight || 1.0,
  specs: Array.isArray(product.specs) ? product.specs : [],
});

const addPricing = (baseProduct, product) => {
  if (product.prices && Array.isArray(product.prices)) {
    const defaultPrice =
      product.prices.find((p) => p.type === "Default Price") ||
      product.prices[0];
    baseProduct.leastPrice = {
      condition: defaultPrice?.condition || "New",
      value: defaultPrice?.value?.toString() || "99.99",
    };
  } else {
    baseProduct.leastPrice = { condition: "New", value: "99.99" };
  }
};

const addStock = (baseProduct, product) => {
  if (product.inventory && Array.isArray(product.inventory)) {
    baseProduct.stock = product.inventory.reduce(
      (total, inv) => total + (inv.value || 0),
      0
    );
  }
};

const formatByType = (baseProduct, type) => {
  const typeFormatters = {
    related: ({ name, subcategory, favorManufacturer, url, specs }) => ({
      name,
      subcategory,
      favorManufacturer,
      url,
      specs,
    }),
    accessory: ({
      name,
      subcategory,
      favorManufacturer,
      url,
      manufacturers,
    }) => ({ name, subcategory, favorManufacturer, url, manufacturers }),
  };

  return typeFormatters[type] ? typeFormatters[type](baseProduct) : baseProduct;
};

export function formateProducts(
  records,
  type = "products",
  sortByPrice = false,
  domains = []
) {
  if (!Array.isArray(records)) return [];

  return records.map((product) => {
    const baseProduct = createBaseProduct(product);
    addPricing(baseProduct, product);
    addStock(baseProduct, product);

    return formatByType(baseProduct, type);
  });
}

const getSpecFieldName = (spec) =>
  spec.type === "string" ? "specs.valueString" : "specs.valueInt";

export function formateSpecsAggregations(specsList, filters = {}) {
  if (!Array.isArray(specsList)) return {};

  const aggregations = {};

  specsList.forEach((spec) => {
    const fieldName = `specs.${spec.name}`;
    aggregations[fieldName] = {
      filter: {
        bool: {
          filter: [{ term: { "specs.name": spec.name } }],
        },
      },
      aggs: {
        unique_values: {
          terms: {
            field: getSpecFieldName(spec),
            size: SPECS_AGGREGATION_SIZE,
          },
        },
      },
    };
  });

  return aggregations;
}

export async function matchToContentfulSubcategories(filters) {
  const enhancedFilters = filters.map((filter) => {
    if (filter.field === "subcategory") {
      return {
        ...filter,
        contentfulMatched: true,
        subcategories: filter.values.map((sub) => ({
          ...sub,
          contentfulId: `contentful-${sub.slug}`,
        })),
      };
    }
    return filter;
  });

  return { res: enhancedFilters };
}

export function formateShouldArray(specs) {
  if (!Array.isArray(specs)) return [];

  return specs.map((spec) => ({ term: { "specs.name": spec.name } }));
}

export function parseFilters(filterString) {
  try {
    return JSON.parse(filterString);
  } catch (error) {
    return {};
  }
}

export function buildSearchQuery(searchText, fields = DEFAULT_SEARCH_FIELDS) {
  if (!searchText || typeof searchText !== "string") return null;

  return {
    multi_match: {
      query: searchText,
      fields,
      type: "best_fields",
      fuzziness: "AUTO",
    },
  };
}

export function buildRangeFilter(field, min, max) {
  const range = {};
  if (min !== undefined) range.gte = min;
  if (max !== undefined) range.lte = max;

  return { range: { [field]: range } };
}

export function buildNestedFilter(path, query) {
  return { nested: { path, query } };
}

export function buildBoolQuery(
  must = [],
  filter = [],
  should = [],
  mustNot = []
) {
  const query = { bool: {} };

  if (must.length > 0) query.bool.must = must;
  if (filter.length > 0) query.bool.filter = filter;
  if (should.length > 0) query.bool.should = should;
  if (mustNot.length > 0) query.bool.must_not = mustNot;

  return query;
}
