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

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.static("public"));

/* ================= HEALTH ================= */
app.get("/health", (_, res) => {
  console.log("💓 HEALTH CHECK HIT");
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
  if (!header) {
    console.log("❌ NO AUTH HEADER");
    return res.status(401).json({ ok: false });
  }

  try {
    const token = header.replace("Bearer ", "");
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    console.log("❌ JWT ERROR");
    return res.status(401).json({ ok: false });
  }
}

/* ================= MAIN ================= */
app.get("/", (_, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

/* ================= AUTH ================= */
app.post("/auth", async (req, res) => {
  const { initData } = req.body;
  if (!initData) return res.status(400).json({ ok: false });
  if (!checkTelegramAuth(initData)) return res.status(403).json({ ok: false });

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
});

/* ================= CHECKLIST TOGGLE ================= */
app.post("/checklist/toggle", requireAuth, async (req, res) => {
  const { checklist_id, done } = req.body;
  const { telegram_id } = req.user;

  console.log("🟡 TOGGLE:", checklist_id, done);

  if (typeof checklist_id !== "string" || typeof done !== "boolean") {
    console.log("❌ BAD PAYLOAD:", req.body);
    return res.status(400).json({ ok: false });
  }

  const { data: user, error: uErr } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  if (uErr || !user) {
    console.log("❌ USER NOT FOUND");
    return res.status(400).json({ ok: false });
  }

  const payload = {
    user_id: user.id,
    checklist_item_id: checklist_id,
    done: done
  };

  console.log("📦 UPSERT PAYLOAD:", payload);

  const { error } = await supabase
    .from("user_checklist_items")
    .upsert(payload, {
      onConflict: "user_id,checklist_item_id"
    });

  if (error) {
    console.log("❌ UPSERT ERROR:", error);
    return res.status(500).json({ ok: false });
  }

  console.log("✅ CHECKLIST SAVED");
  res.json({ ok: true });
});

/* ================= START ================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on", PORT);
});
