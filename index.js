const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const P = require('pino');
const express = require('express');
const axios = require('axios');
const path = require('path');
const qrcode = require('qrcode-terminal');

const config = require('./config');
const { sms, downloadMediaMessage } = require('./lib/msg');
const {
  getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson
} = require('./lib/functions');
const { File } = require('megajs');
const { commands, replyHandlers } = require('./command');

const app = express();
const port = process.env.PORT || 8000;

const prefix = '.';
const ownerNumber = ['94787370465'];
const credsPath = path.join(__dirname, '/auth_info_baileys/creds.json');

async function ensureSessionFile() {
  if (!fs.existsSync(credsPath)) {
    if (!config.SESSION_ID) {
      console.error('❌ SESSION_ID env variable is missing. Cannot restore session.');
      process.exit(1);
    }

    console.log("🔄 Abhiman-SMD creds.json not found. Downloading session from Server ");

    const sessdata = config.SESSION_ID;
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);

    filer.download((err, data) => {
      if (err) {
        console.error("❌ Abhiman-SMD Failed to download session file from Server:", err);
        process.exit(1);
      }

      fs.mkdirSync(path.join(__dirname, '/auth_info_baileys/'), { recursive: true });
      fs.writeFileSync(credsPath, data);
      console.log("✅ Abhiman-SMD Session downloaded and saved. Restarting bot...");
      setTimeout(() => {
        connectToWA();
      }, 2000);
    });
  } else {
    setTimeout(() => {
      connectToWA();
    }, 1000);
  }
}

async function connectToWA() {
  console.log("Connecting Abhiman-SMD 🧬...");
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, '/auth_info_baileys/'));
  const { version } = await fetchLatestBaileysVersion();

  const Abhiman = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    auth: state,
    version,
    syncFullHistory: true,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
  });

connection.ev.on("connection.update", (update) => {
  const { connection, lastDisconnect } = update;

  if (connection === "open") {
    console.log("✅ Bot connected");
  }

  if (connection === "close") {
    const statusCode = lastDisconnect?.error?.output?.statusCode;

    console.log("❌ Disconnected:", statusCode);

    // ONLY reconnect if NOT logged out
    if (statusCode !== 401) {
      setTimeout(() => {
        startBot();
      }, 5000);
    }
  }
});
  Abhiman.ev.on('creds.update', saveCreds);

  Abhiman.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.messageStubType === 68) {
        await Abhiman.sendMessageAck(msg.key);
      }
    }

    const mek = messages[0];
    if (!mek || !mek.message) return;

    mek.message = getContentType(mek.message) === 'ephemeralMessage' ? mek.message.ephemeralMessage.message : mek.message;
    if (mek.key.remoteJid === 'status@broadcast') return;

    const m = sms(Abhiman, mek);
    const type = getContentType(mek.message);
    const from = mek.key.remoteJid;
    const body = type === 'conversation' ? mek.message.conversation : mek.message[type]?.text || mek.message[type]?.caption || '';
    const isCmd = body.startsWith(prefix);
    const commandName = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : '';
    const args = body.trim().split(/ +/).slice(1);
    const q = args.join(' ');

    const sender = mek.key.fromMe ? Abhiman.user.id : (mek.key.participant || mek.key.remoteJid);
    const senderNumber = sender.split('@')[0];
    const isGroup = from.endsWith('@g.us');
    const botNumber = Abhiman.user.id.split(':')[0];
    const pushname = mek.pushName || 'Sin Nombre';
    const isMe = botNumber.includes(senderNumber);
    const isOwner = ownerNumber.includes(senderNumber) || isMe;
    const botNumber2 = await jidNormalizedUser(Abhiman.user.id);

    const groupMetadata = isGroup ? await Abhiman.groupMetadata(from).catch(() => {}) : '';
    const groupName = isGroup ? groupMetadata.subject : '';
    const participants = isGroup ? groupMetadata.participants : '';
    const groupAdmins = isGroup ? await getGroupAdmins(participants) : '';
    const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
    const isAdmins = isGroup ? groupAdmins.includes(sender) : false;

    const reply = (text) => Abhiman.sendMessage(from, { text }, { quoted: mek });

    if (isCmd) {
      const cmd = commands.find((c) => c.pattern === commandName || (c.alias && c.alias.includes(commandName)));
      if (cmd) {
        if (cmd.react) Abhiman.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
        try {
          cmd.function(Abhiman, mek, m, {
            from, quoted: mek, body, isCmd, command: commandName, args, q,
            isGroup, sender, senderNumber, botNumber2, botNumber, pushname,
            isMe, isOwner, groupMetadata, groupName, participants, groupAdmins,
            isBotAdmins, isAdmins, reply,
          });
        } catch (e) {
          console.error("[PLUGIN ERROR]", e);
        }
      }
    }

    const replyText = body;
    for (const handler of replyHandlers) {
      if (handler.filter(replyText, { sender, message: mek })) {
        try {
          await handler.function(Abhiman, mek, m, {
            from, quoted: mek, body: replyText, sender, reply,
          });
          break;
        } catch (e) {
          console.log("Reply handler error:", e);
        }
      }
    }
  });
}

ensureSessionFile();

app.get("/", (req, res) => {
  res.send("Hey, Abhiman-SMD started  successfully✅");
});

app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
