import sharp from "sharp";
import { S_WHATSAPP_NET, downloadContentFromMessage } from "@whiskeysockets/baileys";

const handler = async (m, { conn }) => {
    try {
        const groupId = m.chat;
        let q = null;

        if (m.quoted) {
            q = m.quoted;
        } else {
            const ctxQuoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (ctxQuoted && ctxQuoted.imageMessage) {
                q = { ...m, message: ctxQuoted };
            } else if (m.message?.imageMessage || /image/.test(m.mimetype || "")) {
                q = m;
            } else {
                q = null;
            }
        }

        if (!q) return m.reply(`${e} Envía o responde a una imagen para actualizar el icono del grupo.`);

        const mimetype = q.msg?.mimetype || q.mimetype || q.message?.imageMessage?.mimetype || "";
        if (!/image/.test(mimetype)) return m.reply(`${e} El mensaje respondido no es una imagen.`);

        let mediaBuffer = null;

        if (typeof q.download === "function") {
            try {
                mediaBuffer = await q.download();
            } catch {
                mediaBuffer = null;
            }
        }

        if (!mediaBuffer) {
            const messageWithMedia = q.msg || q.message || q;
            try {
                const stream = await downloadContentFromMessage(messageWithMedia, "image");
                let tmpBuf = Buffer.alloc(0);
                for await (const chunk of stream) tmpBuf = Buffer.concat([tmpBuf, chunk]);
                mediaBuffer = tmpBuf;
            } catch {
                mediaBuffer = null;
            }
        }

        if (!mediaBuffer) return m.reply(`${e} No pude descargar la imagen.`);

        const metadata = await sharp(mediaBuffer).metadata();
        const width = metadata.width || 720;
        const height = metadata.height || 720;

        const processed = await sharp(mediaBuffer)
            .resize(width > height ? { width: 720 } : { height: 720 })
            .jpeg({ quality: 90 })
            .toBuffer();

        await conn.query({
            tag: "iq",
            attrs: {
                to: S_WHATSAPP_NET,
                target: groupId,
                type: "set",
                xmlns: "w:profile:picture"
            },
            content: [
                {
                    tag: "picture",
                    attrs: { type: "image" },
                    content: processed
                }
            ]
        });

        await m.reply("✅ Imagen del grupo actualizada correctamente.");
        await m.react("✅");

    } catch (err) {
        console.error("[ICONGP ERROR]", err);
        await m.react("❌");
        return m.reply("❌ Ocurrió un error procesando la imagen.");
    }
};

handler.help = ["icongp"];
handler.tags = ["grupo"];
handler.command = ["icongp", "setppgroup", "setppgp"];
handler.group = true;
handler.admin = true;
export default handler;
