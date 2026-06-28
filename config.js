const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}
module.exports = {
SESSION_ID: process.env.SESSION_ID || "",
ALIVE_IMG: process.env.ALIVE_IMG || "https://github.com/nimnajithabhiman65-cell/Abhiman-SMD/blob/main/images/Abhiman-SMD%20Alive.png?raw=true",
ALIVE_MSG: process.env.ALIVE_MSG || "*Hello👋 Abhiman-SMD Is Alive Now😍*",
BOT_OWNER: '94776121326',  // Replace with the owner's phone number



};
