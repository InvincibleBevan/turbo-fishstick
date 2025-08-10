const { malvinid } = require('./id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const { Storage } = require("megajs");
const {
    default: Malvin_Tech,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

const router = express.Router();

// Utility: Generate random Mega ID
function randomMegaId(length = 6, numberLength = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}

// Utility: Remove file/folder
function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
    return true;
}

// Upload credentials to Mega.nz
async function uploadCredsToMega(credsPath) {
    try {
        const storage = await new Storage({
            email: 'bevansoceity@gmail.com', // Your Mega Account Email
            password: 'bevoli15023005'           // Your Mega Account Password
        }).ready;

        if (!fs.existsSync(credsPath)) {
            throw new Error(`File not found: ${credsPath}`);
        }

        const fileSize = fs.statSync(credsPath).size;
        const uploadResult = await storage.upload({
            name: `${randomMegaId()}.json`,
            size: fileSize
        }, fs.createReadStream(credsPath)).complete;

        const fileNode = storage.files[uploadResult.nodeId];
        const megaUrl = await fileNode.link();
        return megaUrl;
    } catch (error) {
        console.error('Error uploading to Mega:', error);
        throw error;
    }
}

// Main router GET endpoint for pairing
router.get('/', async (req, res) => {
    const id = malvinid();
    let num = req.query.number;

    async function MALVIN_PAIR_CODE() {
        const tempDir = path.join(__dirname, 'temp', id);
        const credsPath = path.join(tempDir, 'creds.json');
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);

        try {
            const malvin = Malvin_Tech({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari")
            });

            malvin.ev.on('creds.update', saveCreds);

            malvin.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    await delay(5000);

                    if (!fs.existsSync(credsPath)) {
                        console.error("File not found:", credsPath);
                        return;
                    }

                    // Upload to Mega and generate session ID
                    const megaUrl = await uploadCredsToMega(credsPath);
                    const sid = megaUrl.includes("https://mega.nz/file/")
                        ? 'INFINITE-MD~' + megaUrl.split("https://mega.nz/file/")[1]
                        : 'Error: Invalid URL';

                    // Send session ID to linked device
                    const sessionMsg = await malvin.sendMessage(malvin.user.id, { text: sid });

                    const infoText = `
*_Pair Code Connected by BEVAN SOCEITY*
*_Made With 🚬🗿_*
______________________________________
╔════◇
║ *『 AMAZING YOU'VE CHOSEN INFINITE-MD 』*
║ _You Have Completed the First Step to Deploy a Whatsapp Bot._
╚════════════════════════╝
╔═════◇
║  『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••』
║❒ *Ytube:* _https://www.youtube.com/@BTSMODZ
║❒ *Owner:* https://wa.me/25_
║❒ *Repo:* _https://github.com/Fearless-tech1_
║❒ *WaGroup:* _https://chat.whatsapp.com/C3GFThC0tIpGaJY9DFUeCK
║❒ *WaChannel:* _https://whatsapp.com/channel/0029VahusSh0QeaoFzHJCk2x
║❒ *Plugins:* _https://github.com/Fearless-tech1 
╚════════════════════════╝
_____________________________________

_Don't Forget To Give Star To My Repo_``;

                    await malvin.sendMessage(malvin.user.id, { text: infoText }, { quoted: sessionMsg });

                    await delay(100);
                    await malvin.ws.close();
                    removeFile(tempDir);
                } else if (
                    connection === "close" &&
                    lastDisconnect &&
                    lastDisconnect.error &&
                    lastDisconnect.error.output &&
                    lastDisconnect.error.output.statusCode !== 401
                ) {
                    await delay(10000);
                    MALVIN_PAIR_CODE();
                }
            });

            // If not registered, generate and send pairing code
            if (!malvin.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await malvin.requestPairingCode(num);
                console.log(`Pairing Code: ${code}`);
                if (!res.headersSent) {
                    res.send({ code });
                }
            }
        } catch (err) {
            console.error("Service Restarted/Error:", err);
            removeFile(tempDir);
            if (!res.headersSent) {
                res.send({ code: "Service is Currently Unavailable" });
            }
        }
    }

    await MALVIN_PAIR_CODE();
});

module.exports = router;
