const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

console.log("🟢 BOOT: starting app");

app.get("/health", (req, res) => {
  console.log("💓 HEALTH HIT");
  res.json({ ok: true });
});

app.post("/auth", (req, res) => {
  res.json({ token: "dev-token" });
});

app.get("/task/:day", (req, res) => {
  res.json({
    ok: true,
    task: { id: 1, title: `Задание дня ${req.params.day}` },
    checklist: [
      { id: "1", title: "Сделать шаг 1", done: false },
      { id: "2", title: "Сделать шаг 2", done: false }
    ],
    can_open_report: true,
    already_submitted: false
  });
});

app.post("/checklist/toggle", (req, res) => {
  res.json({ ok: true });
});

app.post("/daily-report/submit", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
