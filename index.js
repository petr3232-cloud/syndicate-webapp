const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===== SUPABASE ===== */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/* ===== middleware ===== */
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

/* ===== multer ===== */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

console.log("🟢 BOOT: starting app");

/* ===== routes ===== */

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/auth", (_, res) => {
  res.json({ token: "dev-token" });
});

/* ===== TASK + CHECKLIST ===== */
app.get("/task/:day", async (req, res) => {
  const day = Number(req.params.day);

  // fallback — если Supabase не подключён
  if (!supabase) {
    return res.json({
      ok: true,
      task: { id: day, title: `Задание дня ${day}` },
      checklist: [
        { id: "1", title: "Сделать шаг 1", done: false },
        { id: "2", title: "Сделать шаг 2", done: false }
      ],
      can_open_report: true,
      already_submitted: false
    });
  }

  // Supabase версия
  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("day", day)
    .single();

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("day", day);

  res.json({
    ok: true,
    task: task ?? { id: day, title: `Задание дня ${day}` },
    checklist: checklist ?? [],
    can_open_report: true,
    already_submitted: false
  });
});

app.post("/checklist/toggle", async (req, res) => {
  const { checklist_id, done } = req.body;

  if (supabase) {
    await supabase
      .from("checklist_items")
      .update({ done })
      .eq("id", checklist_id);
  }

  res.json({ ok: true });
});

/* ===== upload photo ===== */
app.post(
  "/daily-report/upload-photo",
  upload.single("photo"),
  (req, res) => {
    res.json({
      ok: true,
      photos: [`/uploads/${req.file.filename}`]
    });
  }
);

/* ===== submit report ===== */
app.post("/daily-report/submit", async (req, res) => {
  const { task_id, report_text, photos } = req.body;

  if (supabase) {
    await supabase.from("reports").insert({
      task_id,
      report_text,
      photos
    });
  }

  console.log("📩 REPORT:", req.body);
  res.json({ ok: true });
});

/* ===== frontend fallback ===== */
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ===== start ===== */
app.listen(PORT, () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
