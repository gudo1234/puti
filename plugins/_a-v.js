import fetch from "node-fetch"
import yts from "yt-search"
import sharp from "sharp"
import { generateWAMessageFromContent } from "@whiskeysockets/baileys"

const mod = await import("yt-dlp-wrap-plus")
const YTDlpWrap = mod.default?.default || mod.default || mod

const ytDlp = new YTDlpWrap("./yt-dlp")

let descargaActiva = false

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

const crearStream = (url, args) => {
  const stream = ytDlp.execStream([
    url,
    "--no-playlist",
    "--no-cache-dir",
    "--no-part",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    "--cookies",
    "/home/container/cookies.txt",
    "-o",
    "-",
    ...args
  ])

  return stream
}

const esperarStream = stream =>
  new Promise((resolve, reject) => {
    let error = null

    stream.once("error", err => {
      error = err
    })

    stream.once("end", () => {
      if (error) reject(error)
      else resolve()
    })

    stream.once("close", () => {
      if (error) reject(error)
      else resolve()
    })
  })

const handler = async (m, { conn, text, usedPrefix, command, args }) => {

  const docAudio = [
    "play3",
    "ytadoc",
    "mp3doc",
    "ytmp3doc"
  ]

  const docVideo = [
    "play4",
    "ytvdoc",
    "mp4doc",
    "ytmp4doc"
  ]

  const normalAudio = [
    "play",
    "yta",
    "mp3",
    "ytmp3",
    "playaudio"
  ]

  const normalVideo = [
    "play2",
    "ytv",
    "mp4",
    "ytmp4",
    "playvid"
  ]

  if (!text) {
    const tipo = normalAudio.includes(command)
      ? "audio"
      : docAudio.includes(command)
      ? "audio en documento"
      : normalVideo.includes(command)
      ? "video"
      : "video en documento"

    return m.reply(
      `${e} Ingresa _texto_ o _enlace_ de YouTube para descargar el *${tipo}.*`
    )
  }

  if (descargaActiva) {
    return m.reply(
      `${e} Ya hay una descarga en curso.\n\n> Espera a que termine antes de iniciar otra.`
    )
  }

  descargaActiva = true

  await m.react("🕒")

  let stream = null

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

    const canal = author?.name || "Desconocido"

    const vistas =
      views != null
        ? Number(views).toLocaleString()
        : "Desconocidas"

    const publicado = ago || "Desconocido"

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

    const locationMessage = {
      degreesLatitude: 0,
      degreesLongitude: 0,
      name: `🎧 ${title}`,
      address:
        `👤 Canal: ${canal}\n` +
        `⏱️ Duración: ${duration}\n` +
        `👁️ Vistas: ${vistas}\n` +
        `📅 Publicado: ${publicado}`,
      url: "https://whatsapp.com/channel/0029VaXHNMZL7UVTeseuqw3H",
      comment:
        `╭──── • ────╮\n` +
        `> ✰ *Título:* ${title}\n` +
        `> ♢ *Canal:* ${canal}\n` +
        `> ♪ *Duración:* ${duration}\n` +
        `> ♫ *Vistas:* ${vistas}\n` +
        `> ♪ *Publicado:* ${publicado}\n` +
        `> ♬ *Link:* ${url}\n` +
        `╰──── • ────╯\n\n` +
        `⏳ _Preparando ${type}..._${aviso}`
    }

    if (thumb) {
      locationMessage.jpegThumbnail = thumb
    }

    const msg = generateWAMessageFromContent(
      m.chat,
      { locationMessage },
      {
        userJid: conn.user.id,
        quoted: m
      }
    )

    await conn.relayMessage(
      m.chat,
      msg.message,
      { messageId: msg.key.id }
    )

    let ytArgs = []

    if (isAudio) {

      ytArgs = [
        "-f",
        "bestaudio[ext=m4a]/bestaudio[ext=webm]",
        "--no-warnings",
        "--quiet"
      ]

      stream = crearStream(url, ytArgs)

      if (sendDoc) {

        await conn.sendMessage(
          m.chat,
          {
            document: {
              stream
            },
            mimetype: "audio/mp4",
            fileName: `${title}.m4a`
          },
          {
            quoted: m
          }
        )

      } else {

        await conn.sendMessage(
          m.chat,
          {
            audio: {
              stream
            },
            mimetype: "audio/mp4"
          },
          {
            quoted: m
          }
        )
      }

    } else {

      ytArgs = [
        "-f",
        "best[ext=mp4][height<=720]/best[height<=720]",
        "--no-warnings",
        "--quiet"
      ]

      stream = crearStream(url, ytArgs)

      if (sendDoc) {

        await conn.sendMessage(
          m.chat,
          {
            document: {
              stream
            },
            mimetype: "video/mp4",
            fileName: `${title}.mp4`
          },
          {
            quoted: m
          }
        )

      } else {

        await conn.sendMessage(
          m.chat,
          {
            video: {
              stream
            },
            mimetype: "video/mp4"
          },
          {
            quoted: m
          }
        )
      }
    }

    await m.react("✅")

  } catch (error) {

    console.error("❌ Error YouTube streaming:", error)

    try {
      if (stream && typeof stream.destroy === "function") {
        stream.destroy()
      }
    } catch {}

    await m.react("✖️")

    const mensaje = String(error?.message || error || "")

    if (
      mensaje.includes("No space left on device") ||
      mensaje.includes("ENOSPC")
    ) {
      return m.reply(
        `${e} La descarga fue detenida porque el sistema no tiene espacio temporal disponible.`
      )
    }

    if (
      mensaje.includes("Sign in to confirm") ||
      mensaje.includes("not a bot") ||
      mensaje.includes("cookies")
    ) {
      return m.reply(
        `${e} YouTube rechazó la solicitud. Revisa que el archivo de cookies siga siendo válido.`
      )
    }

    return m.reply(
      `${e} No se pudo procesar la descarga, intenta de nuevo.`
    )

  } finally {

    descargaActiva = false

    try {
      if (stream && typeof stream.destroy === "function") {
        stream.destroy()
      }
    } catch {}
  }
}

handler.help = [
  "play",
  "play2",
  "play3",
  "play4"
]

handler.tags = [
  "descargas"
]

handler.command = [
  "play",
  "yta",
  "mp3",
  "ytmp3",
  "playaudio",

  "play3",
  "ytadoc",
  "mp3doc",
  "ytmp3doc",

  "play2",
  "ytv",
  "mp4",
  "ytmp4",
  "playvid",

  "play4",
  "ytvdoc",
  "mp4doc",
  "ytmp4doc"
]

handler.group = true

export default handler
