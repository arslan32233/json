const queries = require("./queries");

console.log("1. Highest Temperature:", queries.getHighestTemp());

console.log("2. Invalid Timestamps:", queries.getInvalidTimestamps());

console.log("3. Deepest Metadata:", queries.getDeepestMetadata());

console.log("4. Largest Wind Reading:", queries.getWindSpike());

console.log("5. Duplicate Sensors:", queries.getDuplicateSensors());

console.log("6. Precipitation Totals (mm):", queries.getPrecipTotals());

console.log("7. Stations with Missing Coords:", queries.getStationsWithMissingCoords());

console.log("8. Forecast Temps (C) for st-900:", queries.getForecastTempsC("st-900"));

console.log("9. Unit Mismatch Observations:", queries.getUnitMismatchObservations());

console.log("10. Nowcast Horizon:", queries.getNowcastHorizon());
