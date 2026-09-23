import fetch from "node-fetch";

let handler = async (m, { conn, args }) => {
  try {
    const text = args.join(" ");
    if (!text) return m.reply("❌ Por favor proporciona el término que deseas buscar en *Google*.");

    await m.react("💭");

    const apiUrl = `https://api.delirius.store/search/googlesearch?query=${encodeURIComponent(text)}`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (!result.status) {
      await m.react("❌");
      return m.reply("❌ Error al realizar la búsqueda.");
    }

    let replyMessage = `🔎 *Resultados de la búsqueda:*\n\n`;
    result.data.slice(0, 5).forEach((item, index) => {
      replyMessage += `☁️ *${index + 1}. ${item.title}*\n`;
      replyMessage += `📰 *${item.description}*\n`;
      replyMessage += `🔗 URL: ${item.url}\n\n`;
    });

    await conn.sendMessage(
      m.chat,
      { text: replyMessage },
      { quoted: m }
    );

    await m.react("✅");

  } catch (error) {
    console.error("GOOGLE SEARCH ERROR:", error);
    await m.react("❌");
    await m.reply("❌ Ocurrió un error al obtener los resultados.");
  }
};

handler.help = ["google"];
handler.tags = ["buscador"];
handler.command = ["google", "gsearch"];
handler.group = true;

export default handler;
