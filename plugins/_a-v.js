import fetch from "node-fetch"
import yts from "yt-search"
import sharp from "sharp"
import { PassThrough } from "stream"
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

const crearStream = (url, formato) => {
  const source = ytDlp.execStream([
    url,
    "--no-playlist",
    "--no-cache-dir",
    "--no-part",
    "--cookies",
    "/home/container/cookies.txt",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    "--no-warnings",
    "--quiet",
    "-f",
    formato,
    "-o",
    "-"
  ])

  const pass = new PassThrough()

  let bytes = 0
  let terminado = false

  source.on("data", chunk => {
    bytes += chunk.length
  })

  source.on("error", error => {
    if (
      error?.code === "ERR_STREAM_PREMATURE_CLOSE" &&
      bytes > 0
    ) {
      if (!terminado) {
        terminado = true
        try {
          pass.end()
        } catch {}
      }
      return
    }

    if (!terminado) {
      terminado = true

      try {
        pass.destroy(error)
      } catch {}
    }
  })

  source.on("end", () => {
    if (!terminado) {
      terminado = true

      try {
        pass.end()
      } catch {}
    }
  })

  source.on("close", () => {
    if (!terminado && bytes > 0) {
      terminado = true

      try {
        pass.end()
      } catch {}
    }
  })

  source.pipe(pass)

  pass.on("error", () => {})

  pass._ytDlpSource = source
  pass._ytDlpBytes = () => bytes

  return pass
}

const crearMedia = (url, formato) => {
  return {
    stream: crearStream(url, formato),
    replay: () => crearStream(url, formato)
  }
}

const handler = async (m, { conn, text, command, args }) => {

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

    const seconds = toSeconds(duration)
    const mins = seconds / 60

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
      {
        messageId: msg.key.id
      }
    )

    if (isAudio) {

      const media = crearMedia(
        url,
        "bestaudio[ext=m4a]"
      )

      const contenido = {
        ...media,
        mimetype: "audio/mp4",
        fileName: `${title}.m4a`,
        seconds
      }

      if (sendDoc) {
        await conn.sendMessage(
          m.chat,
          {
            document: contenido,
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
            audio: contenido,
            mimetype: "audio/mp4",
            fileName: `${title}.m4a`
          },
          {
            quoted: m
          }
        )
      }

    } else {

      const media = crearMedia(
        url,
        "best[ext=mp4][height<=720]/best[height<=720]"
      )

      const contenido = {
        ...media,
        mimetype: "video/mp4"
      }

      if (thumb) {
        contenido.jpegThumbnail = thumb
      }

      if (sendDoc) {
        await conn.sendMessage(
          m.chat,
          {
            document: contenido,
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
            video: contenido
          },
          {
            quoted: m
          }
        )
      }
    }

    await m.react("✅")

  } catch (error) {

    console.error("❌ Error YouTube:", error)

    await m.react("✖️")

    const err = String(
      error?.stack ||
      error?.message ||
      error ||
      ""
    )

    if (
      err.includes("No space left on device") ||
      err.includes("ENOSPC")
    ) {
      return m.reply(
        `${e} El sistema se quedó sin espacio temporal durante el envío.`
      )
    }

    if (
      err.includes("Sign in to confirm") ||
      err.includes("not a bot") ||
      err.includes("cookies")
    ) {
      return m.reply(
        `${e} YouTube rechazó la solicitud. Las cookies necesitan actualizarse.`
      )
    }

    if (
      err.includes("Requested format is not available")
    ) {
      return m.reply(
        `${e} YouTube no proporcionó un formato compatible para este contenido.`
      )
    }

    return m.reply(
      `${e} No se pudo procesar la descarga, intenta de nuevo.\n\n> ${err.slice(0, 500)}`
    )

  } finally {
    descargaActiva = false
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
  "ytvdoc",
  "ytmp4doc"
]

handler.group = true

export default handler
