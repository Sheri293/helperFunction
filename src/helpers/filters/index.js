import { DEFAULT_AGGREGATION_SIZE } from "../../../config";
import { getRecordsFromES } from "../../../services/ElasticSearch";
import {
  forEach,
  get,
  isNonEmptyArray,
  tryCatch,
} from "../../../utils/helpers";
import upsertRecords from "../../../utils/upsertRecords";
import { DB_COLLECTIONS } from "../constants";
import { formateFiltersQuery, getSpecsDetailsFromES } from "./es";
import {
  formateFiltersAgg,
  formateSpecsAggregations,
  matchToContentfulSubcategories,
} from "./es/helper";
import { ES_INDICES } from "../../../constants";

const BASE_AGGREGATIONS = [
  "manufacturers",
  "product_type.name",
  "familyNames",
  "subcategory.name",
];

const AGGREGATION_FIELDS = {
  FAMILY_NAMES: "familyNames",
  MANUFACTURERS: "manufacturers",
  PRODUCT_TYPE: "product_type.name",
  SUBCATEGORY: "subcategory.name",
};

const SPECS_PREFIX = "specs.";
const UNIQUE_IDENTIFIER = "specID";

const createShouldArray = (specs) => {
  const shouldArray = [];
  forEach(specs, (spec) => {
    shouldArray.push({ term: { "specs.name": spec.name } });
  });
  return shouldArray;
};

const createStaticFilterQuery = (specs) => {
  const shouldArray = createShouldArray(specs);
  const specsAggregations = formateSpecsAggregations(specs);

  return formateFiltersQuery({
    should: shouldArray,
    aggregations: specsAggregations,
    baseAggregations: BASE_AGGREGATIONS,
    isStaticQuery: true,
  });
};

const fetchSpecsAndResults = async (filterQuery) => {
  const [
    {
      res: { records: specsWithIDs },
    },
    { res: rawResult },
  ] = await Promise.all([
    getRecordsFromES(ES_INDICES.SPECS, {
      query: { match_all: {} },
      take: DEFAULT_AGGREGATION_SIZE,
      sort: [],
    }),
    getRecordsFromES(ES_INDICES.PRODUCTS, {
      query: filterQuery,
      take: 0,
      sort: [],
      isParsedResult: false,
    }),
  ]);

  return { specsWithIDs, rawResult };
};

const extractAggregations = (rawResult) => {
  delete rawResult?.body.aggregations?.specs?.doc_count;
  const rawAggregations = get(rawResult, "body.aggregations", []);

  return {
    [AGGREGATION_FIELDS.FAMILY_NAMES]: get(
      rawAggregations,
      AGGREGATION_FIELDS.FAMILY_NAMES,
      {}
    ),
    [AGGREGATION_FIELDS.MANUFACTURERS]: get(
      rawAggregations,
      AGGREGATION_FIELDS.MANUFACTURERS,
      {}
    ),
    [AGGREGATION_FIELDS.PRODUCT_TYPE]: get(
      rawAggregations,
      AGGREGATION_FIELDS.PRODUCT_TYPE,
      {}
    ),
    [AGGREGATION_FIELDS.SUBCATEGORY]: get(
      rawAggregations,
      AGGREGATION_FIELDS.SUBCATEGORY,
      {}
    ),
    ...get(rawAggregations, "specs"),
  };
};

const findSpecById = (specsWithIDs, specName) =>
  specsWithIDs.find(
    (spec) => spec.name.toLowerCase() === specName.toLowerCase()
  );

const processSpecsAggregation = (
  aggItem,
  aggregationRawResult,
  specsWithIDs
) => {
  const specName = aggItem.split(SPECS_PREFIX)[1];
  const specWithID = findSpecById(specsWithIDs, specName);

  if (
    specWithID &&
    isNonEmptyArray(aggregationRawResult[aggItem].unique_values.buckets || [])
  ) {
    const result = { ...aggregationRawResult[aggItem] };
    result.id = get(specWithID, "id", null);
    return result;
  }

  return null;
};

const enhanceAggregationsWithSpecIds = (aggregationRawResult, specsWithIDs) => {
  const newAggregationResult = {};

  Object.keys(aggregationRawResult).forEach((aggItem) => {
    if (aggItem.startsWith(SPECS_PREFIX)) {
      const processedSpec = processSpecsAggregation(
        aggItem,
        aggregationRawResult,
        specsWithIDs
      );
      if (processedSpec) {
        newAggregationResult[aggItem] = processedSpec;
      }
    } else {
      newAggregationResult[aggItem] = aggregationRawResult[aggItem];
    }
  });

  return newAggregationResult;
};

export async function fetchFilters() {
  const { specs = [] } = await getSpecsDetailsFromES();
  const filterQuery = createStaticFilterQuery(specs);

  console.log(JSON.stringify(filterQuery), "filterQuery for static filters");

  const { specsWithIDs, rawResult } = await fetchSpecsAndResults(filterQuery);
  const aggregationRawResult = extractAggregations(rawResult);
  const newAggregationResult = enhanceAggregationsWithSpecIds(
    aggregationRawResult,
    specsWithIDs
  );

  const filters = formateFiltersAgg(newAggregationResult);
  const { res: staticFilters, err } = await matchToContentfulSubcategories(
    filters
  );

  if (err) throw err;
  return staticFilters;
}

const logUpsertResult = (upsertErr, res) => {
  const message = upsertErr || `Static filters updated: ${!!res}!`;
  console.log(message);
};

const fetchAndSaveStaticFiltersFromES = tryCatch(async () => {
  const records = await fetchFilters();
  const { err: upsertErr, res } = await upsertRecords(
    DB_COLLECTIONS.filters,
    records,
    { uniqueIdentifier: UNIQUE_IDENTIFIER }
  );

  logUpsertResult(upsertErr, res);
});

export default fetchAndSaveStaticFiltersFromES;
