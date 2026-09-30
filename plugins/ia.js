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
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /high demand|temporarily|unavailable|overloaded|resource exhausted|rate limit|capacity|timeout|deadline/i.test(
      String(message || "")
    )
  )
}

/*
 * DETECCIÓN AUTOMÁTICA
 */

const detectIntent = (text) => {
  const value = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  /*
   * VIDEO
   */

  const videoWords = [
    "haz un video",
    "hazme un video",
    "crea un video",
    "creame un video",
    "genera un video",
    "generame un video",
    "quiero un video",
    "video de",
    "haz un clip",
    "hazme un clip",
    "crea un clip",
    "genera un clip",
    "clip de",
    "animacion de",
    "crea una animacion",
    "genera una animacion",
    "haz una animacion",
    "hazme una animacion",
    "graba un video",
    "graba un clip",
    "video cinematografico",
    "video realista"
  ]

  if (videoWords.some(word => value.includes(word))) {
    return "video"
  }

  /*
   * MÚSICA
   */

  const musicWords = [
    "haz una cancion",
    "hazme una cancion",
    "crea una cancion",
    "creame una cancion",
    "genera una cancion",
    "generame una cancion",
    "quiero una cancion",
    "quiero musica",
    "haz musica",
    "hazme musica",
    "crea musica",
    "genera musica",
    "generame musica",
    "ponme musica",
    "una rola",
    "haz una rola",
    "hazme una rola",
    "crea una rola",
    "genera una rola",
    "una cancion de",
    "cancion de",
    "musica de",
    "tema musical",
    "tema de musica",
    "instrumental de",
    "beat de",
    "ritmo de",
    "reggaeton",
    "regueton",
    "trap",
    "rap",
    "bachata",
    "salsa",
    "cumbia",
    "corridos",
    "corridos tumbados",
    "rock",
    "pop",
    "merengue",
    "electronica",
    "musica romantica",
    "musica triste",
    "musica relajante"
  ]

  if (musicWords.some(word => value.includes(word))) {
    return "music"
  }

  /*
   * IMAGEN
   */

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
    "creame un dibujo",
    "dibujame",
    "dibuja",
    "dibujar",
    "genera una foto",
    "generame una foto",
    "crea una foto",
    "creame una foto",
    "haz una foto",
    "hazme una foto",
    "quiero una foto",
    "crea una ilustracion",
    "creame una ilustracion",
    "genera una ilustracion",
    "haz una ilustracion",
    "haz un retrato",
    "hazme un retrato",
    "crea un retrato",
    "genera un retrato",
    "imagen de",
    "foto de",
    "ilustracion de",
    "retrato de",
    "disena una imagen",
    "diseña una imagen",
    "crea un poster",
    "crea un logo"
  ]

  if (imageWords.some(word => value.includes(word))) {
    return "image"
  }

  return "text"
}

const cleanPrompt = (text) => {
  return text
    .replace(
      /^(hazme?|creame?|genera(me)?|quiero|por favor|puedes|podrias|dibuja(me)?|crea(me)?)\s+/i,
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
        const res = await fetch(
          INTERACTIONS_URL,
          {
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
          }
        )

        const json = await res.json()

        if (res.ok) {
          const respuesta =
            json?.output_text ||
            json?.steps
              ?.filter(step =>
                step?.type === "model_output"
              )
              ?.flatMap(step =>
                step?.content || []
              )
              ?.filter(content =>
                content?.type === "text"
              )
              ?.map(content =>
                content.text
              )
              ?.join("\n")
              ?.trim()

          if (!respuesta) {
            throw new Error(
              `Gemini ${model} no devolvió texto.`
            )
          }

          console.log(
            `Gemini texto: ${model}`
          )

          return respuesta
        }

        const errorMessage =
          getError(json)

        lastError =
          new Error(errorMessage)

        if (
          !isTemporaryError(
            res.status,
            errorMessage
          )
        ) {
          throw lastError
        }

        if (attempt === 0) {
          await wait(2500)
          continue
        }

        break

      } catch (err) {
        lastError = err

        const message =
          String(err?.message || err)

        if (
          isTemporaryError(
            null,
            message
          ) &&
          attempt === 0
        ) {
          await wait(2500)
          continue
        }

        if (
          isTemporaryError(
            null,
            message
          )
        ) {
          break
        }

        throw err
      }
    }
  }

  throw lastError ||
    new Error(
      "No fue posible obtener una respuesta de texto."
    )
}

/*
 * IMAGEN
 */

