import { test, expect } from "@playwright/test";

const TEST_DATA = {
  MANUFACTURER_VALUES: {
    SINGLE_STRING: "Samsung Electronics",
    SINGLE_WORD: "Samsung",
    ARRAY: ["Samsung Electronics", "Apple Inc"],
    EMPTY_CASES: ["", null, undefined],
  },
  MANUFACTURER_OBJECTS: {
    WITH_DISTRIBUTOR: [
      {
        name: "Samsung",
        country: "Korea",
        authorized_distributor: true,
      },
      {
        name: "Apple",
        country: "USA",
        authorized_distributor: false,
      },
    ],
    EMPTY_ARRAY: [],
  },
};

const EXPECTED_VALUES = {
  SAMSUNG_ELECTRONICS: "Samsung Electronics",
  SAMSUNG_ELECTRONICS_HYPHEN: "Samsung-Electronics",
  APPLE_INC: "Apple Inc",
  APPLE_INC_HYPHEN: "Apple-Inc",
  SAMSUNG_ONLY: ["Samsung"],
  EMPTY_ARRAY: [],
};

const REQUIRED_PROPERTIES = {
  MANUFACTURER_BASIC: ["name", "country"],
  FORBIDDEN_PROPERTIES: ["authorized_distributor"],
};

const validateContainsValues = (result, expectedValues) => {
  expectedValues.forEach((value) => {
    expect(result).toContain(value);
  });
};

const validateArrayEquality = (result, expected) => {
  expect(result).toEqual(expected);
};

const validateObjectProperties = (obj, requiredProps, forbiddenProps = []) => {
  requiredProps.forEach((prop) => {
    expect(obj).toHaveProperty(prop);
  });
  forbiddenProps.forEach((prop) => {
    expect(obj).not.toHaveProperty(prop);
  });
};

const testEmptyCases = (
  testFunction,
  expectedResult = EXPECTED_VALUES.EMPTY_ARRAY
) => {
  TEST_DATA.MANUFACTURER_VALUES.EMPTY_CASES.forEach((testCase) => {
    expect(testFunction(testCase)).toEqual(expectedResult);
  });
};

test.describe("Manufacturer Utility Functions", () => {
  test.describe("formatManufacturerValues", () => {
    test("should format single manufacturer string", () => {
      const result = formatManufacturerValues(
        TEST_DATA.MANUFACTURER_VALUES.SINGLE_STRING
      );
      validateContainsValues(result, [
        EXPECTED_VALUES.SAMSUNG_ELECTRONICS,
        EXPECTED_VALUES.SAMSUNG_ELECTRONICS_HYPHEN,
      ]);
    });
    test("should format array of manufacturers", () => {
      const result = formatManufacturerValues(
        TEST_DATA.MANUFACTURER_VALUES.ARRAY
      );
      validateContainsValues(result, [
        EXPECTED_VALUES.SAMSUNG_ELECTRONICS,
        EXPECTED_VALUES.SAMSUNG_ELECTRONICS_HYPHEN,
        EXPECTED_VALUES.APPLE_INC,
        EXPECTED_VALUES.APPLE_INC_HYPHEN,
      ]);
    });
    test("should handle single word manufacturers", () => {
      const result = formatManufacturerValues(
        TEST_DATA.MANUFACTURER_VALUES.SINGLE_WORD
      );
      validateArrayEquality(result, EXPECTED_VALUES.SAMSUNG_ONLY);
    });
    test("should handle empty or invalid input", () => {
      testEmptyCases(formatManufacturerValues);
    });
  });
  test.describe("formatManufacturerObject", () => {
    test("should remove authorized_distributor property", () => {
      const result = formatManufacturerObject(
        TEST_DATA.MANUFACTURER_OBJECTS.WITH_DISTRIBUTOR
      );
      expect(result).toHaveLength(2);
      result.forEach((manufacturer) => {
        validateObjectProperties(
          manufacturer,
          REQUIRED_PROPERTIES.MANUFACTURER_BASIC,
          REQUIRED_PROPERTIES.FORBIDDEN_PROPERTIES
        );
      });
    });
    test("should handle empty array", () => {
      const result = formatManufacturerObject(
        TEST_DATA.MANUFACTURER_OBJECTS.EMPTY_ARRAY
      );
      validateArrayEquality(result, EXPECTED_VALUES.EMPTY_ARRAY);
    });
  });
});
