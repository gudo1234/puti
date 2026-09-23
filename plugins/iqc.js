import fetch from "node-fetch";

let handler = async (m, { conn, args }) => {
  try {
    const text = args.join(" ");
    if (!text) return m.reply(`${e} Ingresa un texto para crear la imagen a estilo chat de WhatsApp de iPhone.`);
    if (text.length > 25) {
      return m.reply(`${e} El texto no puede tener más de 25 caracteres. Actualmente tiene ${text.length}.`);
    }

    await m.react("🕒");

    // Obtener hora actual en Ciudad de México
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const formatTime = date => {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    };

    const time = formatTime(now);
    const chatDate = new Date(now.getTime() - 5 * 60 * 1000);
    const chatTime = formatTime(chatDate);

    const apiUrl = `https://api.deline.web.id/maker/iqc?text=${encodeURIComponent(text)}&chatTime=${encodeURIComponent(chatTime)}&statusBarTime=${encodeURIComponent(time)}`;
    const fileReq = await fetch(apiUrl);

    if (!fileReq.ok) throw new Error("API no respondió correctamente");

    const imageBuffer = Buffer.from(await fileReq.arrayBuffer());
    const caption = `✅ Imagen IQC creada con el texto: ${text}`;

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
    console.error("IQC IMAGE ERROR:", err);
    await m.react("❌");
    return m.reply(`${e} Error al crear la imagen: ${err.message}`);
  }
};

handler.help = ["iqc"];
handler.tags = ["logos"];
handler.command = ["iqc", "iqcimage", "iqcimg"];
handler.group = true;

export default handler;
