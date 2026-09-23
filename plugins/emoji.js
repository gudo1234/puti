import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { sticker } from "../lib/sticker.js";

const fetchJson = (url, options = {}) =>
    fetch(url, options).then(res => res.json());

const tmpDir = path.join(process.cwd(), "src", "sesion");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

let handler = async (m, { conn, args }) => {
    try {
        if (!args[0])
            return m.reply(`Genera un sticker con el emoji que envíes junto al comando.\nEjemplo:\n.emojimix 😎+🔥\n.emojimix 😎`);

        const text = args.join(" ");
        m.react("🎨");

        const author = m.pushName || "Sticker";

        let emoji1, emoji2;
        if (text.includes("+")) {
            [emoji1, emoji2] = text.split("+").map(e => e.trim());
            if (!emoji1 || !emoji2) return m.reply(`Formato correcto:\n.emojimix 😎+🔥`);
        } else {
            emoji1 = emoji2 = text.trim();
        }

        const apiUrl =
            `https://tenor.googleapis.com/v2/featured`
            + `?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ`
            + `&contentfilter=high&media_filter=png_transparent&component=proactive`
            + `&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;

        const json = await fetchJson(apiUrl);
        if (!json?.results?.length) return m.reply(`No encontré combinación para esos emojis.`);

        const imgUrl = json.results[0].url;

        const inputPath = path.join(tmpDir, `emoji_${Date.now()}.png`);
        const outputPath = path.join(tmpDir, `emoji_${Date.now()}.webp`);

        fs.writeFileSync(inputPath, Buffer.from(await (await fetch(imgUrl)).arrayBuffer()));

        await new Promise((resolve, reject) => {
            const cmd =
                `ffmpeg -y -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0" -vcodec libwebp -lossless 1 -qscale 1 -preset picture -an -loop 0 "${outputPath}"`;

            exec(cmd, (err) => (err ? reject(err) : resolve()));
        });

        const webpBuffer = fs.readFileSync(outputPath);

        // Crear sticker con nombre del usuario
        const stiker = await sticker(webpBuffer, false, author);

        await conn.sendMessage(
            m.chat,
            { sticker: stiker },
            { quoted: m }
        );

        m.react("✅");

        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

    } catch (err) {
        console.error(err);
        m.reply("❌ Ocurrió un error al generar el sticker.");
    }
};

handler.help = ["emojimix"];
handler.tags = ["maker"];
handler.command = ["emoji", "emojimix"];
handler.group = true;

export default handler;
