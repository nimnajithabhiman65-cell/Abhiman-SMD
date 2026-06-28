let isReconnecting = false;
let globalSock = null;

async function connectToWA() {
  console.log("Connecting Abhiman-SMD 🧬...");

  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, '/auth_info_baileys/')
  );

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    auth: state,
    version,
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  globalSock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('✅ Abhiman-SMD connected to your WhatsApp');
      isReconnecting = false;

      try {
        const up = `Abhiman-SMD connected successfully ✅\nPREFIX: ${prefix}`;

        await sock.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
          image: { url: "https://github.com/nimnajithabhiman65-cell/Abhiman-SMD/blob/main/images/Abhiman-SMD%20connected%20successfully.png?raw=true" },
          caption: up
        });
      } catch (e) {
        console.log("Owner message failed:", e);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Disconnected:", statusCode);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("⚠️ Logged out - QR scan required");
        return;
      }

      if (!isReconnecting) {
        isReconnecting = true;

        setTimeout(() => {
          console.log("♻️ Reconnecting...");
          connectToWA();
        }, 5000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const mek = messages[0];
      if (!mek || !mek.message) return;
      if (mek.key.remoteJid === 'status@broadcast') return;

      const m = sms(sock, mek);
      const type = getContentType(mek.message);

      const from = mek.key.remoteJid;

      const body =
        type === 'conversation'
          ? mek.message.conversation
          : mek.message[type]?.text || mek.message[type]?.caption || '';

      const isCmd = body.startsWith(prefix);

      const commandName = isCmd
        ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase()
        : '';

      const args = body.trim().split(/ +/).slice(1);
      const q = args.join(' ');

      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNumber = sender.split('@')[0];

      const reply = (text) =>
        sock.sendMessage(from, { text }, { quoted: mek });

      if (isCmd) {
        const cmd = commands.find(
          (c) =>
            c.pattern === commandName ||
            (c.alias && c.alias.includes(commandName))
        );

        if (cmd) {
          try {
            if (cmd.react) {
              sock.sendMessage(from, {
                react: { text: cmd.react, key: mek.key }
              });
            }

            cmd.function(sock, mek, m, {
              from,
              body,
              args,
              q,
              sender,
              reply
            });
          } catch (e) {
            console.log("Command error:", e);
          }
        }
      }
    } catch (e) {
      console.log("Message handler error:", e);
    }
  });
}
