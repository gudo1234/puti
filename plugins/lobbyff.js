import fetch from "node-fetch";

let handler = async (m, { conn, args }) => {
  try {
    const text = args.join(" ");
    if (!text) return m.reply(`${e} Ingresa un texto para crear la imagen.`);
    if (text.length > 10) {
      return m.reply(`${e} El texto no puede tener más de 10 caracteres. Actualmente tiene ${text.length}.`);
    }

    await m.react("🕒");

    const apiUrl = `https://api.deline.web.id/maker/lobbyffmax?text=${encodeURIComponent(text)}`;
    const fileReq = await fetch(apiUrl);

    if (!fileReq.ok) throw new Error("API no respondió correctamente");

    const imageBuffer = Buffer.from(await fileReq.arrayBuffer());
    const caption = `✅ Imagen Lobby FF Max creada con el texto: ${text}`;

    await conn.sendFile(
      m.chat,
      imageBuffer,
      "image.jpg",
      caption,
      m,
      null,
      rcanal
    );

    await m.react("✅");

  } catch (err) {
    console.error("LOBBY FF MAX IMAGE ERROR:", err);
    await m.react("❌");
    return m.reply(`${e} Error al crear la imagen: ${err.message}`);
  }
};

handler.help = ["lobbyff"];
handler.tags = ["logos"];
handler.command = ["lobbyff", "lobbyffmax", "lobbymax"];
handler.group = true;

export default handler;
