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
            password: 'bevoli1502'           // Your Mega Account Password
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
🎉 *Welcome to INFINITE-MD!* 🚀  

🔒 *Your Session ID* is ready!  ⚠️ _Keep it private and secure — don't share it with anyone._ 

🔑 *Copy & Paste the SESSION_ID Above*🛠️ Add it to your environment variable: *SESSION_ID*.

💡 *Whats Next?* 
1️⃣ Explore all the cool features of INFINITE-MD.
2️⃣ Stay updated with our latest releases and support.
3️⃣ Enjoy seamless WhatsApp automation! 🤖  

🔗 *Join Our Support Channel:* 👉 [Click Here to Join](https://whatsapp.com/channel/0029Vb4ezfxBadmWJzvNM13J) 

⭐ *Show Some Love!* Give us a ⭐ on GitHub and support the developer of: 👉 [Bevan soceity GitHub Repo](https://github.com/invinciblebevan/)  

🚀 _Thanks for choosing INFINITE-MD — Let the automation begin!_ ✨`;

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
