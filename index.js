const express = require("express");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

console.log("🔥 SERVER BOOT");

console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "OK" : "NO");
console.log("SUPABASE_SECRET_KEY:", process.env.SUPABASE_SECRET_KEY ? "OK" : "NO");
console.log("BOT_TOKEN:", process.env.BOT_TOKEN ? "OK" : "NO");

app.use(express.json());
app.use(express.static("public"));

app.get("/health", (req, res) => {
  res.send("OK");
});

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

app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.post("/auth", (req, res) => {
  const { initData } = req.body;

  if (!initData) {
    return res.status(400).send("NO INIT DATA");
  }

  if (!checkTelegramAuth(initData)) {
    return res.status(403).send("FAKE USER");
  }

  res.send("USER VERIFIED");
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
