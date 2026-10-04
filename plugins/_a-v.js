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

const cleanFileName = name => {
return String(name || "youtube")
.replace(/[<>:"/\|?*\x00-\x1F]/g, "")
.replace(/\s+/g, " ")
.trim()
.slice(0, 180)
}

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

await m.react("🕒")

let tmp = null

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
  {
    locationMessage
  },
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

const mod = await import("yt-dlp-wrap-plus")
const YTDlpWrap = mod.default?.default || mod.default || mod

const fs = await import("fs")

const bin = "./yt-dlp"
const cookies = "/home/container/cookies.txt"

if (!fs.existsSync(bin)) {
  await YTDlpWrap.downloadFromGithub(bin)
  fs.chmodSync(bin, 0o755)
}

if (!fs.existsSync(cookies)) {
  await m.react("✖️")
  return m.reply(
    `${e} No se encontró el archivo *cookies.txt* en el servidor.`
  )
}

const extension = isAudio ? "mp3" : "mp4"

const fileName =
  `${cleanFileName(title)}.${extension}`

tmp = `/tmp/yt-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

const ytDlp = new YTDlpWrap(bin)

const format = isAudio
  ? "bestaudio/best"
  : "best[ext=mp4]/best"

const options = [
  url,

  "--no-playlist",

  "--cookies",
  cookies,

  "--js-runtimes",
  "node",

  "--remote-components",
  "ejs:github",

  "-f",
  format,

  "--no-warnings",

  "--newline",

  "-o",
  tmp
]

if (isAudio) {
  options.push(
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0"
  )
} else {
  options.push(
    "--merge-output-format",
    "mp4"
  )
}

await ytDlp.execPromise(options)

if (!fs.existsSync(tmp)) {
  throw new Error(
    "yt-dlp terminó pero no generó el archivo descargado."
  )
}

const buffer = fs.readFileSync(tmp)

if (!buffer?.length) {
  throw new Error(
    "El archivo descargado está vacío."
  )
}

const mimetype = isAudio
  ? "audio/mpeg"
  : "video/mp4"

const msgMedia = sendDoc
  ? {
      document: buffer,
      mimetype,
      fileName,
      jpegThumbnail: thumb || undefined
    }
  : isAudio
  ? {
      audio: buffer,
      mimetype,
      fileName,
      ptt: false
    }
  : {
      video: buffer,
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

try {
  fs.unlinkSync(tmp)
} catch {}

tmp = null

await m.react("✨")

} catch (error) {

if (tmp) {
  try {
    const fs = await import("fs")

    if (fs.existsSync(tmp)) {
      fs.unlinkSync(tmp)
    }
  } catch {}
}

console.error(
  "❌ Error YouTube:",
  error
)

await m.react("✖️")

const detalle =
  error?.stderr ||
  error?.message ||
  String(error)

return m.reply(
  `${e} No se pudo procesar la descarga.\n\n> ${detalle}`
)

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
