const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

// Главная страница
app.get("/", (req, res) => {
  res.send(`
    <h1>SYNDICATE WEB APP</h1>
    <p>Сервер работает ✅</p>
    <p>Это основа твоей игры</p>
  `);
});

// Запуск сервера
app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
