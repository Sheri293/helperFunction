const SHIPPING_METHODS = {
  Ground: "ground",
  "2nd Day Air": "2day_air",
  "2nd Day Air A.M.": "2day_air_am",
  "Next Day Air Saver": "nextday_air_saver",
  "Next Day Air": "nextday_air",
  "UPS Next Day Air Early": "nextday_air_earlyam",
  "3 Day Select": "3day_select",
  "Worldwide Expedited": "worldwide_expedited",
  Saver: "saver",
  "Worldwide Express": "worldwide_express",
  "Worldwide Express Plus": "worldwide_express_plus",
  Freight: "freight",
  International: "international",
};

const CONDITION_MAPPINGS = [
  { ui: "New", schema: "newInBox", netsuite: "New in Box" },
  { ui: "New Surplus", schema: "newSurplus", netsuite: "New Surplus" },
  { ui: "Re-Certified", schema: "refurbished", netsuite: "Refurbished" },
  { ui: "Aftermarket", schema: "aftermarket", netsuite: "Aftermarket" },
];

const DEFAULT_METHOD = SHIPPING_METHODS.Ground;
const SANITIZE_REGEX = /[^A-Za-z0-9 !@#$%&()\-_+=[\]:;"',./?]/g;

const REQUIRED_STRING_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "billingStreet",
  "billingCity",
  "billingZip",
  "billingState",
  "billingCountry",
  "shippingStreet",
  "shippingCity",
  "shippingZip",
  "shippingState",
  "shippingCountry",
  "shippingMethod",
  "cardName",
  "cardNumber",
  "cardExp",
];

export function convertNumberWithComma(num) {
  if (typeof num === "string") {
    const withoutComma = num.replace(/,/g, "");
    return parseFloat(withoutComma);
  }
  return num;
}

const isValidString = (v) => v && typeof v === "string";

const isValidNumber = (value) =>
  value !== undefined && !Number.isNaN(Number(value));

const validateStringFields = (o) =>
  REQUIRED_STRING_FIELDS.every((field) => isValidString(o[field]));

const validateNumberFields = (o) =>
  isValidNumber(o.shippingRate) && isValidNumber(o.taxRate);

const validateItems = (items) => {
  if (!Array.isArray(items) || !items.length) return false;
  return items.every(
    (item) =>
      isValidString(item.name) &&
      isValidString(item.condition) &&
      Number(item.quantity) &&
      Number(item.rate)
  );
};

export function requiredFieldsOk(o) {
  return (
    validateStringFields(o) && validateNumberFields(o) && validateItems(o.items)
  );
}

const processValue = (val) => {
  if (val && !Array.isArray(val) && typeof val === "object") {
    return cleanValues(val);
  }
  if (typeof val === "string") {
    return val.replace(SANITIZE_REGEX, "");
  }
  return val;
};

export function cleanValues(order) {
  const cleanedOrder = {};
  Object.keys(order).forEach((key) => {
    cleanedOrder[key] = processValue(order[key]);
  });
  return cleanedOrder;
}

export function setOrderId(order) {
  return { ...order, orderId: String(Date.now()).toUpperCase() };
}

const calculateItemWeight = (item) =>
  Number(item.weight || 0) * Number(item.quantity);

export function setShippingWeight(order) {
  const weight =
    order?.items?.reduce(
      (total, item) => total + calculateItemWeight(item),
      0
    ) || 0;

  return { ...order, shippingWeight: weight || 1 };
}

const mapShippingMethod = (order) => {
  const netMethod = SHIPPING_METHODS[order?.shippingMethod] || DEFAULT_METHOD;

  if (!SHIPPING_METHODS[order.shippingMethod]) {
    order.warnings = order.warnings || [];
    order.warnings.push(
      `Order's shipping method is not available in Netsuite; shipping method used: ${order.shippingMethod}`
    );
  }

  return netMethod;
};

const createCustomerInfo = (order) => ({
  company: order.company,
  name: `${order.firstName} ${order.lastName}`,
  email: order.email,
  phone: order.phone,
  fax: order.fax,
});

const createBillingInfo = (order) => ({
  address1: order.billingStreet,
  city: order.billingCity,
  state: order.billingState,
  zip: order.billingZip,
  country: order.billingCountry,
});

const createPaymentInfo = (order) => ({
  name: order.cardName,
  card: order.cardNumber,
  exp: order.cardExp,
});

const createShippingInfo = (order, method) => ({
  address1: order.shippingStreet,
  city: order.shippingCity,
  state: order.shippingState,
  zip: order.shippingZip,
  country: order.shippingCountry,
  method,
  rate: order.shippingRate,
});

const mapItemConditions = (items) =>
  items.map((item) => {
    const cond = CONDITION_MAPPINGS.find(
      (condItem) => condItem.ui === item.condition
    );
    return cond ? { ...item, condition: cond.netsuite } : item;
  });

export const mapOrder = (order) => {
  const netMethod = mapShippingMethod(order);

  return {
    test: process.env.NODE_ENV !== "production",
    lead: order.referrer === "paid" ? "web_paid" : "web",
    sessionId: order?.sessionId || null,
    orderId: order.orderId,
    customer_po_number: order.referenceOrderNo,
    memo: (order.warnings || []).join("\n"),
    is_taxable: !order.attachment ? "T" : "F",
    products_stock: order.productsStock,
    fulfillment_tier: order.productsStock === 100 ? 1 : null,
    quantity_flag: order.quantity_flag,
    referrer: order.referrer || "organic",
    customer: createCustomerInfo(order),
    billing: createBillingInfo(order),
    payment: createPaymentInfo(order),
    shipping: createShippingInfo(order, netMethod),
    items: mapItemConditions(order.items),
  };
};
