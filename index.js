const express = require("express");

console.log("🟢 BOOT: starting app");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===== HEALTH ===== */
app.get("/health", (_, res) => {
  console.log("💓 HEALTH HIT");
  res.status(200).send("OK");
});

/* ===== ROOT ===== */
app.get("/", (_, res) => {
  res.send("SERVER IS ALIVE");
});

/* ===== START ===== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});

/* ===== KEEP EVENT LOOP ALIVE ===== */
setInterval(() => {
  console.log("🟢 KEEPALIVE TICK", new Date().toISOString());
}, 30_000);

/* ===== PROCESS DEBUG ===== */
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM RECEIVED");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT RECEIVED");
  process.exit(0);
});

process.on("exit", code => {
  console.log("❌ PROCESS EXIT WITH CODE", code);
});

process.on("unhandledRejection", err => {
  console.error("🔥 UNHANDLED REJECTION", err);
});
