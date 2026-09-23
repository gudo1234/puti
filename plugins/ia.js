import fetch from "node-fetch"

let handler = async (m, { conn, args }) => {
  try {
    const text = args.join(" ")
    if (!text) {
      return m.reply(
      `${e} *Uso correcto:*\n> .ia ¿Qué es la inteligencia artificial?`
      )
    }

    await m.react("💭")

    const prompt =
      `Responde en español de forma natural, clara y profesional.\n\n` +
      `Pregunta: ${text}`

    const apiUrl = `https://api.dorratz.com/ai/gpt?prompt=${encodeURIComponent(prompt)}`

    const res = await fetch(apiUrl)
    const json = await res.json()

    let respuesta = json.result

    if (typeof respuesta === "string") {
      respuesta = respuesta.replace(/^"|"$/g, "")
      respuesta = respuesta.replace(/\\n/g, "\n")
      respuesta = respuesta.replace(/\\"/g, '"')
      respuesta = respuesta.trim()
    }

    await conn.sendMessage(
      m.chat,
      { text: respuesta },
      { quoted: m }
    )

  } catch (err) {
    console.error("CHATGPT ERROR:", err)
    await m.react("❌")
    await m.reply("❌ Ocurrió un error al conectarse con la IA.")
  }
}

handler.help = ["chatgpt"]
handler.tags = ["buscador"]
handler.command = ["chatgpt", "ia", "ai"]
handler.group = true

export default handler
