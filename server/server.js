import { LowSync } from "lowdb";
import { JSONFileSync } from "lowdb/node";
import express from "express";

const db = new LowSync(new JSONFileSync(process.env.DB_PATH || "db.json"), { results: [], outages: [] });
db.read();

// purge malformed outage records left over from a schema mismatch bug
const validOutages = db.data.outages.filter(o => o && (o.event === "lost" || o.event === "restored") && o.timestamp);
if (validOutages.length !== db.data.outages.length) {
  console.warn(`Removed ${db.data.outages.length - validOutages.length} malformed outage record(s) from the database`);
  db.data.outages = validOutages;
  db.write();
}

const secret = process.env.SECRET;
if (secret === undefined) console.warn("The secret has not been defined!");

const app = express();
app.use(express.json());

app.use(express.static("public"));

app.set("port", process.env.PORT || 3000);

app.get("/", function(request, response) {
  response.sendFile(import.meta.dirname + "/views/index.html");
});

// get bandwidth test results for graphing here
app.get("/read", function(request, response) {
  const data = db.data.results;
  const prepared = data.map(s => ({ x: s.date, y: Number(s.speed).toFixed(3) }));
  response.send(prepared);
});

// send bandwidth test results here
app.post("/save", function(request, response) {
  // not secure against timing-based attacks!
  if (request.body.pw !== secret) {
    return response.status(400).send("Bad pw");
  }
  db.data.results.push({
    speed: request.body.speed,
    unit: request.body.units,
    date: request.body.date * 1000 // correct to JS time
  });
  db.write();
  response.send("OK");
});

// log a WiFi connectivity event (lost or restored) from the connectivity monitor
app.post("/outage", function(request, response) {
  if (request.body.pw !== secret) {
    return response.status(400).send("Bad pw");
  }
  if (request.body.event !== "lost" && request.body.event !== "restored") {
    return response.status(400).send("Bad event");
  }
  if (!request.body.timestamp) {
    return response.status(400).send("Missing timestamp");
  }
  db.data.outages.push({
    event: request.body.event,
    timestamp: request.body.timestamp,
    interface: request.body.interface,
    hostname: request.body.hostname,
    mac: request.body.mac,
    ip: request.body.ip,
    duration_s: request.body.duration_s
  });
  db.write();
  response.send("OK");
});

app.get("/outages", function(request, response) {
  response.send(db.data.outages);
});

// listen for requests :)
const listener = app.listen(app.get("port"), function() {
  console.log("Your app is listening on port " + listener.address().port);
});
