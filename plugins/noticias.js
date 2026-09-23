import fetch from "node-fetch";
import moment from "moment";

let handler = async (m, { conn }) => {
  try {
    await m.react("🕒");

    const url = `https://newsapi.org/v2/top-headlines?sources=el-mundo&apiKey=84baef01e6c640799202a741a11fdedf`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.articles || !data.articles.length) {
      await m.react("❌");
      return m.reply("❌ No se encontraron noticias.");
    }

    const articles = data.articles;
    let txt = "*• 📰 Noticias principales - El Mundo •*\n\n";

    for (let art of articles) {
      txt += `*⤿ Título:* _${art.title || "No disponible"}_\n` +
             `*⤿ Descripción:* _${art.description || "No disponible"}_\n` +
             `*⤿ Publicado:* _${moment(art.publishedAt).format("DD/MM/YYYY HH:mm")}_\n` +
             `*⤿ URL:* ${art.url || "No disponible"}\n────────────\n\n`;
    }

    const img = "https://telegra.ph/file/17d0f2946ff10fd130507.jpg";

    await conn.sendMessage(
      m.chat,
      {
        text: txt.trim(),
        contextInfo: {
          externalAdReply: {
            title: "Últimas actualizaciones del mundo",
            body: textbot,
            thumbnail: await (await fetch(img)).buffer(),
            thumbnailUrl: redes,
            sourceUrl: redes,
            renderLargerThumbnail: false,
          }
        }
      },
      { quoted: m }
    );

    await m.react("✅");

  } catch (e) {
    console.error("NOTICIAS ERROR:", e);
    await m.react("❌");
    await m.reply("❌ Ocurrió un error al obtener las noticias.");
  }
};

handler.help = ["noticias"];
handler.tags = ["buscador"];
handler.command = ["noticias", "googlenews", "noticia"];
handler.group = true;

export default handler;
