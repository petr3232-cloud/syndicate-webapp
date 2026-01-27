const express = require("express");
const crypto = require("crypto");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8080;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

app.use(express.json());
app.use(express.static("public"));

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

/* ===== AUTH ===== */
app.post("/auth", async (req, res) => {
  const { initData } = req.body;
  if (!checkTelegramAuth(initData))
    return res.status(403).json({ error: "FAKE USER" });

  const params = new URLSearchParams(initData);
  const tgUser = JSON.parse(params.get("user"));
  const telegram_id = String(tgUser.id);

  let { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  if (!user) {
    const insert = await supabase.from("users").insert({
      telegram_id,
      username: tgUser.username ?? null
    }).select("id").single();
    user = insert.data;

    // 👇 Открываем день 1 по умолчанию
    await supabase.from("user_days").insert({
      user_id: user.id,
      day: 1,
      is_open: true
    });
  }

  const token = jwt.sign(
    { telegram_id },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  res.json({ ok: true, token });
});

/* ===== СПИСОК ДОСТУПНЫХ ДНЕЙ ===== */
app.get("/days", requireAuth, async (req, res) => {
  const { telegram_id } = req.user;

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  const { data: days } = await supabase
    .from("user_days")
    .select("day")
    .eq("user_id", user.id)
    .eq("is_open", true)
    .order("day");

  res.json({ ok: true, days: days.map(d => d.day) });
});

/* ===== ЗАДАНИЕ ПО ДНЮ ===== */
app.get("/task/:day", requireAuth, async (req, res) => {
  const day = Number(req.params.day);
  const { telegram_id } = req.user;

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  const { data: access } = await supabase
    .from("user_days")
    .select("*")
    .eq("user_id", user.id)
    .eq("day", day)
    .eq("is_open", true)
    .single();

  if (!access) return res.status(403).json({ error: "DAY CLOSED" });

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("day", day)
    .single();

  const { data: items } = await supabase
    .from("task_checklist_items")
    .select("id, title")
    .eq("task_id", task.id)
    .order("position");

  const { data: marks } = await supabase
    .from("user_checklist_items")
    .select("checklist_item_id, done")
    .eq("user_id", user.id);

  const doneMap = {};
  (marks || []).forEach(m => doneMap[m.checklist_item_id] = m.done);

  res.json({
    ok: true,
    task,
    checklist: items.map(i => ({
      id: i.id,
      title: i.title,
      done: doneMap[i.id] === true
    }))
  });
});

/* ===== TOGGLE ===== */
app.post("/checklist/toggle", requireAuth, async (req, res) => {
  const { checklist_id, done } = req.body;
  const { telegram_id } = req.user;

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  await supabase.from("user_checklist_items").upsert(
    { user_id: user.id, checklist_item_id: checklist_id, done },
    { onConflict: "user_id,checklist_item_id" }
  );

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("🚀 Server started on", PORT);
});
