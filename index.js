const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===== BOOT LOG ===== */
console.log("🔥 SERVER BOOT");
console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "OK" : "NO");
console.log("SUPABASE_SECRET_KEY:", process.env.SUPABASE_SECRET_KEY ? "OK" : "NO");
console.log("BOT_TOKEN:", process.env.BOT_TOKEN ? "OK" : "NO");

/* ===== SUPABASE ===== */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

/* ===== MIDDLEWARE ===== */
app.use(express.json());
app.use(express.static("public"));

/* ===== HEALTH ===== */
app.get("/health", (req, res) => {
  res.send("OK");
});

/* ===== TELEGRAM CHECK ===== */
function checkTelegramAuth(initData) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  const dataCheckString = [...urlParams.entries()]
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.BOT_TOKEN)
    .digest();

  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return hmac === hash;
}

/* ===== ROUTES ===== */
app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

/* AUTH */
app.post("/auth", async (req, res) => {
  console.log("AUTH BODY:", req.body);

  const { initData } = req.body;

  if (!initData) {
    return res.status(400).send("NO INIT DATA");
  }

  if (!checkTelegramAuth(initData)) {
    return res.status(403).send("FAKE USER");
  }

  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get("user"));

  console.log("✅ USER:", user);

  /* SAVE TO DB */
  const { error } = await supabase
    .from("users")
    .upsert({
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name
    });

  if (error) {
    console.log("DB ERROR:", error);
    return res.status(500).send("DB ERROR");
  }

  res.send("USER VERIFIED");
});

/* ===== START ===== */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
