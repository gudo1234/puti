import fetch from "node-fetch";
import cheerio from "cheerio";
import Starlights from "starlights-scraper";

async function xnxxsearch(query) {
    return new Promise((resolve, reject) => {
        const baseurl = "https://www.xnxx.com";
        const page = Math.floor(Math.random() * 3) + 1;

        fetch(`${baseurl}/search/${query}/${page}`)
            .then(res => res.text())
            .then(res => {
                const $ = cheerio.load(res);
                const results = [];

                $("div.mozaique").each((_, b) => {
                    const thumbs = $(b).find("div.thumb");
                    const infos = $(b).find("div.thumb-under");

                    thumbs.each((i, el) => {
                        const link = $(el).find("a").attr("href");
                        const title = $(infos[i]).find("a").attr("title");
                        const info = $(infos[i]).find("p.metadata").text();

                        if (link && title) {
                            results.push({
                                title,
                                info,
                                link: baseurl + link.replace("/THUMBNUM/", "/")
                            });
                        }
                    });
                });

                resolve({ code: 200, status: true, result: results });
            })
            .catch(err => reject({ code: 503, status: false, result: err }));
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
            `• ${usedPrefix}xnxx rubia tetona\n` +
            `• ${usedPrefix}xnxx https://www.xnxx.com/video-abc123`
        );
    }

    let finalLink = null;
    if (/^https?:\/\//i.test(query)) {
        finalLink = query;
    } else {
        await m.react("🕒");
        const res = await xnxxsearch(query);
        const videos = res.result;

        if (!videos.length) {
            return m.reply(`${e} No se encontraron resultados para: *${query}*`);
        }

        finalLink = videos[0].link;
    }

    try {
        const { title, dl_url } = await Starlights.xnxxdl(finalLink);

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
        console.error("[XNXX ERROR]", err);
        await m.react("❌");
        return m.reply(`${e} Ocurrió un error al descargar el video:\n> ${err.message}`);
    }
};

handler.help = ["xnxx"];
handler.tags = ["descargas"];
handler.command = ["xnxx", "porno", "sexo", "xnxxdl"];
handler.group = true;

export default handler;
