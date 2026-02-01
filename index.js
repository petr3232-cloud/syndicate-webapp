const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===== SUPABASE ===== */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ===== middleware ===== */
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

/* ===== multer ===== */
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

console.log("🟢 BOOT: starting app");

/* ===== health ===== */
app.get("/health", (_, res) => {
  res.json({ ok: true });
});

/* ===== task by day (REAL DATA) ===== */
app.get("/task/:day", async (req, res) => {
  try {
    const day = Number(req.params.day);

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("day", day)
      .single();

    if (taskError || !task) {
      return res.json({ ok: false, message: "Task not found" });
    }

    const { data: checklist } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("task_id", task.id)
      .order("order");

    res.json({
      ok: true,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
      },
      checklist: checklist || [],
      can_open_report: true,
      already_submitted: false,
    });
  } catch (e) {
    console.error("❌ /task error", e);
    res.status(500).json({ ok: false });
  }
});

/* ===== upload photo ===== */
app.post(
  "/daily-report/upload-photo",
  upload.single("photo"),
  (req, res) => {
    res.json({
      ok: true,
      photos: [`/uploads/${req.file.filename}`],
    });
  }
);

/* ===== submit report ===== */
app.post("/daily-report/submit", async (req, res) => {
  try {
    const { task_id, text } = req.body;

    const { data: report } = await supabase
      .from("daily_reports")
      .insert({ task_id, text })
      .select()
      .single();

    res.json({ ok: true, report });
  } catch (e) {
    console.error("❌ submit report", e);
    res.status(500).json({ ok: false });
  }
});

/* ===== frontend fallback ===== */
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ===== start ===== */
app.listen(PORT, () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