const generateImage = async (prompt) => {
  let lastError = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        INTERACTIONS_URL,
        {
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
              mime_type: "image/jpeg",
              aspect_ratio: "1:1",
              image_size: "1K"
            }
          })
        }
      )

      const json =
        await res.json()

      if (!res.ok) {
        const error =
          getError(json)

        lastError =
          new Error(error)

        if (
          !isTemporaryError(
            res.status,
            error
          )
        ) {
          throw lastError
        }

        if (attempt < 2) {
          console.log(
            `Imagen temporalmente no disponible. Reintento ${attempt + 1}/2`
          )

          await wait(
            3000 * (attempt + 1)
          )

          continue
        }

        throw lastError
      }

      const image =
        json?.output_image?.data ||
        json?.steps
          ?.flatMap(step =>
            step?.content || []
          )
          ?.find(content =>
            content?.type === "image" &&
            content?.data
          )
          ?.data

      if (!image) {
        throw new Error(
          "Gemini terminó la generación pero no devolvió los datos de la imagen."
        )
      }

      return Buffer.from(
        image,
        "base64"
      )

    } catch (err) {
      lastError = err

      if (
        isTemporaryError(
          null,
          String(err?.message || err)
        ) &&
        attempt < 2
      ) {
        await wait(
          3000 * (attempt + 1)
        )

        continue
      }

      throw err
    }
  }

  throw lastError
}

/*
 * MÚSICA
 */

const generateMusic = async (prompt) => {
  const musicPrompt =
    `Crea una canción completa de aproximadamente 2 minutos.

` +
    `La canción debe tener una estructura musical clara.
` +
    `Incluye intro, versos, coro, puente y outro cuando corresponda.
` +
    `Si el usuario solicita una canción cantada, utiliza voz y letra en español.
` +
    `Si solicita instrumental, no utilices voz.
` +
    `Respeta el género, ritmo, ambiente y tema solicitado.

` +
    `Descripción del usuario:
${prompt}`

  let lastError = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res =
        await fetch(
          INTERACTIONS_URL,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key":
                GEMINI_API_KEY
            },
            body: JSON.stringify({
              model: MUSIC_MODEL,
              input: musicPrompt
            })
          }
        )

      const json =
        await res.json()

      if (!res.ok) {
        const error =
          getError(json)

        lastError =
          new Error(error)

        if (
          !isTemporaryError(
            res.status,
            error
          )
        ) {
          throw lastError
        }

        if (attempt < 2) {
          console.log(
            `Lyria temporalmente no disponible. Reintento ${attempt + 1}/2`
          )

          await wait(
            4000 * (attempt + 1)
          )

          continue
        }

        throw lastError
      }

      const audio =
        json?.output_audio?.data ||
        json?.steps
          ?.flatMap(step =>
            step?.content || []
          )
          ?.find(content =>
            (
              content?.type === "audio" ||
              content?.type === "audio_data"
            ) &&
            content?.data
          )
          ?.data

      if (!audio) {
        throw new Error(
          "Lyria terminó la generación pero no devolvió el audio."
        )
      }

      return {
        audio: Buffer.from(
          audio,
          "base64"
        ),
        lyrics:
          json?.output_text || ""
      }

    } catch (err) {
      lastError = err

      if (
        isTemporaryError(
          null,
          String(err?.message || err)
        ) &&
        attempt < 2
      ) {
        await wait(
          4000 * (attempt + 1)
        )

        continue
      }

      throw err
    }
  }

  throw lastError
}

/*
 * VIDEO
 */

