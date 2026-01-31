console.log("🟢 BOOT: starting app");

process.on("uncaughtException", err => {
  console.error("🔥 UNCAUGHT EXCEPTION", err);
});

process.on("unhandledRejection", reason => {
  console.error("🔥 UNHANDLED REJECTION", reason);
});

process.on("SIGTERM", () => {
  console.log("🟡 SIGTERM received (platform stopping container)");
});

process.on("exit", code => {
  console.log("🔴 PROCESS EXIT WITH CODE", code);
});

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8080;

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
}

/* ================= JWT ================= */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok: false });

  try {
    const token = header.replace("Bearer ", "");
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    console.error("JWT ERROR", e);
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

    if (!checkTelegramAuth(initData))
      return res.status(403).json({ ok: false });

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
    console.error("AUTH ERROR", e);
    res.status(500).json({ ok: false });
  }
});

/* ================= KEEP EVENT LOOP ALIVE ================= */
setInterval(() => {
  console.log("🟢 KEEPALIVE TICK", new Date().toISOString());
}, 30000);

/* ================= START ================= */
console.log("🟢 BEFORE LISTEN");

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER STARTED ON", PORT);
});
