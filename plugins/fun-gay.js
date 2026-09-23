import fetch from "node-fetch";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

let handler = async (m, { conn }) => {
  try {
    let jid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
           || m.quoted?.sender
           || m.sender;
    jid = jidNormalizedUser(jid);

    const number = jid.split("@")[0];
    const userTag = "@" + number;
    const random = Math.floor(Math.random() * 100);
    let text;
    if (random < 20) text = "Usted es hetero 🤪🤙";
    else if (random <= 30) text = "Más o menos 🤔";
    else if (random <= 40) text = "Tengo mis dudas 😑";
    else if (random <= 49) text = "Tengo razón? 😏";
    else if (random === 50) text = "Eres o no? 🧐";
    else text = "Usted es gay 🥸";

    let avatar;
    try {
      avatar = await conn.profilePictureUrl(jid, "image");
    } catch {
      avatar = "https://telegra.ph/file/24fa902ead26340f3df2c.png";
    }
    const imgBuffer = await fetch(
      `https://some-random-api.com/canvas/gay?avatar=${encodeURIComponent(avatar)}`
    ).then(r => r.arrayBuffer());

    await conn.sendFile(
      m.chat,
      Buffer.from(imgBuffer),
      "gay.jpg",
      `Ese negro es🏳️‍🌈 *${random}% Gay*\n\n${text}`,
      m, null, rcanal);

  } catch (err) {
    console.error("GAY COMMAND ERROR:", err);
    await m.reply("❌ Error ejecutando el comando.");
  }
};

handler.help = ["gay"];
handler.tags = ["juegos"];
handler.command = ["gay", "gey"];
handler.group = true;

export default handler;
