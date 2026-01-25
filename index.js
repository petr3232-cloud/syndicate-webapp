const express = require("express");
const crypto = require("crypto");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8080;

console.log("🔥 SERVER BOOT");

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

/* ===== TELEGRAM AUTH ===== */
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

/* ===== JWT ===== */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "NO TOKEN" });

  try {
    const token = header.replace("Bearer ", "");
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "INVALID TOKEN" });
  }
}

async function requireAdmin(req, res, next) {
  const { telegram_id } = req.user;

  const { data: user } = await supabase
    .from("users")
    .select("is_admin")
    .eq("telegram_id", telegram_id)
    .single();

  if (!user || user.is_admin !== true) {
    return res.status(403).json({ error: "NOT ADMIN" });
  }
  next();
}

/* ===== ROUTES ===== */
app.get("/", (_, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

/* ===== AUTH ===== */
app.post("/auth", async (req, res) => {
  const { initData } = req.body;
  if (!initData) return res.status(400).json({ error: "NO INIT DATA" });
  if (!checkTelegramAuth(initData))
    return res.status(403).json({ error: "FAKE USER" });

  const params = new URLSearchParams(initData);
  const tgUser = JSON.parse(params.get("user"));
  const telegramId = String(tgUser.id);

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (!user) {
    await supabase.from("users").insert({
      telegram_id: telegramId,
      username: tgUser.username ?? null,
      points: 0,
      level: "Новичок",
      is_admin: false
    });
  }

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

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegram_id)
    .single();

  res.json({ ok: true, user: data });
});

/* ===== ADMIN: OPEN DAY ===== */
app.post("/admin/open-day", requireAuth, requireAdmin, async (req, res) => {
  const { day } = req.body;

  const { data: task } = await supabase
    .from("tasks")
    .update({ is_active: true })
    .eq("day", day)
    .select()
    .single();

  if (!task) {
    return res.status(404).json({ error: "TASK NOT FOUND" });
  }

  res.json({ ok: true });
});

/* ======================================================
   ===== MY TASK + CHECKLIST (КЛЮЧЕВОЙ ФИКС) =====
   ====================================================== */
app.get("/my-tasks", requireAuth, async (req, res) => {
  const { telegram_id } = req.user;

  /* 1. Пользователь */
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  if (!user) {
    return res.json({ ok: true, task: null, checklist: [] });
  }

  /* 2. Активное задание */
  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_active", true)
    .single();

  if (!task) {
    return res.json({ ok: true, task: null, checklist: [] });
  }

  /* 3. ВСЕ пункты чек-листа (LEFT JOIN!) */
  const { data: items } = await supabase
    .from("task_checklist_items")
    .select(`
      id,
      title,
      user_checklist_items!left (
        user_id,
        done
      )
    `)
    .eq("task_id", task.id);

  const checklist = (items || []).map(item => {
    const row = item.user_checklist_items?.find(
      r => r.user_id === user.id
    );

    return {
      id: item.id,
      title: item.title,
      done: row ? row.done : false
    };
  });

  res.json({
    ok: true,
    task: {
      id: task.id,
      day: task.day,
      title: task.title,
      mission: task.mission,
      description: task.description || ""
    },
    checklist
  });
});

/* ===== TOGGLE CHECKLIST ===== */
app.post("/checklist/toggle", requireAuth, async (req, res) => {
  const { checklist_id, done } = req.body;
  const { telegram_id } = req.user;

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  if (!user) return res.json({ ok: true });

  await supabase.from("user_checklist_items").upsert(
    {
      user_id: user.id,
      checklist_item_id: checklist_id,
      done
    },
    { onConflict: "user_id,checklist_item_id" }
  );

  res.json({ ok: true });
});

/* ===== START ===== */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