const generateVideo = async (prompt) => {
  let startJson = null
  let lastError = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res =
        await fetch(
          `${BASE_URL}/models/${VIDEO_MODEL}:predictLongRunning`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key":
                GEMINI_API_KEY
            },
            body: JSON.stringify({
              instances: [
                {
                  prompt:
                    `Genera un video cinematográfico de alta calidad basado exactamente en esta descripción.

` +
                    `Duración aproximada de 8 segundos.
` +
                    `Movimiento natural.
` +
                    `Buena iluminación y composición.
` +
                    `Incluye audio ambiental o efectos de sonido cuando tenga sentido.

` +
                    `Descripción:
${prompt}`
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

      startJson =
        await res.json()

      if (!res.ok) {
        const error =
          getError(startJson)

        lastError =
          new Error(error)

        if (
          !isTemporaryError(
            res.status,
            error
          )
        ) {
          throw lastError
        }

        if (attempt < 2) {
          console.log(
            `Veo temporalmente no disponible. Reintento ${attempt + 1}/2`
          )

          await wait(
            5000 * (attempt + 1)
          )

          continue
        }

        throw lastError
      }

      break

    } catch (err) {
      lastError = err

      if (
        isTemporaryError(
          null,
          String(err?.message || err)
        ) &&
        attempt < 2
      ) {
        await wait(
          5000 * (attempt + 1)
        )

        continue
      }

      throw err
    }
  }

  const operationName =
    startJson?.name

  if (!operationName) {
    throw lastError ||
      new Error(
        "Veo no devolvió una operación de generación."
      )
  }

  console.log(
    `Veo inició la generación: ${operationName}`
  )

  let operation = null

  for (
    let attempt = 0;
    attempt < 60;
    attempt++
  ) {
    await wait(5000)

    const statusRes =
      await fetch(
        `${BASE_URL}/${operationName}`,
        {
          method: "GET",
          headers: {
            "x-goog-api-key":
              GEMINI_API_KEY
          }
        }
      )

    operation =
      await statusRes.json()

    if (!statusRes.ok) {
      throw new Error(
        getError(operation)
      )
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

  const videoRes =
    await fetch(
      videoUri,
      {
        headers: {
          "x-goog-api-key":
            GEMINI_API_KEY
        }
      }
    )

  if (!videoRes.ok) {
    throw new Error(
      `No se pudo descargar el video generado (${videoRes.status}).`
    )
  }

  return Buffer.from(
    await videoRes.arrayBuffer()
  )
}

/*
 * HANDLER
 */

let handler = async (
  m,
  { conn, args }
) => {
  try {
    if (
      !GEMINI_API_KEY ||
      GEMINI_API_KEY ===
        "PON_AQUI_TU_API_KEY"
    ) {
      return m.reply(
        `${e} *No está configurada la API key de Gemini.*`
      )
    }

    const text =
      args.join(" ").trim()

    if (!text) {
      return m.reply(
        `${e} *Uso correcto:*\n\n` +
        `> .ia ¿Qué es la inteligencia artificial?\n` +
        `> .ia crea una imagen de un Lamborghini negro\n` +
        `> .ia hazme una canción de reggaetón triste\n` +
        `> .ia crea un video de un perro corriendo en la playa`
      )
    }

    await m.react("💭")

    const intent =
      detectIntent(text)

    const prompt =
      cleanPrompt(text)

    console.log(
      `Gemini IA | intención: ${intent} | petición: ${text}`
    )

    /*
     * IMAGEN
     */

    if (intent === "image") {
      await m.react("🎨")

      const image =
        await generateImage(
          `Genera una imagen de alta calidad basada exactamente en esta descripción.

No agregues texto, marcas de agua, logotipos ni elementos adicionales salvo que el usuario los solicite.

Descripción:
${prompt}`
        )

      await conn.sendMessage(
        m.chat,
        {
          image,
          mimetype: "image/jpeg",
          fileName:
            "gemini-image.jpg",
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

      const result =
        await generateMusic(
          prompt
        )

      await conn.sendMessage(
        m.chat,
        {
          audio: result.audio,
          mimetype: "audio/mpeg",
          fileName:
            "gemini-music.mp3",
          ptt: false
        },
        {
          quoted: m
        }
      )

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

      await m.react("✅")
      return
    }

    /*
     * VIDEO
     */

    if (intent === "video") {
      await m.react("🎬")

      const video =
        await generateVideo(
          prompt
        )

      await conn.sendMessage(
        m.chat,
        {
          video,
          mimetype: "video/mp4",
          fileName:
            "gemini-video.mp4",
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
     * TEXTO
     */

    const normalPrompt =
      `El usuario te está hablando mediante un bot de WhatsApp llamado Zeus.

` +
      `Responde directamente a su mensaje.
` +
      `Mantén el idioma español.
` +
      `Sé natural, claro y útil.
` +
      `No digas que eres un bot de WhatsApp.

` +
      `Mensaje del usuario:
${text}`

    const respuesta =
      await generateText(
        normalPrompt
      )

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
      String(
        err?.message || err
      )

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
      /429|quota|resource exhausted|rate limit/i.test(
        mensaje
      )
    ) {
      return m.reply(
        `${e} *Se alcanzó temporalmente el límite de Gemini.*\n\n` +
        `El bot reintentó automáticamente la operación.\n\n` +
        `> ${mensaje}`
      )
    }

    if (
      /high demand|temporarily|unavailable|overloaded|capacity|503|502|500|timeout|deadline/i.test(
        mensaje
      )
    ) {
      return m.reply(
        `${e} *El servicio de generación está temporalmente ocupado.*\n\n` +
        `El bot realizó varios intentos automáticamente.\n\n` +
        `> ${mensaje}`
      )
    }

    return m.reply(
      `${e} *Ocurrió un error con Gemini:*\n\n` +
      `> ${mensaje}`
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
