import fetch from "node-fetch";
import { sticker } from "../lib/sticker.js";

let handler = async (m, { conn, args }) => {
    const text = args.join(" ");
    if (!text) return m.reply(`${e} Ingresa un texto para crear el sticker animado.`);
    if (text.length > 25) {
        return m.reply(`${e} El texto no puede tener más de 25 caracteres. Actualmente tiene ${text.length}.`);
    }

    await m.react("🕒");

    try {
        const apiUrl = `https://api.deline.web.id/maker/attp?text=${encodeURIComponent(text)}`;
        const res = await fetch(apiUrl);

        if (!res.ok) throw new Error("API no respondió correctamente");

        const stickerBuffer = Buffer.from(await res.arrayBuffer());
        let stiker = await sticker(stickerBuffer, false, `${m.pushName}`);

        await conn.sendMessage(
            m.chat,
            {
                sticker: stiker,
                animated: true
            },
            { quoted: m }
        );

        await m.react("✅");

    } catch (err) {
        console.error("ATTP STICKER ERROR:", err);
        await m.react("❌");
        return m.reply(`${e} Error al crear el sticker: ${err.message}`);
    }
};

handler.help = ["attp"];
handler.tags = ["maker"];
handler.command = ["attp", "attpsticker"];
handler.group = true;

export default handler;
