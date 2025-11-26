const fs = require("fs");
const path = require("path");

function loadDataset() {
  const filePath = path.join(__dirname, "../data/dataset.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}


function fToC(f) {
  return ((f - 32) * 5) / 9;
}

function kToC(k) {
  return k - 273.15;
}

function inToMm(inches) {
  return inches * 25.4;
}

function isValidDate(dateStr) {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function findDeepest(obj, level = 0) {
  let maxLevel = level;
  let deepestObj = obj;

  if (obj && typeof obj === "object") {
    for (const key in obj) {
      const [subLevel, subObj] = findDeepest(obj[key], level + 1);
      if (subLevel > maxLevel) {
        maxLevel = subLevel;
        deepestObj = subObj;
      }
    }
  }

  return [maxLevel, deepestObj];
}

module.exports = {
  loadDataset,
  fToC,
  kToC,
  inToMm,
  isValidDate,
  findDeepest,
};
