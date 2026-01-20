const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "OK" : "NO");
console.log("SUPABASE_SECRET_KEY:", process.env.SUPABASE_SECRET_KEY ? "OK" : "NO");
console.log("BOT_TOKEN:", process.env.BOT_TOKEN ? "OK" : "NO");



const app = express();
const PORT = process.env.PORT;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(express.json());
app.use(express.static("public"));

function checkTelegramAuth(initData) {
  if (!process.env.BOT_TOKEN) return false;

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

app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.post("/auth", async (req, res) => {
  const { initData } = req.body;

  if (!initData) return res.send("NO INIT DATA");
  if (!checkTelegramAuth(initData))
    return res.send("HASH INVALID");

  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get("user"));

  const telegram_id = user.id.toString();
  const username = user.username || "no_username";

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegram_id)
    .single();

  if (!data) {
    await supabase.from("users").insert([
      {
        telegram_id,
        username,
        points: 0,
        level: "Новичок"
      }
    ]);
  }

  res.send("USER VERIFIED");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});


