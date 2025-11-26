const helpers = require("./helpers");
const dataset = helpers.loadDataset();
function getHighestTemp() {
  let maxTemp = -Infinity;
  let stationId = null;

  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      const obsDate = new Date(obs.at);
      if (isNaN(obsDate)) return; 

      for (const sensorId in obs.readings) {
        let val = obs.readings[sensorId];

        if (val === null || val === undefined) continue;

        if (typeof val === "string") val = parseFloat(val);

        const sensor = station.sensors.find((s) => s.id === sensorId);
        if (!sensor) continue;

        if (sensor.type !== "temperature") continue;

         
        if (sensor.unit === "F") val = helpers.fToC(val);
        if (sensor.unit === "K") val = helpers.kToC(val);

        if (val > maxTemp) {
          maxTemp = val;
          stationId = station.id;
        }
      }
    });
  });

  return { maxTemp, stationId };
}



function getInvalidTimestamps() {
  const invalidObs = [];

  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      const obsDate = new Date(obs.at);
      if (isNaN(obsDate)) {
        invalidObs.push({
          stationId: station.id,
          observation: obs
        });
      }
    });
  });

  return invalidObs;
  
}

function getDeepestMetadata() {
  let deepest = { level: 0, data: null };

  function findDeepest(obj, level = 1) {
    let maxLevel = level;
    let deepestData = obj;

    if (obj && typeof obj === "object") {
      for (const key in obj) {
        const val = obj[key];
        if (val && typeof val === "object") {
          const { level: childLevel, data: childData } = findDeepest(val, level + 1);
          if (childLevel > maxLevel) {
            maxLevel = childLevel;
            deepestData = childData;
          }
        }
      }
    }

    return { level: maxLevel, data: deepestData };
  }

  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      if (obs.meta) {
        const { level, data } = findDeepest(obs.meta);
        if (level > deepest.level) deepest = { level, data };
      }
    });
  });

  return deepest.data;
}

function getWindSpike() {
  let spike = { value: -Infinity, timestamp: null };
  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      for (const sensorId in obs.readings) {
        const sensor = station.sensors.find((s) => s.id === sensorId);
        if (!sensor || sensor.type !== "wind") continue;
        let val = obs.readings[sensorId];
        if (typeof val === "string") val = parseFloat(val);
        if (val > spike.value) spike = { value: val, timestamp: obs.at };
      }
    });
  });
  return spike;
}

function getDuplicateSensors() {
  return dataset.anomaliesIndex.duplicateSensors;
}

function getPrecipTotals() {
  const totals = {};
  dataset.stations.forEach((station) => {
    let sum = 0;
    station.observations.forEach((obs) => {
      for (const sensorId in obs.readings) {
        const sensor = station.sensors.find((s) => s.id === sensorId);
        if (!sensor || sensor.type !== "precipitation") continue;
        let val = obs.readings[sensorId];
        if (val === null || val === undefined) continue;
        if (sensor.unit === "in") val = helpers.inToMm(val);
        sum += val;
      }
    });
    totals[station.id] = sum;
  });
  return totals;
}

function getStationsWithMissingCoords() {
  return dataset.stations
    .filter((station) => !station.coords || station.coords.lat == null || station.coords.lon == null)
    .map((station) => ({
      stationId: station.id,
      latestReadings: station.observations.slice(-1)[0]?.readings || {},
    }));
}

function getForecastTempsC(stationId) {
  const temps = [];

  dataset.forecasts.models.forEach((model) => {
    const forecasts = model.stationsForecasts[stationId];
    if (!forecasts) return;

    forecasts.forEach((f) => {
      if (f.tempHigh !== undefined && f.tempLow !== undefined) {
        temps.push({ day: f.day, highC: f.tempHigh, lowC: f.tempLow });
      }

      if (f.candidates && Array.isArray(f.candidates)) {
        f.candidates.forEach((c) => {
          let highC = c.tempHigh;
          let lowC = c.tempLow;

          const sensorUnit = dataset.units.temperature; 
          if (c.unit === "F") highC = helpers.fToC(highC);
          if (c.unit === "F") lowC = helpers.fToC(lowC);
          if (c.unit === "K") highC = helpers.kToC(highC);
          if (c.unit === "K") lowC = helpers.kToC(lowC);

          temps.push({ day: f.day, highC, lowC });
        });
      }
    });
  });

  return temps;
}


function getUnitMismatchObservations() {
  const mismatches = [];

  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      for (const sensorId in obs.readings) {
        const sensor = station.sensors.find((s) => s.id === sensorId);
        if (!sensor) continue;

        const expectedUnit = dataset.units[sensor.type];
        let readingUnit = sensor.unit;

        if (obs.meta && obs.meta.units && obs.meta.units[sensor.type]) {
          readingUnit = obs.meta.units[sensor.type];
        }

        if (readingUnit !== expectedUnit) {
          mismatches.push({
            stationId: station.id,
            sensorId: sensor.id,
            at: obs.at,
            expected: expectedUnit,
            found: readingUnit
          });
        }
      }
    });
  });
  dataset.forecasts.models.forEach((model) => {
    for (const stationId in model.stationsForecasts) {
      const forecasts = model.stationsForecasts[stationId];
      forecasts.forEach((f) => {
       
      });
    }
  });

  return mismatches;
}


function getNowcastHorizon() {
  let allTemps = [];
  dataset.forecasts.nowcasts.forEach((nc) => {
    nc.values.forEach((v) => {
      allTemps.push({ stationId: nc.stationId, inMinutes: v.in, tempC: v.tempC });
    });
  });
  if (!allTemps.length) return {};
  const earliest = allTemps.reduce((a, b) => (a.inMinutes < b.inMinutes ? a : b));
  const latest = allTemps.reduce((a, b) => (a.inMinutes > b.inMinutes ? a : b));
  return { earliest, latest };
}

module.exports = {
  getHighestTemp,
  getInvalidTimestamps,
  getDeepestMetadata,
  getWindSpike,
  getDuplicateSensors,
  getPrecipTotals,
  getStationsWithMissingCoords,
  getForecastTempsC,
  getUnitMismatchObservations,
  getNowcastHorizon,
};
