import { DEFAULT_AGGREGATION_SIZE } from "../../../../config";
import DBDriver from "../../../../lib/Database";
import { getRecordsFromES } from "../../../../services/ElasticSearch";
import {
  first,
  forEach,
  get,
  groupBy,
  isEmpty,
  isNonEmptyArray,
  keys,
} from "../../../../utils/helpers";
import { formateProduct } from "../../../../utils/product/helper";
import {
  listingSelect,
  parseNestedAggsQuery,
  parseNestedQuery,
  parseQuery,
} from "../../../../utils/query";
import { DB_COLLECTIONS } from "../../../contentful/constants";
import {
  clipParams,
  formateFiltersAgg,
  formateFiltersArray,
  formateProducts,
  formateSpecsAggregations,
  getBasicAggregations,
  likeName,
} from "./helper";
import cacheData from "../../../../utils/redisCacheManager";
import getSupportingTablesData from "../../../../utils/getDataFromES";
import {
  ES_INDICES,
  DOMAINS_REDIS_KEY_EXPIRY,
  SUPPORTING_TABLES,
} from "../../../../constants";

const BASIC_AGGREGATIONS = [
  "manufacturers",
  "product_type.name",
  "familyNames",
];
const DEFAULT_DOMAIN = "Electrical.com";
const DEFAULT_PRICE_TYPE = "Default Price";
const PRICE_CONDITIONS = ["newInBox", "newSurplus", "refurbished", "used"];
const VALID_SORT_ORDERS = ["asc", "desc"];
const DEFAULT_PAGE_SIZE = 10;
const SEARCH_TIE_BREAKER = 0.7;

const QUERY_FIELDS = {
  CATEGORY: ["categoryId", "subcategoryId"],
  SUBCATEGORY: ["subcategory.id", "category.id"],
};

const SELECT_FIELDS = {
  PRODUCT_DETAIL: ["name", "subcategory", "product_type"],
  ACCESSORY_DETAIL: ["name", "Accessories"],
  RELATED_PRODUCT: ["name", "subcategory", "favorManufacturer", "url", "specs"],
  ACCESSORY_PRODUCT: [
    "name",
    "subcategory",
    "favorManufacturer",
    "url",
    "manufacturers",
  ],
};

const createMatchAllQuery = () => ({ query: { match_all: {} } });

const createMustQuery = (amplifyId) => ({
  must: [
    {
      multi_match: {
        query: amplifyId,
        fields: QUERY_FIELDS.CATEGORY,
      },
    },
  ],
});

const createSpecsAggregation = () => ({
  specs: {
    multi_terms: {
      terms: [{ field: "spec.name" }, { field: "spec.type" }],
      size: DEFAULT_AGGREGATION_SIZE,
    },
  },
});

const parseSpecsBuckets = (buckets) => {
  const specs = [];
  forEach(buckets, (bucket) => {
    const { key_as_string: key } = bucket;
    const [name, type] = key.split("|");
    specs.push({ name, type });
  });
  return specs;
};

export async function getSpecsDetailsFromES(filters) {
  const amplifyId = get(filters, "amplifyId", "");
  const baseQuery = isEmpty(filters)
    ? createMatchAllQuery()
    : createMustQuery(amplifyId);

  let query = {
    ...baseQuery,
    path: "spec",
    select: ["spec.name", "categoryId"],
    aggs: createSpecsAggregation(),
  };

  query = parseNestedAggsQuery(query);

  const { res: esResult, err } = await getRecordsFromES(
    ES_INDICES.SUBCATEGORIES,
    {
      query,
      take: 1,
      sort: [],
      isParsedResult: false,
    }
  );

  if (err) throw err;

  const categoryId = get(esResult, "body.hits.hits.[0]._source.categoryId", "");
  const buckets = get(
    esResult,
    "body.aggregations.uniq_values.specs.buckets",
    []
  );
  const specs = parseSpecsBuckets(buckets);

  return { categoryId, specs };
}

