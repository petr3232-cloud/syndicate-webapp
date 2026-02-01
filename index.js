const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 8080;

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
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/auth", (req, res) => {
  res.json({ token: "dev-token" });
});

app.get("/task/:day", (req, res) => {
  res.json({
    ok: true,
    task: {
      id: Number(req.params.day),
      title: `Задание дня ${req.params.day}`,
      description: `Описание задания для дня ${req.params.day}`
    },
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

/* ===== upload photo ===== */
app.post("/daily-report/upload-photo", upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false });
  }

  res.json({
    ok: true,
    photos: [`/uploads/${req.file.filename}`]
  });
});

app.post("/daily-report/submit", (req, res) => {
  console.log("📩 REPORT:", req.body);
  res.json({ ok: true });
});

/* ===== frontend fallback ===== */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ===== start ===== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
