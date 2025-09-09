import express from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import chalk from "chalk";

// =====================
// Config dari Railway Env
// =====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ TELEGRAM_TOKEN dan TELEGRAM_CHAT_ID harus di-set di Railway!");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// =====================
// Express server
// =====================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Database sementara (in-memory)
const reports = {}; // key: reportId, value: { player, chat }
const replies = {}; // key: reportId, value: replyText;
const kicks = {};   // key: playerName, value: reason

// =====================
// Endpoint dari Roblox → Telegram
// =====================
app.post("/chat", (req, res) => {
  const { sender, chat, id, date } = req.body;
  if (!sender || !chat) return res.status(400).send("Data tidak lengkap");

  reports[id] = { player: sender, chat };

  const telegramMessage = `📢 ADA REPORT DARI PLAYER\n\n*ID:* ${id}\n*Sender:* ${sender}\n*Chat:* ${chat}\n*Date:* ${date}`;
  bot.sendMessage(TELEGRAM_CHAT_ID, telegramMessage, { parse_mode: "Markdown" });

  console.log(chalk.cyan("────────────────────────────"));
  console.log(chalk.cyan("Sender : ") + chalk.yellow(sender));
  console.log(chalk.cyan("Chat   : ") + chalk.yellow(chat));
  console.log(chalk.cyan("ID     : ") + chalk.yellow(id));
  console.log(chalk.cyan("Date   : ") + chalk.yellow(date));
  console.log(chalk.cyan("────────────────────────────"));

  res.send({ reportId: id });
});

// =====================
// Endpoint balasan admin → Roblox
// =====================
app.get("/getReplies/:playerName", (req, res) => {
  const playerName = req.params.playerName;
  const playerReplies = [];

  for (const id in replies) {
    if (reports[id]?.player === playerName) {
      playerReplies.push({ reportId: id, reply: replies[id] });
      delete replies[id];
    }
  }

  res.json(playerReplies);
});

// =====================
// Endpoint kick admin → Roblox
// =====================
app.get("/getKick/:playerName", (req, res) => {
  const playerName = req.params.playerName;
  if (kicks[playerName]) {
    const reason = kicks[playerName];
    delete kicks[playerName];
    return res.json({ reason });
  }
  res.json({});
});

// =====================
// Command Telegram
// =====================

// Balas laporan
bot.onText(/\/r (.+)/, (msg, match) => {
  const full = match[1];
  const [reportId, replyText] = full.split("|");

  if (reports[reportId]) {
    replies[reportId] = replyText;
    bot.sendMessage(msg.chat.id, `✅ Balasan terkirim ke ${reports[reportId].player}`);
  } else {
    bot.sendMessage(msg.chat.id, "❌ Report ID tidak ditemukan!");
  }
});

// Kick player
bot.onText(/\/kick (.+)/, (msg, match) => {
  const full = match[1];
  const [username, reportId, reason] = full.split("|");

  if (username) {
    kicks[username] = reason || "You have been kicked by admin";
    bot.sendMessage(
      msg.chat.id,
      `🦵 Player *${username}* akan di-kick\n📌 Reason: ${kicks[username]}`,
      { parse_mode: "Markdown" }
    );
  } else {
    bot.sendMessage(msg.chat.id, "❌ Format salah! Gunakan: /kick username|id|reason");
  }
});

// =====================
// Start server
// =====================
app.listen(PORT, () => {
  console.log(chalk.green(`🚀 RUN `));
});
