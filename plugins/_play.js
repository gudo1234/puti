import fetch from "node-fetch"
import yts from "yt-search"
import sharp from "sharp"
import { generateWAMessageFromContent } from "@whiskeysockets/baileys"

const safeFetch = async (url, options = {}) => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) return null
    return response
  } catch {
    return null
  }
}

const safeJson = async (res) => {
  try {
    return res ? await res.json() : null
  } catch {
    return null
  }
}

const handler = async (m, { conn, text, usedPrefix, command, args }) => {

  const docAudio = ['play3', 'ytadoc', 'mp3doc', 'ytmp3doc']
  const docVideo = ['play4', 'ytvdoc', 'mp4doc', 'ytmp4doc']

  const normalAudio = [
    'play',
    'yta',
    'mp3',
    'ytmp3',
    'playaudio'
  ]

  const normalVideo = [
    'play2',
    'ytv',
    'mp4',
    'ytmp4',
    'playvid'
  ]

  if (!text) {
    const tipo = normalAudio.includes(command)
      ? 'audio'
      : docAudio.includes(command)
      ? 'audio en documento'
      : normalVideo.includes(command)
      ? 'video'
      : 'video en documento'

    return m.reply(
      `${e} Ingresa _texto_ o _enlace_ de YouTube para descargar el *${tipo}.*`
    )
  }

  await m.react("🕒")

  try {

    const query = args.join(" ")

    const ytRegex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

    const ytMatch = query.match(ytRegex)

    const search = ytMatch
      ? `https://youtube.com/watch?v=${ytMatch[1]}`
      : query

    const yt = await yts(search).catch(() => null)

    const v = ytMatch
      ? yt?.videos?.find(x => x.videoId === ytMatch[1])
      : yt?.videos?.[0]

    if (!v) {
      await m.react("✖️")
      return m.reply("❌ No se encontró el video.")
    }

    const {
      title,
      thumbnail,
      timestamp,
      views,
      ago,
      url,
      author
    } = v

    const duration = timestamp || "0:00"

    const toSeconds = t =>
      t.split(":").reduce(
        (a, n) => a * 60 + +n,
        0
      )

    const mins = toSeconds(duration) / 60

    const sendDoc =
      mins > 20 ||
      docAudio.includes(command) ||
      docVideo.includes(command)

    const isAudio =
      [...docAudio, ...normalAudio].includes(command)

    const type = isAudio
      ? (sendDoc ? "audio (doc)" : "audio")
      : (sendDoc ? "video (doc)" : "video")

    const aviso =
      !docAudio.includes(command) &&
      !docVideo.includes(command) &&
      mins > 20
        ? `\n> ‣ Se enviará como documento por superar 20 minutos.`
        : ""

    const info = `╭──── • ────╮
> ✰ *Título:* ${title}
> ♢ *Canal:* ${author?.name || "Desconocido"}
> ♪ *Duración:* ${duration}
> ♫ *Vistas:* ${views?.toLocaleString() || "Desconocidas"}
> ♪ *Publicado:* ${ago || "Desconocido"}
> ♬ *Link:* ${url}
╰──── • ────╯

⏳ _Preparando ${type}..._${aviso}`.trim()

    let thumb = null

    try {
      const res = await safeFetch(thumbnail)

      const buff = res
        ? Buffer.from(await res.arrayBuffer())
        : null

      if (buff) {
        thumb = await sharp(buff)
          .resize(300, 300, {
            fit: "cover"
          })
          .jpeg({
            quality: 80
          })
          .toBuffer()
      }
    } catch {}

    /*
     * VISTA PREVIA:
     * ÚNICAMENTE locationMessage.
     *
     * No externalAdReply
     * No buttons
     * No buttonsMessage
     * No forwardedNewsletterMessageInfo
     * No contextInfo
     */

    const locationMessage = {
      degreesLatitude: 0,
      degreesLongitude: 0,

      name: info,

      address: "ᴢᴇɴᴛʀɪx-ʙᴏᴛ"
    }

    if (thumb) {
      locationMessage.jpegThumbnail = thumb
    }

    const rawContent = {
      locationMessage
    }

    const msg = generateWAMessageFromContent(
      m.chat,
      rawContent,
      {
        userJid: conn.user.id
      }
    )

    await conn.relayMessage(
      m.chat,
      msg.message,
      {
        messageId: msg.key.id
      }
    )

    /*
     * API PRINCIPAL: ALYACORE
     */

    let data = null
    let usedApi = ""

    const alyaUrl = isAudio
      ? `https://api.alyacore.xyz/dl/fastytmp3?url=${encodeURIComponent(url)}&key=oboe`
      : `https://api.alyacore.xyz/dl/ytmp4?url=${encodeURIComponent(url)}&key=oboe`

    const alyaRes = await safeFetch(alyaUrl)
    const alyaJson = await safeJson(alyaRes)

    if (
      alyaJson?.status &&
      alyaJson?.data?.dl
    ) {
      data = {
        link: alyaJson.data.dl,
        title: alyaJson.data.title || title,
        author:
          alyaJson.data.author ||
          author?.name ||
          "Desconocido",
        duration:
          alyaJson.data.duration ||
          duration,
        thumbnail:
          alyaJson.data.thumbnail ||
          thumbnail,
        format:
          alyaJson.data.format ||
          (isAudio ? "mp3" : "mp4"),
        quality:
          alyaJson.data.quality ||
          "Automática",
        fileName:
          alyaJson.data.fileName ||
          `${title}.${isAudio ? "mp3" : "mp4"}`
      }

      usedApi = "alyacore"
    }

    /*
     * API DE RESPALDO: LEMPI
     */

    if (!data?.link) {

      const lempiUrl = isAudio
        ? `https://api.lempi.lat/dl/yta?url=${encodeURIComponent(url)}&apikey=lem_653af68318d77de0ef137af194cf241880ce58a3`
        : `https://api.lempi.lat/dl/ytv?url=${encodeURIComponent(url)}&apikey=lem_653af68318d77de0ef137af194cf241880ce58a3`

      const lempiRes = await safeFetch(lempiUrl)
      const lempiJson = await safeJson(lempiRes)

      if (
        lempiJson?.status &&
        lempiJson?.datos?.url
      ) {

        const d = lempiJson.datos

        data = {
          link: d.url,

          title:
            lempiJson.titulo ||
            title,

          author:
            lempiJson.canal ||
            author?.name ||
            "Desconocido",

          duration:
            lempiJson.duracion ||
            duration,

          thumbnail:
            lempiJson.miniatura ||
            thumbnail,

          format:
            d.extension ||
            (isAudio ? "mp3" : "mp4"),

          quality:
            d.calidad ||
            "Automática",

          fileName:
            d.archivo ||
            `${title}.${isAudio ? "mp3" : "mp4"}`
        }

        usedApi = "lempi"
      }
    }

    if (!data?.link) {
      await m.react("✖️")

      return m.reply(
        `${e} No se pudo obtener enlace desde ninguna API (todas fallaron).`
      )
    }

    const fileName =
      data.fileName ||
      `${data.title || title}.${isAudio ? "mp3" : "mp4"}`

    const mimetype =
      isAudio
        ? "audio/mpeg"
        : "video/mp4"

    /*
     * ENVÍO DEL ARCHIVO
     */

    const msgMedia = sendDoc
      ? {
          document: {
            url: data.link
          },
          mimetype,
          fileName,
          jpegThumbnail: thumb || undefined
        }
      : isAudio
      ? {
          audio: {
            url: data.link
          },
          mimetype,
          fileName,
          ptt: false
        }
      : {
          video: {
            url: data.link
          },
          mimetype,
          fileName
        }

    await conn.sendMessage(
      m.chat,
      msgMedia,
      {
        quoted: m
      }
    )

    await m.react("✨")

  } catch (error) {

    console.error(
      "❌ Error YouTube:",
      error
    )

    await m.react("✖️")

    return m.reply(
      `${e} No se pudo procesar la descarga, intenta de nuevo.`
    )
  }
}

handler.command = [
  'play',
  'yta',
  'mp3',
  'ytmp3',
  'playaudio',

  'play3',
  'ytadoc',
  'mp3doc',
  'ytmp3doc',

  'play2',
  'ytv',
  'mp4',
  'ytmp4',
  'playvid',

  'play4',
  'ytvdoc',
  'mp4doc',
  'ytmp4doc'
]

handler.group = true

export default handler
