import fetch from 'node-fetch'
import yts from 'yt-search'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const mod = await import('yt-dlp-wrap-plus')
const YTDlpWrap = mod.default?.default || mod.default || mod

const YTDLP_PATH = path.resolve('./yt-dlp')
const COOKIES_PATH = '/home/container/cookies.txt'

const ytDlp = new YTDlpWrap(YTDLP_PATH)

const prepararYtDlp = async () => {
  if (!fs.existsSync(YTDLP_PATH)) {
    await ytDlp.downloadFromGithub(YTDLP_PATH)
  }

  try {
    await fs.promises.chmod(YTDLP_PATH, 0o755)
  } catch {}

  return ytDlp
}

const crearArchivoTemporal = extension => {
  return path.join(
    '/tmp',
    `yt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${extension}`
  )
}

const descargarArchivo = async (url, formato, extension) => {
  const ytdlp = await prepararYtDlp()
  const archivo = crearArchivoTemporal(extension)

  try {
    await ytdlp.exec([
      url,
      '--no-playlist',
      '--no-cache-dir',
      '--no-part',
      '--no-overwrites',
      '--cookies',
      COOKIES_PATH,
      '--js-runtimes',
      'node',
      '--remote-components',
      'ejs:github',
      '--no-warnings',
      '--quiet',
      '-f',
      formato,
      '-o',
      archivo
    ])

    if (!fs.existsSync(archivo)) {
      throw new Error('yt-dlp terminó pero no creó el archivo.')
    }

    const stat = await fs.promises.stat(archivo)

    if (!stat.size) {
      throw new Error('yt-dlp creó un archivo vacío.')
    }

    return archivo
  } catch (e) {
    try {
      if (fs.existsSync(archivo)) {
        await fs.promises.unlink(archivo)
      }
    } catch {}

    throw e
  }
}

const descargarThumb = async url => {
  try {
    const r = await fetch(url)

    if (!r.ok) return null

    const buffer = Buffer.from(await r.arrayBuffer())

    return await sharp(buffer)
      .resize(300, 300, {
        fit: 'cover'
      })
      .jpeg({
        quality: 80
      })
      .toBuffer()
  } catch {
    return null
  }
}

const esUrl = texto => {
  try {
    new URL(texto)
    return true
  } catch {
    return false
  }
}

const segundos = timestamp => {
  if (!timestamp) return 0

  const partes = String(timestamp)
    .split(':')
    .map(Number)

  if (partes.some(Number.isNaN)) return 0

  if (partes.length === 3) {
    return partes[0] * 3600 +
      partes[1] * 60 +
      partes[2]
  }

  if (partes.length === 2) {
    return partes[0] * 60 +
      partes[1]
  }

  return partes[0] || 0
}

