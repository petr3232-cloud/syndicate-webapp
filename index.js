const express = require("express");
const crypto = require("crypto");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===== BOOT LOG ===== */
console.log("🔥 SERVER BOOT");
console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "OK" : "NO");
console.log("SUPABASE_SECRET_KEY:", process.env.SUPABASE_SECRET_KEY ? "OK" : "NO");
console.log("BOT_TOKEN:", process.env.BOT_TOKEN ? "OK" : "NO");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "OK" : "NO");

/* ===== SUPABASE ===== */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

/* ===== MIDDLEWARE ===== */
app.use(express.json());
app.use(express.static("public"));

/* ===== HEALTH ===== */
app.get("/health", (_, res) => res.send("OK"));

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

/* ===== JWT MIDDLEWARE ===== */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "NO TOKEN" });

  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "INVALID TOKEN" });
  }
}

/* ===== ROUTES ===== */
app.get("/", (_, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

/* ===== AUTH ===== */
app.post("/auth", async (req, res) => {
  const { initData } = req.body;
  if (!initData) return res.status(400).send("NO INIT DATA");
  if (!checkTelegramAuth(initData)) return res.status(403).send("FAKE USER");

  const params = new URLSearchParams(initData);
  const tgUser = JSON.parse(params.get("user"));
  const telegramId = String(tgUser.id);

  console.log("✅ USER:", tgUser);

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.log("DB ERROR:", error);
    return res.status(500).send("DB ERROR");
  }

  if (!user) {
    await supabase.from("users").insert({
      telegram_id: telegramId,
      username: tgUser.username ?? null,
      points: 0,
      level: "Новичок"
    });
    console.log("🆕 USER INSERTED");
  } else {
    console.log("👤 USER EXISTS");
  }

  /* 🔐 ВЫДАЁМ JWT */
  const token = jwt.sign(
    { telegram_id: telegramId },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  res.json({ ok: true, token });
});

/* ===== ME ===== */
app.get("/me", requireAuth, async (req, res) => {
  const { telegram_id } = req.user;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegram_id)
    .single();

  if (error) {
    console.log("ME ERROR:", error);
    return res.status(500).json({ error: "DB ERROR" });
  }

  res.json({ ok: true, user: data });
});

/* ===== START ===== */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
