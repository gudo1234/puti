import axios from "axios";
import cheerio from "cheerio";
import Starlights from "starlights-scraper";

async function xvideosSearch(query) {
    return new Promise(async (resolve, reject) => {
        try {
            const url = `https://www.xvideos.com/?k=${encodeURIComponent(query)}`;
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);

            const results = [];

            $("div.mozaique > div").each((_, el) => {
                const title = $(el).find("p.title a").attr("title");
                const href = $(el).find("p.title a").attr("href");
                const duration = $(el).find("span.duration").text().trim();
                const quality = $(el).find("span.video-hd-mark").text().trim();

                if (title && href) {
                    results.push({
                        title,
                        url: "https://www.xvideos.com" + href,
                        duration,
                        quality
                    });
                }
            });

            resolve(results);
        } catch (e) {
            reject(e);
        }
    });
}

let handler = async (m, { conn, args, usedPrefix }) => {

    // 🔞 LÓGICA NSFW EXACTA MEMORIZADA
    if (!db.data.chats[m.chat].nsfw && m.isGroup) {
        return m.reply(
            `${e} El contenido *NSFW* está desactivado en este grupo.\n` +
            `> Un administrador puede activarlo con: *${usedPrefix}nsfw on*`
        );
    }

    const query = args.join(" ");
    if (!query) {
        return m.reply(
            `${e} Ingresa un texto o link válido.\n\n` +
            `Ejemplos:\n` +
            `• ${usedPrefix}xvideos colegiala latina\n` +
            `• ${usedPrefix}xvideos https://www.xvideos.com/video-abc123`
        );
    }

    await m.react("🕒");

    try {
        let finalLink;

        if (/^https?:\/\/(www\.)?xvideos\.com\//i.test(query)) {
            finalLink = query;
        } else {
            const results = await xvideosSearch(query);
            if (!results.length)
                return m.reply(`${e} No se encontraron resultados para: *${query}*`);
            finalLink = results[0].url;
        }

        const { title, dl_url } = await Starlights.xvideosdl(finalLink);

        await conn.sendMessage(
            m.chat,
            {
                document: { url: dl_url },
                mimetype: "video/mp4",
                fileName: `${title}.mp4`
            },
            { quoted: m }
        );

        await m.react("✅");

    } catch (err) {
        console.error("[XVIDEOS ERROR]", err);
        await m.react("❌");
        return m.reply(`${e} Ocurrió un error al descargar el video:\n> ${err.message}`);
    }
};

handler.help = ["xvideos"];
handler.tags = ["descargas"];
handler.command = ["xvideos", "sexo2", "pornoxv", "porno2", "xvideosdl"];
handler.group = true;

export default handler;