const limpiarNombre = texto => {
  return String(texto || 'YouTube')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

const obtenerInfo = async url => {
  const resultado = await yts(url)

  if (!resultado?.videos?.length) {
    throw new Error('No se encontró información del vídeo.')
  }

  return resultado.videos[0]
}

let descargaActiva = false

let handler = async (m, {
  conn,
  usedPrefix,
  command,
  text
}) => {
  if (!text) {
    return m.reply(
      `🌙 *Uso correcto:*\n\n` +
      `${usedPrefix + command} <nombre o enlace>`
    )
  }

  if (descargaActiva) {
    return m.reply(
      '⏳ Ya hay una descarga de YouTube en proceso. Espera a que termine.'
    )
  }

  descargaActiva = true

  let archivo = null

  try {
    const comandosAudio = [
      'play',
      'yta',
      'mp3',
      'ytmp3',
      'playaudio',
      'play3',
      'ytadoc',
      'mp3doc',
      'ytmp3doc'
    ]

    const comandosVideo = [
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

    const comandosDocumento = [
      'play3',
      'ytadoc',
      'mp3doc',
      'ytmp3doc',
      'play4',
      'ytvdoc',
      'mp4doc',
      'ytmp4doc'
    ]

    const esAudio = comandosAudio.includes(command)
    const esVideo = comandosVideo.includes(command)
    const esDocumento = comandosDocumento.includes(command)

    if (!esAudio && !esVideo) {
      throw new Error('Comando de YouTube no reconocido.')
    }

    let url = text.trim()
    let info

    if (esUrl(url)) {
      info = await obtenerInfo(url)
    } else {
      const resultado = await yts(text)

      if (!resultado?.videos?.length) {
        throw new Error('No se encontraron resultados para la búsqueda.')
      }

      info = resultado.videos[0]
      url = info.url
    }

    const title = limpiarNombre(info.title)
    const thumbnail = info.thumbnail
    const duration = info.timestamp || '00:00'
    const views = Number(info.views || 0).toLocaleString()
    const author = info.author?.name || 'YouTube'
    const published = info.ago || 'Desconocido'
    const link = info.url || url

    const thumb = thumbnail
      ? await descargarThumb(thumbnail)
      : null

    if (thumb) {
      try {
        await conn.relayMessage(
          m.chat,
          {
            locationMessage: {
              degreesLatitude: 0,
              degreesLongitude: 0,
              name: title,
              address: `${author} • ${duration}`,
              jpegThumbnail: thumb,
              contextInfo: {
                externalAdReply: {
                  title: title,
                  body: `${author} • ${views} vistas`,
                  mediaType: 1,
                  thumbnail: thumb,
                  sourceUrl: link
                }
              }
            }
          },
          {
            messageId: m.key.id
          }
        )
      } catch {}
    }

    const duracion = segundos(info.timestamp)
    const esLargo = duracion > 1200
    const enviarComoDocumento = esDocumento || esLargo

    if (esAudio) {
      archivo = await descargarArchivo(
        url,
        'bestaudio[ext=m4a]/bestaudio',
        'm4a'
      )

      const caption =
        `🎵 *${title}*\n\n` +
        `👤 ${author}\n` +
        `⏱️ ${duration}\n` +
        `👁️ ${views} vistas\n` +
        `📅 ${published}\n` +
        `🔗 ${link}`

      if (enviarComoDocumento) {
        await conn.sendMessage(
          m.chat,
          {
            document: {
              url: archivo
            },
            mimetype: 'audio/mp4',
            fileName: `${title}.m4a`,
            caption
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
              url: archivo
            },
            mimetype: 'audio/mp4',
            fileName: `${title}.m4a`
          },
          {
            quoted: m
          }
        )
      }
    }

    if (esVideo) {
      archivo = await descargarArchivo(
        url,
        'best[ext=mp4][height<=720]/best[height<=720]/best',
        'mp4'
      )

      const caption =
        `🎬 *${title}*\n\n` +
        `👤 ${author}\n` +
        `⏱️ ${duration}\n` +
        `👁️ ${views} vistas\n` +
        `📅 ${published}\n` +
        `🔗 ${link}`

      if (enviarComoDocumento) {
        await conn.sendMessage(
          m.chat,
          {
            document: {
              url: archivo
            },
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption
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
              url: archivo
            },
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption
          },
          {
            quoted: m
          }
        )
      }
    }

    try {
      if (archivo && fs.existsSync(archivo)) {
        await fs.promises.unlink(archivo)
        archivo = null
      }
    } catch {}

  } catch (e) {
    try {
      if (archivo && fs.existsSync(archivo)) {
        await fs.promises.unlink(archivo)
      }
    } catch {}

    let error = String(e?.message || e)

    if (
      error.includes('spawn') &&
      error.includes('ENOENT')
    ) {
      error =
        `No se encontró yt-dlp.\n` +
        `Ruta: ${YTDLP_PATH}`
    }

    if (
      error.includes('ENOSPC') ||
      error.toLowerCase().includes('no space left')
    ) {
      error =
        'El sistema se quedó sin espacio temporal durante el envío.'
    }

    return m.reply(
      `🌙 *No se pudo procesar la descarga, intenta de nuevo.*\n\n` +
      `> Error: ${error}`
    )
  } finally {
    try {
      if (archivo && fs.existsSync(archivo)) {
        await fs.promises.unlink(archivo)
      }
    } catch {}

    descargaActiva = false
  }
}

handler.help = [
  'play <texto o enlace>',
  'yta <texto o enlace>',
  'mp3 <texto o enlace>',
  'ytmp3 <texto o enlace>',
  'play2 <texto o enlace>',
  'ytv <texto o enlace>',
  'mp4 <texto o enlace>',
  'ytmp4 <texto o enlace>',
  'play3 <texto o enlace>',
  'ytadoc <texto o enlace>',
  'mp3doc <texto o enlace>',
  'ytmp3doc <texto o enlace>',
  'play4 <texto o enlace>',
  'ytvdoc <texto o enlace>',
  'mp4doc <texto o enlace>',
  'ytmp4doc <texto o enlace>'
]

handler.tags = ['downloader']

handler.command = [
  'play',
  'yta',
  'mp3',
  'ytmp3',
  'playaudio',
  'play2',
  'ytv',
  'mp4',
  'ytmp4',
  'playvid',
  'play3',
  'ytadoc',
  'mp3doc',
  'ytmp3doc',
  'play4',
  'ytvdoc',
  'mp4doc',
  'ytmp4doc'
]

export default handler
