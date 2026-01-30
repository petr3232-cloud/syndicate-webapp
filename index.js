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
  if (!header) return res.status(401).json({ ok: false });

  try {
    const token = header.replace("Bearer ", "");
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
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

/* ================= TASK BY DAY ================= */
app.get("/task/:day", requireAuth, async (req, res) => {
  const day = Number(req.params.day);
  const { telegram_id } = req.user;

  console.log("📅 OPEN DAY:", day, "TG:", telegram_id);

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  if (!user) return res.json({ ok: false });

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("day", day)
    .single();

  if (!task) return res.json({ ok: false });

  const { data: items } = await supabase
    .from("task_checklist_items")
    .select("id, title, position")
    .eq("task_id", task.id)
    .order("position");

  const { data: marks } = await supabase
    .from("user_checklist_items")
    .select("checklist_item_id, done")
    .eq("user_id", user.id);

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

/* ================= CHECKLIST TOGGLE (С DAILY REPORT) ================= */
app.post("/checklist/toggle", requireAuth, async (req, res) => {
  const { checklist_id, done } = req.body;
  const { telegram_id } = req.user;

  console.log("🟡 TOGGLE:", checklist_id, done);

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegram_id)
    .single();

  if (!user) return res.status(400).json({ ok: false });

  await supabase
    .from("user_checklist_items")
    .upsert(
      {
        user_id: user.id,
        checklist_item_id: checklist_id,
        done
      },
      { onConflict: "user_id,checklist_item_id" }
    );

  /* === СЧИТАЕМ ВЫПОЛНЕННЫЕ ПУНКТЫ === */
  const { data: completed } = await supabase
    .from("user_checklist_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("done", true);

  const completedCount = completed?.length || 0;
  console.log("📊 COMPLETED COUNT:", completedCount);

  if (completedCount >= 3) {
    /* === НАХОДИМ ТЕКУЩУЮ ЗАДАЧУ === */
    const { data: task } = await supabase
      .from("task_checklist_items")
      .select("task_id")
      .eq("id", checklist_id)
      .single();

    if (task) {
      await supabase
        .from("daily_reports")
        .upsert(
          {
            user_id: user.id,
            task_id: task.task_id,
            checklist_done_count: completedCount,
            checklist_total_count: completedCount,
            checklist_completed: completedCount >= 3,
            can_open_report: true
          },
          { onConflict: "user_id,task_id" }
        );

      console.log("📝 DAILY REPORT SAVED");
    }
  }

  res.json({ ok: true });
});

/* ================= START ================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on", PORT);
});
