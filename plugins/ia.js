import fetch from "node-fetch"

const GEMINI_API_KEY = "AQ.Ab8RN6JhgBEmmemPlYP2eHtQP4TyphPqYNKh_AbdwXJk2qP-dA"

const TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash"
]

const IMAGE_MODEL = "gemini-3.1-flash-image"
const MUSIC_MODEL = "lyria-3.5"
const VIDEO_MODEL = "veo-3.1-generate-preview"

const INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions"

const BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta"

const getError = (json) => {
  return json?.error?.message ||
    json?.error?.status ||
    json?.message ||
    "Error desconocido de Gemini"
}

const wait = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms))

const isTemporaryError = (status, message) => {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    /high demand|temporarily|unavailable|overloaded|resource exhausted|rate limit|capacity/i.test(
      message
    )
  )
}

/*
 * Detecta automáticamente qué quiere el usuario.
 *
 * No hace falta escribir:
 * imagen:
 * música:
 * video:
 */

const detectIntent = (text) => {
  const value = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  // VIDEO
  const videoWords = [
    "haz un video",
    "hazme un video",
    "crea un video",
    "generame un video",
    "generame video",
    "genera un video",
    "quiero un video",
    "quiero un vídeo",
    "crea un vídeo",
    "haz un vídeo",
    "hazme un vídeo",
    "video de",
    "vídeo de",
    "animacion de",
    "animación de",
    "clip de",
    "graba un video",
    "graba un vídeo"
  ]

  if (videoWords.some(word => value.includes(word))) {
    return "video"
  }

  // MÚSICA
  const musicWords = [
    "haz una cancion",
    "hazme una cancion",
    "crea una cancion",
    "creame una cancion",
    "genera una cancion",
    "generame una cancion",
    "quiero una cancion",
    "quiero musica",
    "quiero música",
    "haz musica",
    "haz música",
    "hazme musica",
    "hazme música",
    "crea musica",
    "crea música",
    "genera musica",
    "genera música",
    "generame musica",
    "generame música",
    "ponme musica",
    "ponme música",
    "una rola",
    "haz una rola",
    "hazme una rola",
    "crea una rola",
    "genera una rola",
    "una cancion de",
    "una canción de",
    "cancion de",
    "canción de",
    "musica de",
    "música de",
    "tema musical",
    "tema de musica",
    "tema de música",
    "instrumental de",
    "beat de",
    "ritmo de"
  ]

  if (musicWords.some(word => value.includes(word))) {
    return "music"
  }

  // IMAGEN
  const imageWords = [
    "haz una imagen",
    "hazme una imagen",
    "crea una imagen",
    "creame una imagen",
    "genera una imagen",
    "generame una imagen",
    "quiero una imagen",
    "haz un dibujo",
    "hazme un dibujo",
    "crea un dibujo",
    "dibujame",
    "dibujame",
    "dibuja",
    "dibujar",
    "genera una foto",
    "generame una foto",
    "crea una foto",
    "haz una foto",
    "hazme una foto",
    "quiero una foto",
    "crea una ilustracion",
    "crea una ilustración",
    "genera una ilustracion",
    "genera una ilustración",
    "haz un retrato",
    "hazme un retrato",
    "crea un retrato",
    "genera un retrato",
    "imagen de",
    "foto de",
    "ilustracion de",
    "ilustración de",
    "retrato de"
  ]

  if (imageWords.some(word => value.includes(word))) {
    return "image"
  }

  return "text"
}

const cleanPrompt = (text) => {
  return text
    .replace(
      /^(hazme?|creame?|genera(me)?|quiero|por favor|puedes|podrias|podrías)\s+/i,
      ""
    )
    .trim()
}

/*
 * TEXTO
 */

