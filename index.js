const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

console.log("🟢 BOOT: starting app");

app.use(express.json());

// ====== UPLOAD CONFIG ======
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ====== ROUTES ======

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

/**
 * ⬇️ ОТЧЁТ С ФОТО
 * multipart/form-data
 * поля:
 *  - task_id
 *  - report_text
 *  - photo (file)
 */
app.post(
  "/daily-report/submit",
  upload.single("photo"),
  (req, res) => {
    console.log("📩 REPORT DATA:", req.body);
    console.log("🖼 PHOTO:", req.file);

    res.json({
      ok: true,
      photo_url: req.file
        ? `/uploads/${req.file.filename}`
        : null
    });
  }
);

// чтобы можно было открыть файл по URL
app.use("/uploads", express.static(uploadDir));

app.listen(PORT, () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
