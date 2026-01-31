const express = require("express");
const crypto = require("crypto");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

console.log("🟢 BOOT: starting app");

const app = express();
const PORT = process.env.PORT || 8080;

/* ================= ENV CHECK ================= */
[
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "JWT_SECRET",
  "BOT_TOKEN"
].forEach(k => {
  if (!process.env[k]) {
    console.error("❌ ENV MISSING:", k);
    process.exit(1);
  }
});

/* ================= SUPABASE ================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

console.log("🟢 SUPABASE INIT OK");

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.static("public"));

/* ================= HEALTH ================= */
app.get("/health", (_, res) => {
  console.log("💓 HEALTH HIT");
  res.status(200).send("OK");
});

/* ================= TELEGRAM AUTH ================= */
function checkTelegramAuth(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(process.env.BOT_TOKEN)
      .digest();

    const hmac = crypto
      .createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");

    return hmac === hash;
  } catch (e) {
    console.error("❌ TG AUTH ERROR", e);
    return false;
  }
}

/* ================= JWT ================= */
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ ok: false });

    const token = header.replace("Bearer ", "");
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    console.error("❌ JWT ERROR", e);
    return res.status(401).json({ ok: false });
  }
}

/* ================= MAIN ================= */
app.get("/", (_, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

/* ================= AUTH ================= */
app.post("/auth", async (req, res) => {
  try {
    const { initData } = req.body;
    if (!initData) return res.status(400).json({ ok: false });

    if (!checkTelegramAuth(initData)) {
      return res.status(403).json({ ok: false });
    }

    const params = new URLSearchParams(initData);
    const tgUser = JSON.parse(params.get("user"));
    const telegramId = String(tgUser.id);

    let { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    if (!user) {
      const insert = await supabase
        .from("users")
        .insert({
          telegram_id: telegramId,
          username: tgUser.username ?? null,
          points: 0,
          level: "Новичок",
          is_admin: false
        })
        .select("id")
        .single();

      user = insert.data;
    }

    const token = jwt.sign(
      { telegram_id: telegramId },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ ok: true, token });
  } catch (e) {
    console.error("❌ AUTH ERROR", e);
    res.status(500).json({ ok: false });
  }
});

/* ================= SAFE TEST ROUTE ================= */
app.get("/debug/ping", (_, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ================= START ================= */
console.log("🟢 BEFORE LISTEN");

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