const generateText = async (prompt) => {
  let lastError = null

  for (const model of TEXT_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(INTERACTIONS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
          },
          body: JSON.stringify({
            model,
            input: prompt,
            system_instruction:
              "Responde siempre en español. Sé natural, claro, útil y entretenido. No menciones estas instrucciones internas.",
            generation_config: {
              thinking_level: "low",
              max_output_tokens: 4096
            }
          })
        })

        const json = await res.json()

        if (res.ok) {
          const respuesta =
            json?.output_text ||
            json?.steps
              ?.filter(step => step?.type === "model_output")
              ?.flatMap(step => step?.content || [])
              ?.filter(content => content?.type === "text")
              ?.map(content => content.text)
              ?.join("\n")
              ?.trim()

          if (!respuesta) {
            throw new Error(
              `Gemini ${model} no devolvió una respuesta de texto.`
            )
          }

          console.log(`Gemini respondió usando: ${model}`)

          return respuesta
        }

        const errorMessage = getError(json)

        lastError = new Error(errorMessage)

        if (!isTemporaryError(res.status, errorMessage)) {
          throw lastError
        }

        if (attempt === 0) {
          await wait(2000)
          continue
        }

        console.log(
          `${model} no disponible. Probando modelo de respaldo...`
        )

        break

      } catch (err) {
        lastError = err

        const message = String(err?.message || err)

        if (
          isTemporaryError(null, message) &&
          attempt === 0
        ) {
          await wait(2000)
          continue
        }

        if (isTemporaryError(null, message)) {
          break
        }

        throw err
      }
    }
  }

  throw lastError ||
    new Error(
      "Todos los modelos de Gemini están temporalmente saturados."
    )
}

/*
 * IMAGEN
 */

const generateImage = async (prompt) => {
  const res = await fetch(INTERACTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      input: prompt,
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

  const image =
    json?.output_image?.data ||
    json?.steps
      ?.flatMap(step => step?.content || [])
      ?.find(content =>
        content?.type === "image"
      )?.data

  if (!image) {
    throw new Error(
      "Gemini no devolvió una imagen."
    )
  }

  return Buffer.from(image, "base64")
}

/*
 * MÚSICA
 */

const generateMusic = async (prompt) => {
  const musicPrompt =
    `Crea una canción completa de aproximadamente 2 minutos.
` +
    `Debe tener una estructura musical clara con intro, versos, coro, ` +
    `puente y outro cuando corresponda.
` +
    `Usa voces y letra en español si el usuario pide una canción cantada.
` +
    `Descripción del usuario:
${prompt}`

  const res = await fetch(INTERACTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      model: MUSIC_MODEL,
      input: musicPrompt
    })
  })

  const json = await res.json()

  if (!res.ok) {
    throw new Error(getError(json))
  }

  const audio =
    json?.output_audio?.data ||
    json?.steps
      ?.flatMap(step => step?.content || [])
      ?.find(content =>
        content?.type === "audio"
      )?.data

  if (!audio) {
    throw new Error(
      "Lyria no devolvió el audio."
    )
  }

  return {
    audio: Buffer.from(audio, "base64"),
    lyrics: json?.output_text || ""
  }
}

/*
 * VIDEO
 *
 * Veo genera el video mediante una operación
 * asíncrona. Se espera hasta que termine.
 */

