export const formatManufacturerValues = (value) => {
  const formattedManufacturerValues = [];
  const formatSingle = (manufacturer) => {
    if (!manufacturer || typeof manufacturer !== "string") return [];
    const manufacturerValues = manufacturer.split(" ") || [];
    return manufacturerValues.length <= 1
      ? manufacturerValues
      : [manufacturer, manufacturerValues.join("-")];
  };
  if (Array.isArray(value)) {
    value.forEach((valueItem) => {
      formattedManufacturerValues.push(...formatSingle(valueItem));
    });
  } else if (value) {
    formattedManufacturerValues.push(...formatSingle(value));
  }
  return formattedManufacturerValues;
};

export const formatManufacturerObject = (array) => {
  const propertiesToOmit = ["authorized_distributor"];
  return array.map((obj) => {
    const newObj = { ...obj };
    propertiesToOmit.forEach((prop) => delete newObj[prop]);
    return newObj;
  });
};
