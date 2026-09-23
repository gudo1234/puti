let handler = async (m, { conn, args }) => {
  try {
    const text = args.join(' ');
    if (!text)
      return await m.reply(`${e} Por favor, ingrese un texto para hacer un Top 10.`);

    const metadata = await conn.groupMetadata(m.chat);
    const participants = metadata.participants
      .map(p => p.id)
      .filter(id => id !== m.sender);

    const shuffled = participants.sort(() => 0.5 - Math.random());
    const top10 = shuffled.slice(0, 10);

    const emojis = ['🤓','😅','😂','😳','😎', '🥵', '😱', '🤑', '🙄', '💩','🍑','🤨','🥴','🔥','👇🏻','😔', '👀','🌚'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    let top = `*${emoji} Top 10 ${text} ${emoji}*\n\n`;
    top10.forEach((id, index) => {
      top += `*${index + 1}.* @${id.split("@")[0]}\n`;
    });

    await conn.sendMessage(
      m.chat,
      { text: top, mentions: top10 },
      { quoted: m }
    );

  } catch (err) {
    console.error("TOP 10 ERROR:", err);
    await conn.sendMessage(
      m.chat,
      { text: "❌ Ocurrió un error ejecutando el comando Top 10." },
      { quoted: m }
    );
  }
};

handler.help = ["top"];
handler.tags = ["juegos"];
handler.command = ["top", "topp"];
handler.group = true;

export default handler;
