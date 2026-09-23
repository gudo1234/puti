let handler = async (m, { conn, args }) => {
  try {
    const raw = String(
      m.text || m.message?.conversation || ""
    ).toLowerCase().trim();

    const invoked = raw.replace(/^[^\w]+/, "").split(" ")[0];

    let userChoice = null;

    if (["piedra", "papel", "tijera"].includes(invoked)) {
      userChoice = invoked;
    } else if (invoked === "ppt" && args.length > 0) {
      userChoice = String(args[0]).toLowerCase();
    }

    const choices = ["piedra", "papel", "tijera"];
    if (!choices.includes(userChoice)) {
      return m.reply(
        "🪨📄✂️ *Piedra, Papel o Tijera*\n\n" +
        "Usa:\n" +
        "• `.piedra`\n" +
        "• `.papel`\n" +
        "• `.tijera`\n" +
        "• `.ppt piedra`"
      );
    }

    const botChoice = choices[Math.floor(Math.random() * choices.length)];

    let result;
    if (userChoice === botChoice) result = "🤝 *EMPATE*";
    else if (
      (userChoice === "piedra" && botChoice === "tijera") ||
      (userChoice === "papel" && botChoice === "piedra") ||
      (userChoice === "tijera" && botChoice === "papel")
    ) result = "🎉 *GANASTE*";
    else result = "💀 *PERDISTE*";

    const emojis = { piedra: "🪨", papel: "📄", tijera: "✂️" };

    const text = 
`🪨📄✂️ *Piedra, Papel o Tijera*

👤 *Tú:* ${emojis[userChoice]} ${userChoice}
🤖 *Bot:* ${emojis[botChoice]} ${botChoice}

➡️ Resultado: ${result}`;

    await conn.sendMessage(m.chat, { text }, { quoted: m });

  } catch (err) {
    console.error("PPT GAME ERROR:", err);
    await m.reply("❌ Error ejecutando el juego.");
  }
};

handler.help = ["ppt"];
handler.tags = ["juegos"];
handler.command = ["ppt", "piedra", "papel", "tijera", "rps"];
handler.group = true;

export default handler;
