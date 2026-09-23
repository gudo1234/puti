import yts from "yt-search";
import fetch from "node-fetch";

let handler = async (m, { conn, args, usedPrefix }) => {
    const text = args.join(" ").trim();

    if (!text) {
        return m.reply(`${e} Ingresa algo para buscar.\n` +
                       `Ejemplo: *${usedPrefix}yts bad bunny un preview*`);
    }

    await m.react("🔎");

    try {
        const search = await yts(text);
        const videos = search.videos.slice(0, 10);

        if (!videos.length) {
            return m.reply(`${e} No se encontraron resultados.`);
        }

        const thumb = await (await fetch(videos[0].thumbnail)).buffer();
        let msg = `🔍 *YouTube Search:* _${text}_\n\n`;

        for (let i = 0; i < videos.length; i++) {
            const v = videos[i];
            msg += `*${i + 1}.* ${v.title}\n`;
            msg += `👤 ${v.author.name}\n`;
            msg += `👁️ ${v.views}\n`;
            msg += `⏱️ ${v.timestamp}\n`;
            msg += `🔗 ${v.url}\n_____________\n\n`;
        }

        await conn.sendMessage(
            m.chat,
            {
                text: msg,
                contextInfo: {
                    externalAdReply: {
                        title: "YouTube Search",
                        body: textbot,
                        thumbnailUrl: redes,
                        thumbnail: thumb,
                        sourceUrl: redes
                    }
                }
            },
            { quoted: m }
        );

        await m.react("✅");

    } catch (e) {
        console.error("[YTSEARCH ERROR]", e);
        await m.react("❌");
        return m.reply(`⚠️ Error al buscar:\n${e.message}`);
    }
};

handler.help = ["yts"];
handler.tags = ["buscador"];
handler.command = ["youtubesearch", "yts", "ytsearch"];
handler.group = true;

export default handler;
