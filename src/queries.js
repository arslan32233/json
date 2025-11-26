const helpers = require("./helpers");
const dataset = helpers.loadDataset();
function getHighestTemp() {
  let maxTemp = -Infinity;
  let stationId = null;

  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      for (const sensorId in obs.readings) {
        let val = obs.readings[sensorId];
        if (val === null || val === undefined) continue;
        if (typeof val === "string") val = parseFloat(val);

        const sensor = station.sensors.find((s) => s.id === sensorId);
        if (!sensor) continue;
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
  const result = [];
  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      if (!helpers.isValidDate(obs.at)) {
        result.push({ stationId: station.id, observation: obs });
      }
    });
  });
  return result;
}

function getDeepestMetadata() {
  let deepest = { level: 0, data: null };
  dataset.stations.forEach((station) => {
    station.observations.forEach((obs) => {
      if (obs.meta) {
        const [lvl, obj] = helpers.findDeepest(obs.meta);
        if (lvl > deepest.level) deepest = { level: lvl, data: obj };
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
      let high = f.tempHigh;
      let low = f.tempLow;
      temps.push({ day: f.day, highC: high, lowC: low });
    });
  });
  return temps;
}

function getUnitMismatchObservations() {
  return dataset.anomaliesIndex.unitMismatches;
  
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
