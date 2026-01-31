// index.js
import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 8080;

// ===== MIDDLEWARE =====
app.use(express.json());

// ===== SIMPLE LOG =====
console.log("🟢 BOOT: starting app");

// ===== HEALTHCHECK =====
app.get("/health", (req, res) => {
  console.log("💓 HEALTH HIT");
  res.json({ ok: true });
});

// ===== AUTH =====
app.post("/auth", async (req, res) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      return res.status(400).json({ ok: false, error: "NO_INIT_DATA" });
    }

    // 🔴 временно: фейковый токен (как у тебя раньше работало)
    // потом подключим реальную проверку Telegram
    return res.json({
      ok: true,
      token: "DEV_TOKEN"
    });
  } catch (e) {
    console.error("AUTH ERROR", e);
    res.status(500).json({ ok: false });
  }
});

// ===== MOCK AUTH MIDDLEWARE =====
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ ok: false, error: "NO_AUTH" });
  }
  next();
});

// ===== TASK BY DAY =====
app.get("/task/:day", async (req, res) => {
  const day = Number(req.params.day);

  return res.json({
    ok: true,
    task: {
      id: day,
      title: `Задание дня ${day}`
    },
    checklist: [
      { id: "a", title: "Первый пункт", done: false },
      { id: "b", title: "Второй пункт", done: false }
    ],
    can_open_report: true,
    already_submitted: false
  });
});

// ===== CHECKLIST TOGGLE =====
app.post("/checklist/toggle", async (req, res) => {
  const { checklist_id, done } = req.body;

  console.log("📝 CHECKLIST", checklist_id, done);

  res.json({ ok: true });
});

// ===== DAILY REPORT =====
app.post("/daily-report/submit", async (req, res) => {
  const { task_id, report_text, photo_url } = req.body;

  console.log("📨 REPORT", {
    task_id,
    report_text,
    photo_url
  });

  res.json({ ok: true });
});

// ===== START SERVER =====
console.log("🟢 BEFORE LISTEN");
app.listen(PORT, () => {
  console.log(`🚀 SERVER STARTED ON ${PORT}`);
});
