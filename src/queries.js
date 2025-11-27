const helpers = require("./helpers");
const dataset = helpers.loadDataset();
function getHighestTemp() {
  let maxTemp = -Infinity;
  let stationId = null;

  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      if (isNaN(new Date(obs.at))) return;

      for (const sensorId in obs.readings) {
        let val = obs.readings[sensorId];

        if (val === null || val === undefined) continue;

        if (typeof val === "string") val = parseFloat(val);
        if (isNaN(val)) continue;

        const sensor = station.sensors.find((s) => s.id === sensorId);
        if (!sensor || sensor.type !== "temperature") continue;

        if (sensor.unit === "F") val = (val - 32) * (5 / 9);
        if (sensor.unit === "K") val = val - 273.15;

        if (val < -50 || val > 60) continue;

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
  const invalid = [];

  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      const obsDate = new Date(obs.at);
      if (isNaN(obsDate)) {
        invalid.push({
          stationId: station.id,
          observation: obs
        });
      }
    });
  });

  return invalid;
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
  let spike = { value: -Infinity, timestamp: null, sid: null, station: null };

  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      for (const sensorId in obs.readings) {
        const sensor = station.sensors.find((s) => s.id === sensorId);
        if (!sensor || sensor.type !== "wind") continue;

        let val = obs.readings[sensorId];
        if (typeof val === "string") val = parseFloat(val);

        if (val > spike.value) {
          spike = {
            value: val,
            timestamp: obs.at,
            sid: sensorId,
            station: station.id
          };
        }
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
    let total = 0;

    station.observations.forEach((obs) => {
      if (isNaN(new Date(obs.at))) return;

      for (const sensorId in obs.readings) {
        const sensor = station.sensors.find((s) => s.id === sensorId);
        if (!sensor || sensor.type !== "precipitation") continue;

        let val = obs.readings[sensorId];
        if (val === null || val === undefined) continue;

        if (typeof val === "string") val = parseFloat(val);

        if (val < 0) continue;

        
        if (sensor.unit === "in") val *= 25.4;
        if (sensor.unit === "mm") val *= 1;

        total += val;
      }
    });

    totals[station.id] = parseFloat(total.toFixed(2)); 
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
function getForecastTempsC() {
  const result = [];

  dataset.stations.forEach((station) => {
    const stationId = station.id;

    dataset.forecasts.models.forEach((model) => {
      const forecasts = model.stationsForecasts[stationId];
      if (!forecasts) return;

      forecasts.forEach((f) => {
        let high = f.tempHigh;
        let low = f.tempLow;

        if (high != null) {
          if (f.tempHighUnit === "F") high = (high - 32) * (5 / 9);
          if (f.tempHighUnit === "K") high = high - 273.15;
        }

        if (low != null) {
          if (f.tempLowUnit === "F") low = (low - 32) * (5 / 9);
          if (f.tempLowUnit === "K") low = low - 273.15;
        }

        result.push({
          stationId,
          modelId: model.id,
          day: f.day,
          highC: high,
          lowC: low,
        });
      });
    });
  });

  return result;
}






function getUnitMismatchObservations() {
  const mismatches = [];

  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      for (const sensorId in obs.readings) {
        const sensor = station.sensors.find((s) => s.id === sensorId);
        if (!sensor) continue;

        let expectedUnit;
        switch (sensor.type) {
          case "temperature":
            expectedUnit = "C";
            break;
          case "rain":
          case "precipitation":
            expectedUnit = "mm";
            break;
          case "wind":
            expectedUnit = "m/s"; 
            break;
          default:
            expectedUnit = undefined;
        }

        let foundUnit = sensor.unit;
        if (obs.meta && obs.meta.units && obs.meta.units[sensor.type]) {
          foundUnit = obs.meta.units[sensor.type];
        }

        if (expectedUnit !== foundUnit) {
          mismatches.push({
            stationId: station.id,
            sensorId: sensor.id,
            at: obs.at,
            expected: expectedUnit,
            found: foundUnit
          });
        }
      }
    });
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
