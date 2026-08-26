import { LowSync } from "lowdb";
import { JSONFileSync } from "lowdb/node";
import express from "express";

const db = new LowSync(new JSONFileSync(process.env.DB_PATH || "db.json"), { results: {}, machines: {} });
db.read();
db.data.results = db.data.results || {};
db.data.machines = db.data.machines || {};

const secret = process.env.SECRET;
if (secret === undefined) console.warn("The secret has not been defined!");

// frontend statistics/UI tunables, overridable via env vars without touching client code
const numberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};
const clientConfig = {
  // modified z-score sensitivity: lower flags more points as outliers, higher flags fewer
  outlierThreshold: numberEnv("OUTLIER_THRESHOLD", 1.5),
  // consistency constant that scales MAD to be comparable to stddev under a normal distribution (Φ⁻¹(0.75))
  madConsistencyConstant: numberEnv("MAD_CONSISTENCY_CONSTANT", 0.6745),
  // minimum wheel-zoom / manual range span in milliseconds
  minRangeMs: numberEnv("MIN_RANGE_MS", 60 * 1000),
  // fixed cutoff for the low-speed outliers table, in Mbps
  lowSpeedThresholdMbps: numberEnv("LOW_SPEED_THRESHOLD_MBPS", 10.0)
};

const app = express();
app.use(express.json());

app.use(express.static("public"));

app.set("port", process.env.PORT || 3000);

app.get("/", function(request, response) {
  response.sendFile(import.meta.dirname + "/views/index.html");
});

// frontend tunables (outlier detection, zoom, thresholds) so they can be changed via env vars
app.get("/config", function(request, response) {
  response.send(clientConfig);
});

// get bandwidth test results for graphing here, grouped by reporting machine
app.get("/read", function(request, response) {
  const series = {};
  for (const [machineKey, entries] of Object.entries(db.data.results)) {
    series[machineKey] = entries.map(s => ({ x: s.date, y: Number(s.speed).toFixed(3) }));
  }
  response.send({ machines: db.data.machines, series });
});

// send bandwidth test results here
app.post("/save", function(request, response) {
  // not secure against timing-based attacks!
  if (request.body.pw !== secret) {
    return response.status(400).send("Bad pw");
  }
  // machines are identified by MAC address (most stable across DHCP/IP changes),
  // falling back to IP then hostname when a client can't report a MAC
  const machineKey = request.body.mac || request.body.ip || request.body.hostname || "unknown";
  if (!db.data.results[machineKey]) db.data.results[machineKey] = [];
  db.data.results[machineKey].push({
    speed: request.body.speed,
    unit: request.body.units,
    date: request.body.date * 1000 // correct to JS time
  });
  db.data.machines[machineKey] = {
    mac: request.body.mac || null,
    ip: request.body.ip || null,
    hostname: request.body.hostname || null,
    connection: request.body.connection || null
  };
  db.write();
  response.send("OK");
});

// listen for requests :)
const listener = app.listen(app.get("port"), function() {
  console.log("Your app is listening on port " + listener.address().port);
});
