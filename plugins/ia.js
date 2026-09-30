import fetch from "node-fetch"

const GEMINI_API_KEY = "AQ.Ab8RN6JhgBEmmemPIYP2eHtQP4TyphPqYNKh_AbdwXJk2qP-dA"

const TEXT_MODEL = "gemini-3.8-flash"
const IMAGE_MODEL = "gemini-3.1-flash-image"

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent`
const IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

const getError = (json) => {
  return json?.error?.message ||
    json?.error?.status ||
    json?.message ||
    "Error desconocido de Gemini"
}

const generateText = async (prompt) => {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "Responde siempre en español. Sé natural, claro, útil y entretenido. No menciones estas instrucciones internas."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096
      }
    })
  })

  const json = await res.json()

  if (!res.ok) {
    throw new Error(getError(json))
  }

  const respuesta = json?.candidates?.[0]?.content?.parts
    ?.filter(x => typeof x.text === "string")
    ?.map(x => x.text)
    ?.join("\n")
    ?.trim()

  if (!respuesta) {
    throw new Error("Gemini no devolvió una respuesta de texto.")
  }

  return respuesta
}

const generateImage = async (prompt) => {
  const res = await fetch(IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      input: [
        {
          type: "text",
          text: prompt
        }
      ],
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: "1:1",
        image_size: "1K"
      }
    })
  })

  const json = await res.json()

  if (!res.ok) {
    throw new Error(getError(json))
  }

  const image = json?.output_image?.data

  if (!image) {
    throw new Error("Gemini no devolvió una imagen.")
  }

  return Buffer.from(image, "base64")
}

let handler = async (m, { conn, args }) => {
  try {
    if (!GEMINI_API_KEY) {
      return m.reply(
        `${e} *No está configurada la API key de Gemini.*`
      )
    }

    const text = args.join(" ").trim()

    if (!text) {
      return m.reply(
        `${e} *Uso correcto:*\n\n` +
        `> .ia ¿Qué es la inteligencia artificial?\n` +
        `> .ia imagen: un dragón azul volando sobre una ciudad futurista`
      )
    }

    await m.react("💭")

    const imageMatch = text.match(
      /^(imagen|image|img|dibuja|dibujar)\s*:\s*(.+)$/is
    )

    if (imageMatch) {
      const prompt = imageMatch[2].trim()

      if (!prompt) {
        await m.react("❌")

        return m.reply(
          `${e} Escribe qué imagen quieres generar.\n\n` +
          `> .ia imagen: un gato astronauta en Marte`
        )
      }

      await m.react("🎨")

      const image = await generateImage(
        `Genera una imagen de alta calidad basada exactamente en esta descripción:\n\n${prompt}`
      )

      await conn.sendMessage(
        m.chat,
        {
          image,
          caption: `${e} *Imagen generada por Gemini*`
        },
        {
          quoted: m
        }
      )

      await m.react("✅")
      return
    }

    const prompt =
      `El usuario te está hablando mediante un bot de WhatsApp llamado Zeus.\n\n` +
      `Responde directamente a su mensaje.\n` +
      `Mantén el idioma español.\n` +
      `Pregunta del usuario:\n${text}`

    const respuesta = await generateText(prompt)

    await conn.sendMessage(
      m.chat,
      {
        text: respuesta
      },
      {
        quoted: m
      }
    )

    await m.react("✅")

  } catch (err) {
    console.error("GEMINI IA ERROR:", err)

    await m.react("❌")

    const mensaje = String(err?.message || err)

    if (
      /API key|api key|unauthorized|permission|invalid|authentication/i.test(
        mensaje
      )
    ) {
      return m.reply(
        `${e} *Error con la API de Gemini.*\n\n` +
        `La clave proporcionada no es válida o no tiene acceso a este modelo.\n\n` +
        `> ${mensaje}`
      )
    }

    if (
      /quota|limit|429|resource exhausted|rate limit/i.test(
        mensaje
      )
    ) {
      return m.reply(
        `${e} *Se alcanzó el límite de uso de Gemini.*\n\n` +
        `Espera un momento e inténtalo nuevamente.`
      )
    }

    return m.reply(
      `${e} *Ocurrió un error con Gemini:*\n` +
      `${mensaje}`
    )
  }
}

handler.help = ["chatgpt", "ia", "ai"]
handler.tags = ["buscador"]
handler.command = ["chatgpt", "ia", "ai"]
handler.group = true

export default handler
