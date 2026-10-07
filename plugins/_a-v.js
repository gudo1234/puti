import fetch from 'node-fetch'
import yts from 'yt-search'
import sharp from 'sharp'
import { PassThrough } from 'stream'
import path from 'path'
import fs from 'fs'

const mod = await import('yt-dlp-wrap-plus')
const YTDlpWrap = mod.default?.default || mod.default || mod

const YTDLP_PATH = path.resolve('./yt-dlp')
const ytDlp = new YTDlpWrap(YTDLP_PATH)

if (!fs.existsSync(YTDLP_PATH)) {
  await ytDlp.downloadFromGithub(YTDLP_PATH)
}

try {
  await fs.promises.chmod(YTDLP_PATH, 0o755)
} catch {}

const crearStream = (url, formato) => {
  const source = ytDlp.execStream([
    url,
    '--no-playlist',
    '--no-cache-dir',
    '--no-part',
    '--cookies',
    '/home/container/cookies.txt',
    '--js-runtimes',
    'node',
    '--remote-components',
    'ejs:github',
    '--no-warnings',
    '--quiet',
    '-f',
    formato,
    '-o',
    '-'
  ])

  const pass = new PassThrough()
  let bytes = 0
  let sourceError = null
  let terminado = false

  source.on('data', chunk => {
    bytes += chunk.length
  })

  source.on('error', error => {
    sourceError = error

    if (error?.code === 'ERR_STREAM_PREMATURE_CLOSE' && bytes > 0) {
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

  source.on('end', () => {
    if (!terminado) {
      terminado = true
      try {
        pass.end()
      } catch {}
    }
  })

  source.on('close', () => {
    if (!terminado && bytes > 0) {
      terminado = true
      try {
        pass.end()
      } catch {}
    }
  })

  source.pipe(pass)

  pass.on('error', () => {})

  pass._ytDlpSource = source
  pass._ytDlpError = () => sourceError
  pass._ytDlpBytes = () => bytes

  return pass
}

const crearMedia = (url, formato) => {
  return {
    stream: crearStream(url, formato),
    replay: () => crearStream(url, formato)
  }
}

const descargarThumb = async url => {
  try {
    const r = await fetch(url)

    if (!r.ok) return null

    const buffer = Buffer.from(await r.arrayBuffer())

    return await sharp(buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer()
  } catch {
    return null
  }
}

const obtenerInfo = async url => {
  const y = await yts(url)

  if (!y?.videos?.length) {
    throw new Error('No se encontró información del vídeo.')
  }

  return y.videos[0]
}

const esUrl = texto => {
  try {
    new URL(texto)
    return true
  } catch {
    return false
  }
}

const limpiarNombre = texto => {
  return String(texto || 'YouTube')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

const segundos = timestamp => {
  if (!timestamp) return 0

  const partes = String(timestamp)
    .split(':')
    .map(Number)

  if (partes.some(Number.isNaN)) return 0

  if (partes.length === 3) {
    return partes[0] * 3600 + partes[1] * 60 + partes[2]
  }

  if (partes.length === 2) {
    return partes[0] * 60 + partes[1]
  }

  return partes[0] || 0
}

const formatoDuracion = timestamp => {
  if (!timestamp) return '00:00'
  return String(timestamp)
}

let descargaActiva = false

let handler = async (m, { conn, usedPrefix, command, text }) => {
  if (!text) {
    return m.reply(
      `🌙 *Uso correcto:*\n\n` +
      `${usedPrefix + command} <nombre o enlace de YouTube>`
    )
  }

  if (descargaActiva) {
    return m.reply(
      '⏳ Ya hay una descarga de YouTube en proceso. Espera a que termine.'
    )
  }

  descargaActiva = true

  try {
    const esAudio = [
      'play',
      'yta',
      'mp3',
      'ytmp3',
      'playaudio',
      'play3',
      'ytadoc',
      'mp3doc',
      'ytmp3doc'
    ].includes(command)

    const esDocumento = [
      'play3',
      'ytadoc',
      'mp3doc',
      'ytmp3doc',
      'play4',
      'ytvdoc',
      'mp4doc',
      'ytmp4doc'
    ].includes(command)

    const esVideo = [
      'play2',
      'ytv',
      'mp4',
      'ytmp4',
      'playvid',
      'play4',
      'ytvdoc',
      'mp4doc',
      'ytmp4doc'
    ].includes(command)

    let url = text.trim()
    let info

    if (esUrl(url)) {
      info = await obtenerInfo(url)
    } else {
      const resultado = await yts(text)

      if (!resultado?.videos?.length) {
        throw new Error('No se encontraron resultados.')
      }

      info = resultado.videos[0]
      url = info.url
    }

    const title = limpiarNombre(info.title)
    const thumbnail = info.thumbnail
    const duration = formatoDuracion(info.timestamp)
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
                  title,
                  body: `${author} • ${views} vistas`,
                  mediaType: 1,
                  thumbnail: thumb,
                  sourceUrl: link
                }
              }
            }
          },
          { messageId: m.key.id }
        )
      } catch {}
    }

    const duracionSegundos = segundos(info.timestamp)
    const esLargo = duracionSegundos > 1200
    const comoDocumento = esDocumento || esLargo

    if (esAudio) {
      const media = crearMedia(
        url,
        'bestaudio[ext=m4a]/bestaudio'
      )

      if (comoDocumento) {
        await conn.sendMessage(
          m.chat,
          {
            document: media,
            mimetype: 'audio/mp4',
            fileName: `${title}.m4a`,
            caption:
              `🎵 *${title}*\n\n` +
              `👤 ${author}\n` +
              `⏱️ ${duration}\n` +
              `👁️ ${views} vistas\n` +
              `🔗 ${link}`
          },
          { quoted: m }
        )
      } else {
        await conn.sendMessage(
          m.chat,
          {
            audio: media,
            mimetype: 'audio/mp4',
            fileName: `${title}.m4a`,
            ptt: false
          },
          { quoted: m }
        )
      }
    } else if (esVideo) {
      const media = crearMedia(
        url,
        'best[ext=mp4][height<=720]/best[height<=720]/best'
      )

      if (comoDocumento) {
        await conn.sendMessage(
          m.chat,
          {
            document: media,
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption:
              `🎬 *${title}*\n\n` +
              `👤 ${author}\n` +
              `⏱️ ${duration}\n` +
              `👁️ ${views} vistas\n` +
              `🔗 ${link}`
          },
          { quoted: m }
        )
      } else {
        await conn.sendMessage(
          m.chat,
          {
            video: media,
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption:
              `🎬 *${title}*\n\n` +
              `👤 ${author}\n` +
              `⏱️ ${duration}\n` +
              `👁️ ${views} vistas\n` +
              `🔗 ${link}`
          },
          { quoted: m }
        )
      }
    } else {
      throw new Error('No se pudo determinar el tipo de contenido.')
    }
  } catch (e) {
    let error = String(e?.message || e)

    if (
      error.includes('spawn') &&
      error.includes('ENOENT')
    ) {
      error =
        `No se encontró el ejecutable de yt-dlp.\n\n` +
        `Ruta esperada:\n${YTDLP_PATH}`
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
  'play4 <texto o enlace>',
  'ytvdoc <texto o enlace>'
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
