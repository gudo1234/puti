import fetch from 'node-fetch';

let handler = async (m, { conn, args }) => {
  try {
    if (!args || args.length === 0) {
      return m.reply(`${e} Por favor, ingresa el nombre del Pokémon que quieres buscar.`);
    }

    const pokemonName = args.join(" ");

    await m.react("🕒");

    const url = `https://some-random-api.com/pokemon/pokedex?pokemon=${encodeURIComponent(pokemonName)}`;
    const response = await fetch(url);

    if (!response.ok) {
      return m.reply("❌ Ocurrió un error al buscar el Pokémon.");
    }

    const json = await response.json();

    const message = 
`📖 *Pokédex - Información de ${json.name}*

☁️ *Nombre:* ${json.name}
🔖 *ID:* ${json.id}
💬 *Tipo:* ${json.type}
💪 *Habilidades:* ${json.abilities}
🎴 *Tamaño:* ${json.height}
⚖️ *Peso:* ${json.weight}

📖 *Descripción:*
${json.description}

🔍 Más detalles en la Pokédex oficial:
🔗 https://www.pokemon.com/es/pokedex/${json.name.toLowerCase()}`;

    await conn.sendMessage(
      m.chat,
      {
        text: message,
        contextInfo: {
          mentionedJid: [m.sender],
          externalAdReply: {
            title: `${e} Pokedex - Info`,
            body: textbot,
            thumbnailUrl: redes,
            thumbnail: await (await fetch("https://files.catbox.moe/b223fa.jpg")).buffer(),
            sourceUrl: redes,
            mediaType: 1
          }
        }
      },
      { quoted: m }
    );

    await m.react("✅");

  } catch (err) {
    console.error("Error en el comando pokedex:", err);
    await m.reply("❌ Ocurrió un error ejecutando el comando Pokédex.");
  }
};

handler.help = ["pokemon"];
handler.tags = ["buscador"];
handler.command = ["pokemon", "pokemón", "pokedex", "pokémon"];
handler.group = true;

export default handler;
