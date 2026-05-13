export const UNSET = Symbol("UNSET");

export function recursiveMerge(...dicts) {
  if (!dicts.length) return {};
  const result = {};
  for (const d of dicts) {
    if (d == null) continue;
    for (const [key, value] of Object.entries(d)) {
      if (value === UNSET) continue;
      if (key in result && typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key]) &&
          typeof value === "object" && value !== null && !Array.isArray(value)) {
        result[key] = recursiveMerge(result[key], value);
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        result[key] = recursiveMerge(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}