const createBaseFilterQuery = (amplifyId) => ({
  bool: {
    must: [
      { term: { online: true } },
      { term: { is_deleted: false } },
      ...(amplifyId
        ? [
            {
              multi_match: {
                query: amplifyId,
                fields: QUERY_FIELDS.SUBCATEGORY,
              },
            },
          ]
        : []),
    ],
  },
});

const createFilterAggregations = (
  aggregations,
  baseAggregations,
  isStaticQuery
) => ({
  specs: {
    nested: { path: "specs" },
    aggs: aggregations,
  },
  ...getBasicAggregations(baseAggregations, isStaticQuery),
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

  const baseQuery = createBaseFilterQuery(amplifyId);

  return {
    query: {
      ...baseQuery,
      bool: {
        ...baseQuery.bool,
        filter,
        should,
      },
    },
    aggs: createFilterAggregations(
      aggregations,
      baseAggregations,
      isStaticQuery
    ),
  };
}

const extractAggregationResults = (esResult, dbResult) => {
  const rawAggregations = get(esResult, "body.aggregations", []);

  return {
    ...get(rawAggregations, "specs"),
    familyNames: get(rawAggregations, "familyNames", {}),
    manufacturers: get(rawAggregations, "manufacturers", {}),
    "product_type.name": get(rawAggregations, "product_type.name", {}),
    subcategories: dbResult || [],
  };
};

const createCategoryFilter = (categoryId) => ({
  "es.amplifyId": { $ne: null },
  "category.amplifyId": categoryId,
});

export async function getDynamicFilters(filters) {
  try {
    const amplifyId = get(filters, "amplifyId", null);
    const { categoryId, specs: specsList = [] } = await getSpecsDetailsFromES(
      filters
    );
    const specsAggregations = formateSpecsAggregations(specsList, filters);
    const filtersArr = await formateFiltersArray(clipParams(filters));

    const filterQuery = formateFiltersQuery({
      filter: filtersArr,
      aggregations: specsAggregations,
      amplifyId,
    });

    const [{ res: esResult }, { res: dbResult }] = await Promise.all([
      getRecordsFromES(ES_INDICES.PRODUCTS, {
        query: filterQuery,
        take: 0,
        sort: [],
        isParsedResult: false,
      }),
      DBDriver.find(DB_COLLECTIONS.categories, {
        filter: createCategoryFilter(categoryId),
        select: { _id: 0, title: 1, slug: 1 },
      }),
    ]);

    delete esResult?.body.aggregations?.specs?.doc_count;
    const aggregationRawResult = extractAggregationResults(esResult, dbResult);
    const result = formateFiltersAgg(aggregationRawResult);

    return { res: result };
  } catch (err) {
    return { err };
  }
}

const createProductQuery = (name, select = []) => ({
  must: [
    {
      term: {
        name: { value: name, case_insensitive: true },
      },
    },
  ],
  select,
});

async function getProductDetail(name, select = []) {
  const query = createProductQuery(name, select);

  const {
    res: { records },
  } = await getRecordsFromES(ES_INDICES.PRODUCTS, {
    query: parseQuery(query),
    take: 1,
  });

  if (!isNonEmptyArray(records)) return null;
  return { ...records[0] };
}

const createRelatedProductQuery = (name, subcategory, type) => ({
  must: [
    { term: { "product_type.name": type } },
    { term: { "subcategory.name": subcategory } },
    {
      regexp: {
        name: {
          value: `${likeName({ name, type })}.*`,
          case_insensitive: true,
        },
      },
    },
  ],
  select: SELECT_FIELDS.RELATED_PRODUCT,
});

async function getProductRelated(name, subcategory, type) {
  if (!name || !subcategory || !type) return null;

  const query = createRelatedProductQuery(name, subcategory, type);
  const {
    res: { records },
  } = await getRecordsFromES(ES_INDICES.PRODUCTS, {
    query: parseQuery(query),
  });

  if (!isNonEmptyArray(records)) return null;
  return (await formateProducts(records, "related")) || [];
}

const createAccessoryQuery = (list) => ({
  filter: { terms: { name: list } },
  select: SELECT_FIELDS.ACCESSORY_PRODUCT,
});

async function getProductAccessory(list) {
  if (!isNonEmptyArray(list)) return null;

  const query = createAccessoryQuery(list);
  const {
    res: { records },
  } = await getRecordsFromES(ES_INDICES.PRODUCTS, {
    query: parseQuery(query),
    take: list.length || 1,
  });

  if (!isNonEmptyArray(records)) return null;
  return (await formateProducts(records, "accessory")) || [];
}

export async function getRelatedProductsFromES(name) {
  try {
    const product =
      (await getProductDetail(name, SELECT_FIELDS.PRODUCT_DETAIL)) || {};
    if (!product) return { res: [] };

    const subcategory = get(product, "subcategory.name", null);
    const type = get(product, "product_type.name", null);
    const relatedProducts =
      (await getProductRelated(name, subcategory, type)) || [];

    return { res: relatedProducts };
  } catch (err) {
    return { err };
  }
}

const extractAccessoryList = (product) => {
  const accessoryList = [];
  const list = get(product, "Accessories", []);
  const groupByList = groupBy(list, "subCategoryId");

  forEach(keys(groupByList), (key) => {
    if (groupByList[key] && groupByList[key].length > 0) {
      const productItem = first(groupByList[key]).name;
      if (productItem) accessoryList.push(productItem);
    }
  });

  return accessoryList;
};

export async function getProductAccessoriesFromES(name) {
  try {
    const product = await getProductDetail(
      name,
      SELECT_FIELDS.ACCESSORY_DETAIL
    );
    if (!product || isEmpty(product)) return { res: [] };

    const accessoryList = extractAccessoryList(product);
    const productsAccessory = (await getProductAccessory(accessoryList)) || [];

    return { res: productsAccessory };
  } catch (err) {
    return { err };
  }
}

const extractSupportingData = (supportingTablesData) => ({
  domains: get(supportingTablesData, "res.domains.res"),
  leadTimeDomains: get(supportingTablesData, "res.leadTimeDomains.res"),
  cuttoffTimeDomains: get(supportingTablesData, "res.cutoffDomains.res"),
});

export async function getProductDetailsFromES(name) {
  try {
    const promiseArr = [
      getProductDetail(name),
      cacheData(SUPPORTING_TABLES, getSupportingTablesData, {
        expiresAt: DOMAINS_REDIS_KEY_EXPIRY,
      }),
    ];

    const [product, supportingTablesData] = await Promise.all(promiseArr);
    if (!product || isEmpty(product)) return { res: {} };

    const { domains, cuttoffTimeDomains, leadTimeDomains } =
      extractSupportingData(supportingTablesData);
    const result = await formateProduct(
      product,
      domains,
      cuttoffTimeDomains,
      leadTimeDomains
    );

    return { res: result };
  } catch (err) {
    return { err };
  }
}

const getProducts = async (query, size, offset, sort) => {
  const {
    res: { records, totalRecords },
  } = await getRecordsFromES(ES_INDICES.PRODUCTS, {
    query,
    take: size,
    skip: offset,
    sort,
  });

  return { res: { records, totalRecords } };
};

const createSearchTextQuery = (searchText) => ({
  dis_max: {
    queries: [
      {
        wildcard: {
          name: {
            value: `${searchText}*`,
            case_insensitive: true,
          },
        },
      },
    ],
    tie_breaker: SEARCH_TIE_BREAKER,
  },
});

const createInStockQuery = () => {
  const inStockQuery = {
    path: "inventory",
    range: { "inventory.value": { gt: 0 } },
  };
  return parseNestedQuery(inStockQuery, true).query || {};
};

const addRelevantFilters = async (query, relevant) => {
  const product = await getProductDetail(relevant, [
    "subcategory.name",
    "favorManufacturer",
  ]);
  const subcategory = get(product, "subcategory.name");
  const favorManufacturer = get(product, "favorManufacturer");

  query.filter.push(
    { term: { "subcategory.name": subcategory } },
    { term: { "favorManufacturer.keyword": favorManufacturer } }
  );
};

const validateSortOrder = (order) => {
  if (!VALID_SORT_ORDERS.includes(order)) {
    throw new Error("Sorting key not valid!");
  }
};

const createManufacturerSort = (sortByManuf) => {
  validateSortOrder(sortByManuf);
  return { "favorManufacturer.keyword": { order: sortByManuf } };
};

const createPriceSort = (sortByPrice) => {
  validateSortOrder(sortByPrice);
  return {
    "prices.value": {
      order: sortByPrice,
      nested: {
        path: "prices",
        filter: {
          bool: {
            filter: [
              { term: { "prices.domain": DEFAULT_DOMAIN } },
              { term: { "prices.type": DEFAULT_PRICE_TYPE } },
              { terms: { "prices.condition": PRICE_CONDITIONS } },
            ],
          },
        },
      },
    },
  };
};

const buildSortArray = (sortByManuf, sortByPrice) => {
  const sort = [{ name: "asc" }];

  if (sortByManuf) {
    sort.unshift(createManufacturerSort(sortByManuf));
  } else if (sortByPrice) {
    sort.unshift(createPriceSort(sortByPrice));
  }

  return sort;
};

const createBaseQuery = (filters, amplifyId) => {
  const query = {
    must: [
      ...((filters.slug && [
        {
          multi_match: {
            query: amplifyId,
            fields: QUERY_FIELDS.SUBCATEGORY,
          },
        },
      ]) ||
        []),
    ],
    filter: [],
  };

  return query;
};

export const getProductListFromES = async (filters) => {
  const { count = null, search_text: searchText = "" } = filters || {};
  const {
    page = 1,
    size = count ? 0 : DEFAULT_PAGE_SIZE,
    inStock = false,
    sortByManuf = false,
    sortByPrice = false,
    relevant = null,
    amplifyId = "",
    ...rest
  } = filters;

  const offset =
    parseInt(page, 10) * parseInt(size, 10) - parseInt(size, 10) || 0;

  try {
    const filterArray = await formateFiltersArray(clipParams(rest));
    const query = createBaseQuery(filters, amplifyId);
    query.filter = filterArray;

    if (searchText && searchText.length) {
      query.must.push(createSearchTextQuery(searchText));
    }

    if (relevant) {
      await addRelevantFilters(query, relevant);
    }

    if (inStock) {
      query.must.push(createInStockQuery());
    }

    const sort = buildSortArray(sortByManuf, sortByPrice);
    const finalQuery = parseQuery({
      ...query,
      select: [...listingSelect, ...PRICE_CONDITIONS],
    });

    if (count) {
      const { res: result } = await getRecordsFromES(ES_INDICES.PRODUCTS, {
        take: 0,
        query: finalQuery,
        isParsedResult: false,
      });
      return {
        res: { count: get(result, "body.hits.total.value", 0) },
      };
    }

    const promiseArr = [
      getProducts(finalQuery, size, offset, sort),
      cacheData(SUPPORTING_TABLES, getSupportingTablesData, {
        expiresAt: DOMAINS_REDIS_KEY_EXPIRY,
      }),
    ];

    const [products, supportingTablesData] = await Promise.all(promiseArr);
    const domains = get(supportingTablesData, "res.domains.res");
    const records = get(products, "res.records");
    const totalRecords = get(products, "res.totalRecords");

    if (!isNonEmptyArray(records)) {
      return { res: { records: [], count: totalRecords || 0 } };
    }

    const result = await formateProducts(
      records,
      "products",
      sortByPrice,
      domains
    );

    return {
      res: {
        records: result,
        count: totalRecords || 0,
      },
    };
  } catch (error) {
    return { err: error };
  }
};
