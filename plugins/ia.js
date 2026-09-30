import fetch from "node-fetch"

const GEMINI_API_KEY = "AQ.Ab8RN6JhgBEmmemPlYP2eHtQP4TyphPqYNKh_AbdwXJk2qP-dA"

const TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash"
]

const IMAGE_MODEL = "gemini-3.1-flash-image"

const IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

const getError = (json) => {
  return json?.error?.message ||
    json?.error?.status ||
    json?.message ||
    "Error desconocido de Gemini"
}

const isTemporaryError = (status, message) => {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    /high demand|temporarily|unavailable|overloaded|resource exhausted|rate limit/i.test(message)
  )
}

const generateText = async (prompt) => {
  let lastError = null

  for (const model of TEXT_MODELS) {
    const API_URL =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
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

        if (res.ok) {
          const respuesta = json?.candidates?.[0]?.content?.parts
            ?.filter(x => typeof x.text === "string")
            ?.map(x => x.text)
            ?.join("\n")
            ?.trim()

          if (!respuesta) {
            throw new Error(`Gemini (${model}) no devolvió una respuesta de texto.`)
          }

          return respuesta
        }

        const errorMessage = getError(json)
        lastError = new Error(errorMessage)

        if (!isTemporaryError(res.status, errorMessage)) {
          throw lastError
        }

        if (attempt < 2) {
          const delay = 1500 * Math.pow(2, attempt)

          console.log(
            `Gemini ${model} ocupado. Reintento ${attempt + 1}/3 en ${delay}ms...`
          )

          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        console.log(
          `Gemini ${model} sigue ocupado. Cambiando a modelo de respaldo...`
        )

        break

      } catch (err) {
        lastError = err

        const message = String(err?.message || err)

        if (
          isTemporaryError(null, message) &&
          attempt < 2
        ) {
          const delay = 1500 * Math.pow(2, attempt)

          console.log(
            `Error temporal en ${model}. Reintento ${attempt + 1}/3 en ${delay}ms...`
          )

          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        if (isTemporaryError(null, message)) {
          console.log(
            `Gemini ${model} no disponible. Cambiando a modelo de respaldo...`
          )
          break
        }

        throw err
      }
    }
  }

  throw lastError ||
    new Error("Todos los modelos de Gemini están temporalmente saturados.")
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
      return m.reply(`${e} *No está configurada la API key de Gemini.*`)
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
      /API key|api key|unauthorized|permission|invalid|authentication/i.test(mensaje)
    ) {
      return m.reply(
        `${e} *Error con la API de Gemini.*\n\n` +
        `La clave proporcionada no es válida o no tiene acceso a este modelo.\n\n` +
        `> ${mensaje}`
      )
    }

    if (
      /quota|limit|429|resource exhausted|rate limit|high demand|temporarily|unavailable|overloaded|503/i.test(mensaje)
    ) {
      return m.reply(
        `${e} *Gemini está temporalmente saturado.*\n\n` +
        `Se intentaron automáticamente los modelos disponibles.\n\n` +
        `> Inténtalo nuevamente en unos segundos.`
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
