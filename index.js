import express from "express"
import crypto from "crypto"
import path from "path"

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.static("public"))

function checkTelegramAuth(initData) {
  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get("hash")
  urlParams.delete("hash")

  const dataCheckString = [...urlParams.entries()]
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.BOT_TOKEN)
    .digest()

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex")

  return hmac === hash
}

app.get("/", (req, res) => {

  const initData = req.query.initData

  if (!initData || !checkTelegramAuth(initData)) {
    return res.send("⛔ Доступ только через Telegram")
  }

  res.sendFile(path.resolve("public/index.html"))
})

app.listen(PORT, () => {
  console.log("Server running on port", PORT)
})
