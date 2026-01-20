const express = require("express");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static("public"));

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
  const initData = req.query.initData;

  if (!initData || !checkTelegramAuth(initData)) {
    return res.send("⛔ Доступ только через Telegram");
  }

  res.sendFile(path.resolve("public/index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
