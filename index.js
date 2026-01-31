const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===== MIDDLEWARE ===== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===== STATIC (FRONT) ===== */
app.use(express.static(path.join(__dirname, "public")));

/* ===== HEALTH ===== */
app.get("/health", (req, res) => {
  console.log("💓 HEALTH HIT");
  res.json({ ok: true });
});

/* ===== AUTH ===== */
app.post("/auth", (req, res) => {
  res.json({ token: "dev-token" });
});

/* ===== TASK ===== */
app.get("/task/:day", (req, res) => {
  const day = Number(req.params.day);

  res.json({
    ok: true,
    task: {
      id: day,
      title: `Задание дня ${day}`,
      description: `Это описание задания для дня ${day}`
    },
    checklist: [
      { id: "step1", title: "Сделать шаг 1", done: false },
      { id: "step2", title: "Сделать шаг 2", done: false }
    ],
    can_open_report: true,
    already_submitted: false
  });
});

/* ===== CHECKLIST ===== */
app.post("/checklist/toggle", (req, res) => {
  res.json({ ok: true });
});

/* ===== FILE UPLOAD ===== */
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      const ext = file.originalname.split(".").pop();
      cb(null, Date.now() + "." + ext);
    }
  })
});

app.post("/daily-report/upload-photo", upload.single("photo"), (req, res) => {
  res.json({
    ok: true,
    photo: `/uploads/${req.file.filename}`
  });
});

/* ===== REPORT ===== */
app.post("/daily-report/submit", (req, res) => {
  res.json({ ok: true });
});

/* ===== UPLOADS STATIC ===== */
app.use("/uploads", express.static("uploads"));

/* ===== START ===== */
app.listen(PORT, () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
