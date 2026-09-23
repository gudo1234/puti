import axios from "axios";

let handler = async (m, { conn, args }) => {
  try {
    const input = args.join(" ").trim();

    const parts = input
      .split(/[|&]/)
      .map(t => t.trim())
      .filter(Boolean);

    if (parts.length < 2) {
      return m.reply(
        `${e} Debes ingresar 2 textos separados por \`|\` o \`&\`\n\n` +
        "Ejemplos:\n" +
        "> .balogo hola | bebé\n" +
        "> .balogo hola & bebé"
      );
    }

    const textL = parts[0];
    const textR = parts[1];

    await m.react("🕒");

    const apiUrl = "https://api.nekolabs.web.id/canvas/ba-logo";

    const fileReq = await axios.get(apiUrl, {
      params: { textL, textR },
      responseType: "arraybuffer",
      timeout: 15000
    });

    const caption = `${e} *BLUE ARCHIVE LOGO*\n\n${textL} | ${textR}`;

    await conn.sendFile(
      m.chat,
      Buffer.from(fileReq.data),
      "image.jpg",
      caption,
      m,
      null,
      rcanal
    );

    await m.react("✅");

  } catch (err) {
    console.error("BA LOGO ERROR:", err);
    await m.react("❌");
    return m.reply(`${e} Error al generar el logo.`);
  }
};

handler.help = ["balogo"];
handler.tags = ["logos"];
handler.command = ["balogo", "bluearchivelogo", "blogo"];
handler.group = true;

export default handler;
