const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ===== MULTER ===== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

/* ===== HEALTH ===== */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ===== FRONT ===== */
app.get("/", (req, res) => {
  res.send("SYNDICATE WEBAPP BACKEND OK");
});

/* ===== AUTH ===== */
app.post("/auth", (req, res) => {
  res.json({ token: "dev-token" });
});

/* ===== TASK ===== */
app.get("/task/:day", (req, res) => {
  res.json({
    ok: true,
    task: {
      id: Number(req.params.day),
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

/* ===== CHECKLIST ===== */
app.post("/checklist/toggle", (req, res) => {
  res.json({ ok: true });
});

/* ===== PHOTO UPLOAD ===== */
app.post(
  "/daily-report/upload-photo",
  upload.single("photo"),
  (req, res) => {
    res.json({
      ok: true,
      photos: ["/uploads/" + req.file.filename]
    });
  }
);

/* ===== REPORT ===== */
app.post("/daily-report/submit", (req, res) => {
  console.log("REPORT:", req.body);
  res.json({ ok: true });
});

/* ===== START ===== */
app.listen(PORT, () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