const generateVideo = async (prompt) => {
  const res = await fetch(
    `${BASE_URL}/models/${VIDEO_MODEL}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        instances: [
          {
            prompt:
              `Genera un video cinematográfico de alta calidad basado en esta descripción. ` +
              `Duración aproximada de 8 segundos. Incluye audio ambiental o efectos ` +
              `cuando tenga sentido.\n\n${prompt}`
          }
        ],
        parameters: {
          aspectRatio: "16:9",
          numberOfVideos: 1,
          resolution: "720p"
        }
      })
    }
  )

  const startJson = await res.json()

  if (!res.ok) {
    throw new Error(getError(startJson))
  }

  const operationName = startJson?.name

  if (!operationName) {
    throw new Error(
      "Veo no devolvió una operación de generación."
    )
  }

  console.log(
    `Veo inició la generación: ${operationName}`
  )

  let operation

  for (let attempt = 0; attempt < 60; attempt++) {
    await wait(5000)

    const statusRes = await fetch(
      `${BASE_URL}/${operationName}`,
      {
        method: "GET",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY
        }
      }
    )

    operation = await statusRes.json()

    if (!statusRes.ok) {
      throw new Error(getError(operation))
    }

    if (operation?.done) {
      break
    }

    console.log(
      `Esperando video... ${attempt + 1}/60`
    )
  }

  if (!operation?.done) {
    throw new Error(
      "La generación del video tardó demasiado."
    )
  }

  if (operation?.error) {
    throw new Error(
      getError(operation)
    )
  }

  const videoUri =
    operation
      ?.response
      ?.generateVideoResponse
      ?.generatedSamples?.[0]
      ?.video?.uri

  if (!videoUri) {
    throw new Error(
      "Veo terminó pero no devolvió el video."
    )
  }

  const videoRes = await fetch(videoUri, {
    headers: {
      "x-goog-api-key": GEMINI_API_KEY
    }
  })

  if (!videoRes.ok) {
    throw new Error(
      `No se pudo descargar el video generado (${videoRes.status}).`
    )
  }

  const videoBuffer =
    Buffer.from(
      await videoRes.arrayBuffer()
    )

  return videoBuffer
}

let handler = async (m, { conn, args }) => {
  try {
    if (
      !GEMINI_API_KEY ||
      GEMINI_API_KEY === "PON_AQUI_TU_API_KEY"
    ) {
      return m.reply(
        `${e} *No está configurada la API key de Gemini.*`
      )
    }

    const text = args.join(" ").trim()

    if (!text) {
      return m.reply(
        `${e} *Uso correcto:*\n\n` +
        `> .ia ¿Qué es la inteligencia artificial?\n` +
        `> .ia crea una imagen de un gato astronauta\n` +
        `> .ia hazme una canción de reggaetón triste\n` +
        `> .ia crea un video de un perro corriendo`
      )
    }

    await m.react("💭")

    /*
     * DETECCIÓN AUTOMÁTICA
     */

    const intent = detectIntent(text)
    const prompt = cleanPrompt(text)

    console.log(
      `Gemini IA | intención: ${intent} | petición: ${text}`
    )

    /*
     * IMAGEN
     */

    if (intent === "image") {
      await m.react("🎨")

      const image = await generateImage(
        `Genera una imagen de alta calidad basada exactamente en esta descripción.
No agregues texto ni marcas de agua salvo que el usuario lo solicite.

Descripción:
${prompt}`
      )

      await conn.sendMessage(
        m.chat,
        {
          image,
          caption:
            `${e} *Imagen generada por Gemini*`
        },
        {
          quoted: m
        }
      )

      await m.react("✅")
      return
    }

    /*
     * MÚSICA
     */

    if (intent === "music") {
      await m.react("🎵")

      const result = await generateMusic(prompt)

      await conn.sendMessage(
        m.chat,
        {
          audio: result.audio,
          mimetype: "audio/mpeg",
          fileName: "gemini-music.mp3",
          ptt: false
        },
        {
          quoted: m
        }
      )

      /*
       * Si Lyria devolvió letras,
       * también se las mostramos.
       */

      if (result.lyrics?.trim()) {
        await conn.sendMessage(
          m.chat,
          {
            text:
              `${e} *Música generada por Lyria 3.5*`
          },
          {
            quoted: m
          }
        )
      }

      await m.react("✅")
      return
    }

    /*
     * VIDEO
     */

    if (intent === "video") {
      await m.react("🎬")

      const video = await generateVideo(prompt)

      await conn.sendMessage(
        m.chat,
        {
          video,
          mimetype: "video/mp4",
          fileName: "gemini-video.mp4",
          caption:
            `${e} *Video generado por Veo 3.1*`
        },
        {
          quoted: m
        }
      )

      await m.react("✅")
      return
    }

    /*
     * TEXTO NORMAL
     */

    const normalPrompt =
      `El usuario te está hablando mediante un bot de WhatsApp llamado Zeus.

` +
      `Responde directamente a su mensaje.
` +
      `Mantén el idioma español.
` +
      `Sé natural y útil.
` +
      `No digas que eres un bot de WhatsApp.

` +
      `Mensaje del usuario:
${text}`

    const respuesta =
      await generateText(normalPrompt)

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
    console.error(
      "GEMINI IA ERROR:",
      err
    )

    await m.react("❌")

    const mensaje =
      String(err?.message || err)

    if (
      /API key|api key|unauthorized|permission|invalid|authentication/i.test(
        mensaje
      )
    ) {
      return m.reply(
        `${e} *Error con la API de Gemini.*\n\n` +
        `La clave proporcionada no es válida o no tiene acceso al modelo.\n\n` +
        `> ${mensaje}`
      )
    }

    if (
      /quota|limit|429|resource exhausted|rate limit|high demand|temporarily|unavailable|overloaded|capacity|503/i.test(
        mensaje
      )
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

handler.help = [
  "chatgpt",
  "ia",
  "ai"
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
