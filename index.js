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
    cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

/* ===== routes ===== */

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

/* ===== GET TASK + CHECKLIST FROM SUPABASE ===== */
app.get("/task/:day", async (req, res) => {
  const day = Number(req.params.day);

  try {
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("day", day)
      .single();

    if (taskError) throw taskError;

    const { data: checklist, error: checklistError } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("task_id", task.id)
      .order("id");

    if (checklistError) throw checklistError;

    res.json({
      ok: true,
      task,
      checklist,
      can_open_report: true,
      already_submitted: false
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===== checklist toggle ===== */
app.post("/checklist/toggle", async (req, res) => {
  const { id, done } = req.body;

  await supabase
    .from("checklist_items")
    .update({ done })
    .eq("id", id);

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
  await supabase.from("daily_reports").insert(req.body);
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
