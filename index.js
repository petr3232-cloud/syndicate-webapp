const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8080;

/* ================== SUPABASE ================== */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ================== MIDDLEWARE ================== */
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

/* ================== MULTER ================== */
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

console.log("🟢 BOOT: app starting");

/* ================== HEALTH ================== */
app.get("/health", (_, res) => {
  res.status(200).json({ ok: true });
});

/* ================== AUTH (stub) ================== */
app.post("/auth", (_, res) => {
  res.json({ token: "dev-token" });
});

/* ================== TASK + CHECKLIST ================== */
app.get("/task/:day", async (req, res) => {
  const day = Number(req.params.day);

  try {
    /* ---- TASK ---- */
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, day, title, mission, description")
      .eq("day", day)
      .single();

    if (taskError) throw taskError;

    /* ---- CHECKLIST ---- */
    const { data: checklist, error: checklistError } = await supabase
      .from("checklist_items")
      .select("id, title")
      .eq("task_id", task.id)
      .order("order", { ascending: true });

    if (checklistError) throw checklistError;

    res.json({
      ok: true,
      task,
      checklist: checklist.map(i => ({
        id: i.id,
        title: i.title,
        done: false
      })),
      can_open_report: true,
      already_submitted: false
    });
  } catch (err) {
    console.error("❌ TASK LOAD ERROR:", err);
    res.status(500).json({ ok: false });
  }
});

/* ================== CHECKLIST TOGGLE ================== */
app.post("/checklist/toggle", async (_, res) => {
  // логика отметки будет позже
  res.json({ ok: true });
});

/* ================== PHOTO UPLOAD ================== */
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

/* ================== REPORT SUBMIT ================== */
app.post("/daily-report/submit", async (req, res) => {
  console.log("📩 REPORT:", req.body);
  res.json({ ok: true });
});

/* ================== FRONTEND FALLBACK ================== */
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ================== START ================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
