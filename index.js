const express = require("express");
const app = express();

const PORT = process.env.PORT || 8080;

console.log("🟢 BOOT: starting app");

app.use(express.json({ limit: "10mb" })); // важно для base64 фото

/* ================= HEALTH ================= */

app.get("/health", (req, res) => {
  console.log("💓 HEALTH HIT");
  res.status(200).json({ ok: true });
});

/* ================= AUTH ================= */

app.post("/auth", (req, res) => {
  res.json({ token: "dev-token" });
});

/* ================= TASK ================= */

app.get("/task/:day", (req, res) => {
  res.json({
    ok: true,
    task: {
      id: 1,
      title: `Задание дня ${req.params.day}`
    },
    checklist: [
      { id: "1", title: "Сделать шаг 1", done: false },
      { id: "2", title: "Сделать шаг 2", done: false }
    ],
    can_open_report: true,
    already_submitted: false
  });
});

/* ================= CHECKLIST ================= */

app.post("/checklist/toggle", (req, res) => {
  res.json({ ok: true });
});

/* ================= REPORT ================= */

/*
  body:
  {
    task_id: number,
    report_text: string,
    photo_base64?: string
  }
*/

app.post("/daily-report/submit", (req, res) => {
  const { task_id, report_text, photo_base64 } = req.body;

  console.log("📝 REPORT:", {
    task_id,
    report_text_length: report_text?.length || 0,
    has_photo: !!photo_base64
  });

  // тут позже:
  // - загрузка фото в Supabase Storage
  // - сохранение URL в БД

  res.json({ ok: true });
});

/* ================= START ================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
