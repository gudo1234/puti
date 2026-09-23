import fetch from "node-fetch";

let handler = async (m, { conn, args, redes, textbot }) => {
  try {
    const text = args.join(" ");
    if (!text) return m.reply("❌ Ingresa un nombre de repositorio.");

    await m.react("🕒");

    const api = `https://dark-core-api.vercel.app/api/search/github?key=api&text=${encodeURIComponent(text)}`;
    const res = await fetch(api);
    const json = await res.json();

    if (!json.results || json.results.length === 0) {
      await m.react("❌");
      return m.reply("❌ No se encontraron resultados.");
    }

    const result = json.results[0];

    const info = 
`👑 *Owner:* ${result.creator}
🌟 *Estrellas:* ${result.stars}
🔖 *Forks:* ${result.forks}
📜 *Descripción:* ${result.description}
📆 *Creado:* ${result.createdAt}
🔗 *Link:* ${result.cloneUrl}`;

    await conn.sendMessage(
      m.chat,
      {
        text: info,
        contextInfo: {
          externalAdReply: {
            title: result.name,
            body: textbot || "GitHub Search",
            thumbnail: await (await fetch("https://files.catbox.moe/oc4myc.png")).buffer(),
            thumbnailUrl: redes,
            sourceUrl: redes,
            mediaType: 1,
            renderLargerThumbnail: false
          }
        }
      },
      { quoted: m }
    );

    await m.react("✅");

  } catch (e) {
    console.error("GITHUBSEARCH ERROR:", e);
    await m.react("❌");
    await m.reply("❌ Error: " + e.message);
  }
};

handler.help = ["githubsearch"];
handler.tags = ["buscador"];
handler.command = ["githubsearch", "gbsearch"];
handler.group = true;

export default handler;
