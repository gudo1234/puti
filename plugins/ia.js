import fetch from "node-fetch"

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  global.openaiKey ||
  global.openai_api_key

const OPENAI_URL =
  "https://api.openai.com/v1/responses"

const OPENAI_IMAGE_URL =
  "https://api.openai.com/v1/images/generations"

const OPENAI_AUDIO_URL =
  "https://api.openai.com/v1/audio/speech"

const MODEL =
  process.env.OPENAI_MODEL ||
  "gpt-5.6-luna"

function requireApiKey() {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "No está configurada OPENAI_API_KEY"
    )
  }
}

async function openaiRequest(url, body) {
  requireApiKey()

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })

  const text = await response.text()

  let json

  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(
      `Respuesta inválida de OpenAI: HTTP ${response.status}`
    )
  }

  if (!response.ok) {
    throw new Error(
      json?.error?.message ||
      `OpenAI HTTP ${response.status}`
    )
  }

  return json
}

function getResponseText(json) {
  if (typeof json?.output_text === "string")
    return json.output_text.trim()

  const parts = []

  for (const output of json?.output || []) {
    for (const content of output?.content || []) {
      if (
        content?.type === "output_text" &&
        content?.text
      ) {
        parts.push(content.text)
      }
    }
  }

  return parts.join("\n").trim()
}

function extractCommand(text) {
  const match =
    text.match(/^(imagen|image|img|dibuja|dibujar|musica|música|voz|audio)\s*:\s*(.+)$/i)

  if (!match)
    return null

  return {
    type: match[1].toLowerCase(),
    prompt: match[2].trim()
  }
}

async function askOpenAI(prompt) {
  const json = await openaiRequest(
    OPENAI_URL,
    {
      model: MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Responde siempre en español. " +
                "Sé natural, claro, útil y preciso. " +
                "No menciones que eres una API."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            }
          ]
        }
      ]
    }
  )

  const answer =
    getResponseText(json)

  if (!answer)
    throw new Error(
      "OpenAI no devolvió texto."
    )

  return answer
}

async function generateImage(prompt) {
  requireApiKey()

  const json = await openaiRequest(
    OPENAI_IMAGE_URL,
    {
      model: "gpt-image-2",
      prompt,
      size: "1024x1024",
      quality: "auto",
      output_format: "png"
    }
  )

  const image =
    json?.data?.[0]

  if (!image)
    throw new Error(
      "OpenAI no devolvió la imagen."
    )

  if (image.b64_json) {
    return Buffer.from(
      image.b64_json,
      "base64"
    )
  }

  if (image.url) {
    const response =
      await fetch(image.url)

    if (!response.ok)
      throw new Error(
        `Error descargando imagen: HTTP ${response.status}`
      )

    return Buffer.from(
      await response.arrayBuffer()
    )
  }

  throw new Error(
    "No se encontró el resultado de imagen."
  )
}

async function generateAudio(text) {
  requireApiKey()

  const response =
    await fetch(OPENAI_AUDIO_URL, {
      method: "POST",
      headers: {
        "Authorization":
          `Bearer ${OPENAI_API_KEY}`,
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: text,
        response_format: "mp3"
      })
    })

  if (!response.ok) {
    const error =
      await response.text()

    throw new Error(
      `OpenAI TTS HTTP ${response.status}: ${error}`
    )
  }

  return Buffer.from(
    await response.arrayBuffer()
  )
}

let handler = async (m, { conn, args }) => {
  try {
    const text =
      args.join(" ").trim()

    if (!text) {
      return m.reply(
        `${e} *Uso correcto:*\n` +
        `> .ia ¿Qué es la inteligencia artificial?\n\n` +
        `*Generar imagen:*\n` +
        `> .ia imagen: un gato astronauta\n\n` +
        `*Generar voz:*\n` +
        `> .ia voz: Hola, ¿cómo estás?\n\n` +
        `*Generar música:*\n` +
        `> .ia musica: una canción electrónica`
      )
    }

    await m.react("💭")

    const command =
      extractCommand(text)

    if (command) {
      const type =
        command.type

      if (
        type === "imagen" ||
        type === "image" ||
        type === "img" ||
        type === "dibuja" ||
        type === "dibujar"
      ) {
        await m.react("🎨")

        const buffer =
          await generateImage(
            command.prompt
          )

        await conn.sendMessage(
          m.chat,
          {
            image: buffer,
            caption:
              `${e} *Imagen generada por IA*\n\n` +
              `> ${command.prompt}`
          },
          { quoted: m }
        )

        return m.react("✅")
      }

      if (
        type === "voz" ||
        type === "audio"
      ) {
        await m.react("🔊")

        const audio =
          await generateAudio(
            command.prompt
          )

        await conn.sendMessage(
          m.chat,
          {
            audio,
            mimetype: "audio/mpeg",
            ptt: false
          },
          { quoted: m }
        )

        return m.react("✅")
      }

      if (
        type === "musica" ||
        type === "música"
      ) {
        return m.reply(
          `${e} La generación de música completa no corresponde a la API de ChatGPT estándar. ` +
          `Puedo generar la letra, estructura, acordes o un prompt musical, ` +
          `pero no voy a fingir que el endpoint de texto genera un MP3 musical completo.`
        )
      }
    }

    const respuesta =
      await askOpenAI(text)

    await conn.sendMessage(
      m.chat,
      {
        text: respuesta
      },
      { quoted: m }
    )

    await m.react("✅")

  } catch (err) {
    console.error(
      "OPENAI ERROR:",
      err
    )

    await m.react("❌")

    return m.reply(
      `${e} *Ocurrió un error con la IA:*\n${err.message}`
    )
  }
}

handler.help = [
  "chatgpt",
  "ia"
]

handler.tags = [
  "buscador"
]

handler.command = [
  "chatgpt",
  "ia",
  "ai"
]

handler.group = true

export default handler
