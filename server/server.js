import { LowSync } from "lowdb";
import { JSONFileSync } from "lowdb/node";
import express from "express";

const db = new LowSync(new JSONFileSync(process.env.DB_PATH || "db.json"), { results: [], outages: [] });
db.read();

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
  const trimmed = prepared.slice(Math.max(prepared.length - 48, 0));
  response.send(trimmed);
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

// log a completed WiFi outage (lost + restored timestamps in ms)
app.post("/outage", function(request, response) {
  if (request.body.pw !== secret) {
    return response.status(400).send("Bad pw");
  }
  db.data.outages.push({
    lost_at: request.body.lost_at,
    restored_at: request.body.restored_at
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
