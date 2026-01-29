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
  process.env.SUPABASE_SECRET_KEY // service role
);

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.static("public"));

/* ================= HEALTH ================= */
app.get("/health", (_, res) => {
  res.status(200).send("OK");
});

/* ================= TELEGRAM AUTH CHECK ================= */
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
    console.log("❌ JWT ERROR", e);
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
  console.log("🔐 AUTH REQUEST");

  if (!initData) return res.status(400).json({ ok: false });

  if (!checkTelegramAuth(initData)) {
    console.log("❌ TELEGRAM AUTH FAILED");
    return res.status(403).json({ ok: false });
  }

  const params = new URLSearchParams(initData);
  const tgUser = JSON.parse(params.get("user"));
  const telegramId = String(tgUser.id);

  console.log("👤 TG USER ID:", telegramId);

  let { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegramId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.log("❌ USER SELECT ERROR:", error);
  }

  if (!user) {
    console.log("➕ INSERT USER");
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

    if (insert.error) {
      console.log("❌ USER INSERT ERROR:", insert.error);
    }

    user = insert.data;
  }

  const token = jwt.sign(
    { telegram_id: telegramId },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  res.json({ ok: true, token });
});

/* ================= TASK BY DAY ================= */
app.get("/task/:day", requireAuth, async (req, res) => {
  const day = Number(req.params.day);
  const { telegram_id } = req.user;

  console.log("📅 LOAD DAY:", day, "TG:", telegram_id);

  const { data: user, error: uErr } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  if (uErr) console.log("❌ USER LOAD ERROR:", uErr);
  if (!user) return res.json({ ok: false });

  const { data: task, error: tErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("day", day)
    .single();

  if (tErr) console.log("❌ TASK ERROR:", tErr);
  if (!task) return res.json({ ok: false });

  const { data: items, error: iErr } = await supabase
    .from("task_checklist_items")
    .select("id, title, position")
    .eq("task_id", task.id)
    .order("position");

  if (iErr) console.log("❌ ITEMS ERROR:", iErr);

  const { data: marks, error: mErr } = await supabase
    .from("user_checklist_items")
    .select("checklist_item_id, done")
    .eq("user_id", user.id);

  if (mErr) console.log("❌ MARKS ERROR:", mErr);

  console.log("📌 MARKS FROM DB:", marks);

  const doneMap = {};
  (marks || []).forEach(m => {
    doneMap[m.checklist_item_id] = m.done === true;
  });

  res.json({
    ok: true,
    task,
    checklist: (items || []).map(i => ({
      id: i.id,
      title: i.title,
      done: doneMap[i.id] || false
    }))
  });
});

/* ================= CHECKLIST TOGGLE ================= */
app.post("/checklist/toggle", requireAuth, async (req, res) => {
  console.log("🟡 TOGGLE REQUEST:", req.body);

  const { checklist_id, done } = req.body;
  const { telegram_id } = req.user;

  if (typeof checklist_id !== "string" || typeof done !== "boolean") {
    console.log("❌ BAD BODY");
    return res.status(400).json({ ok: false });
  }

  const { data: user, error: uErr } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  if (uErr) console.log("❌ USER ERROR:", uErr);
  if (!user) return res.json({ ok: false });

  console.log("👤 USER ID:", user.id);
  console.log("🧩 CHECKLIST ID:", checklist_id, "DONE:", done);

  const { data, error } = await supabase
    .from("user_checklist_items")
    .upsert(
      {
        user_id: user.id,
        checklist_item_id: checklist_id,
        done: done
      },
      { onConflict: "user_id,checklist_item_id" }
    )
    .select();

  if (error) {
    console.log("❌ UPSERT ERROR:", error);
    return res.status(500).json({ ok: false });
  }

  console.log("✅ UPSERT OK:", data);
  res.json({ ok: true, row: data });
});

/* ================= START ================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on", PORT);
});
