import fetch from "node-fetch";
import { sticker } from "../lib/sticker.js";

let handler = async (m, { conn, args }) => {
    const text = args.join(" ");
    if (!text) return m.reply(`${e} Ingresa un texto para generar el sticker.`);

    await m.react("🕒");

    try {
        // Construir URL de la API con el texto
        const apiUrl = `https://api.delirius.store/canvas/brat?text=${encodeURIComponent(text)}`;
        const res = await fetch(apiUrl);

        if (!res.ok) throw new Error("La API no respondió correctamente");

        const buffer = Buffer.from(await res.arrayBuffer());

        // Crear sticker con nombre del usuario
        let stiker = await sticker(buffer, false, `${m.pushName}`);

        await conn.sendMessage(
            m.chat,
            {
                sticker: stiker
            },
            { quoted: m }
        );

        await m.react("✅");

    } catch (err) {
        console.error("BRAT STICKER ERROR:", err);
        await m.react("❌");
        return m.reply(`${e} Error al generar el sticker: ${err.message}`);
    }
};

handler.help = ["brat"];
handler.tags = ["maker"];
handler.command = ["brat", "bratsticker"];
handler.group = true;

export default handler;
