
import fetch from 'node-fetch'
import yts from 'yt-search'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { generateWAMessageFromContent } from '@whiskeysockets/baileys'

const execFileAsync = promisify(execFile)

const mod = await import('yt-dlp-wrap-plus')
const YTDlpWrap =
  mod.default?.default ||
  mod.default ||
  mod.YTDlpWrap

const YTDLP_PATH = path.resolve('./yt-dlp')
const COOKIES_PATH = '/home/container/cookies.txt'
const DOWNLOAD_DIR = path.resolve('./descargas-yt')
const TEMP_DIR = path.join(DOWNLOAD_DIR, '.yt-dlp-tmp')
const MAX_INTENTOS = 3

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
fs.mkdirSync(TEMP_DIR, { recursive: true })

process.env.TMPDIR = TEMP_DIR
process.env.TMP = TEMP_DIR
process.env.TEMP = TEMP_DIR

try {
  fs.chmodSync(TEMP_DIR, 0o700)
} catch {}

if (!YTDlpWrap) {
  throw new Error('No se pudo cargar yt-dlp-wrap-plus.')
}

if (!fs.existsSync(YTDLP_PATH)) {
  await YTDlpWrap.downloadFromGithub(YTDLP_PATH)
}

try {
  await fs.promises.chmod(YTDLP_PATH, 0o755)
} catch {}

let ytDlp = new YTDlpWrap(YTDLP_PATH)
let descargaActiva = false

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms))

const crearArchivoTemporal = () => {
  return path.join(
    DOWNLOAD_DIR,
    `yt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.%(ext)s`
  )
}

const limpiarArchivos = async id => {
  const archivos = await fs.promises.readdir(DOWNLOAD_DIR).catch(() => [])

  for (const nombre of archivos) {
    if (nombre.startsWith(`${id}.`) || nombre.startsWith(`${id}_`)) {
      await fs.promises.unlink(
        path.join(DOWNLOAD_DIR, nombre)
      ).catch(() => {})
    }
  }
}

const descargarArchivo = async (url, tipo) => {
  let ultimoError

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const salida = crearArchivoTemporal()
    const id = path.basename(salida).split('.')[0]

    const argumentos = [
      url,
      '--no-playlist',
      '--no-cache-dir',
      '--no-part',
      '--no-overwrites',
      '--no-mtime',
      '--no-warnings',
      '--retries', '5',
      '--fragment-retries', '5',
      '--extractor-retries', '3',
      '--file-access-retries', '3',
      '--retry-sleep', '2',
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
      '--output', salida,
      '--paths', `temp:${TEMP_DIR}`
    ]

    if (fs.existsSync(COOKIES_PATH)) {
      argumentos.push('--cookies', COOKIES_PATH)
    }

    if (tipo === 'audio') {
      argumentos.push(
        '-f',
        'bestaudio[ext=m4a]/bestaudio',
        '--extract-audio',
        '--audio-format', 'm4a',
        '--audio-quality', '0'
      )
    } else {
      argumentos.push(
        '-f',
        'best[ext=mp4][height<=720]/best[height<=720]/best',
        '--merge-output-format', 'mp4'
      )
    }

    try {
      fs.mkdirSync(TEMP_DIR, { recursive: true })

      // Recrear el wrapper en caso de que una ejecución previa haya fallado.
      if (!fs.existsSync(YTDLP_PATH)) {
        await YTDlpWrap.downloadFromGithub(YTDLP_PATH)
        await fs.promises.chmod(YTDLP_PATH, 0o755).catch(() => {})
        ytDlp = new YTDlpWrap(YTDLP_PATH)
      }

      await ytDlp.execPromise(argumentos)

      const archivos = await fs.promises.readdir(DOWNLOAD_DIR)

      const encontrados = archivos
        .filter(nombre => nombre.startsWith(`${id}.`))
        .map(nombre => path.join(DOWNLOAD_DIR, nombre))
        .filter(archivo => {
          try {
            return fs.statSync(archivo).isFile() &&
              fs.statSync(archivo).size > 0 &&
              !/\.(part|ytdl|json|description|jpg|jpeg|png|webp)$/i.test(archivo)
          } catch {
            return false
          }
        })

      if (!encontrados.length) {
        throw new Error('yt-dlp no generó ningún archivo válido.')
      }

      encontrados.sort((a, b) => {
        return fs.statSync(b).size - fs.statSync(a).size
      })

      const archivo = encontrados[0]
      const stat = await fs.promises.stat(archivo)

      return {
        archivo,
        extension: path.extname(archivo).slice(1) ||
          (tipo === 'audio' ? 'm4a' : 'mp4'),
        size: stat.size
      }
    } catch (error) {
      ultimoError = error
      await limpiarArchivos(id)

      const mensaje = String(error?.message || error)

      // Si el ejecutable está ausente, intentar reinstalarlo una vez.
      if (
        intento < MAX_INTENTOS &&
        (
          mensaje.includes('PYI-70') ||
          mensaje.includes('Failed to extract') ||
          mensaje.includes('Permission denied')
        )
      ) {
        try {
          await fs.promises.unlink(YTDLP_PATH).catch(() => {})
          await YTDlpWrap.downloadFromGithub(YTDLP_PATH)
          await fs.promises.chmod(YTDLP_PATH, 0o755)
          ytDlp = new YTDlpWrap(YTDLP_PATH)
        } catch {}
      }

      if (intento < MAX_INTENTOS) {
        await esperar(intento * 2000)
      }
    }
  }

  throw new Error(
    `Falló la descarga después de ${MAX_INTENTOS} intentos. ${
      String(ultimoError?.message || ultimoError || 'Error desconocido').slice(0, 900)
    }`
  )
}

const obtenerMiniatura = async url => {
  try {
    const res = await fetch(url, { timeout: 15000 })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())

    return await sharp(buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer()
  } catch {
    return null
  }
}

const limpiarNombre = nombre => {
  return String(nombre || 'youtube')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'youtube'
}

const obtenerVideo = async texto => {
  const esUrl = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(texto)

  if (esUrl) {
    const id = texto.match(
      /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([^&?/]+)/
    )?.[1]

    if (id) {
      const resultado = await yts({ videoId: id }).catch(() => null)

      if (resultado?.title) {
        return resultado
      }
    }

    const busqueda = await yts(texto)

    if (busqueda?.videos?.[0]) {
      return busqueda.videos[0]
    }

    throw new Error('No se encontró información del video.')
  }

  const busqueda = await yts(texto)

  if (!busqueda?.videos?.length) {
    throw new Error('No se encontraron resultados.')
  }

  return busqueda.videos[0]
}

const formatearVistas = vistas => {
  if (vistas == null) return 'N/A'

  try {
    return Number(vistas).toLocaleString('es-ES')
  } catch {
    return String(vistas)
  }
}

const formatearDuracion = duracion => {
  if (!duracion) return 'N/A'
  if (typeof duracion === 'string') return duracion

  const segundos = Number(duracion)

  if (!Number.isFinite(segundos)) return 'N/A'

  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const secs = Math.floor(segundos % 60)

  return horas > 0
    ? `${horas}:${String(minutos).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutos}:${String(secs).padStart(2, '0')}`
}

const obtenerSegundos = video => {
  if (typeof video.seconds === 'number' && video.seconds > 0) {
    return video.seconds
  }

  if (typeof video.duration === 'number' && video.duration > 0) {
    return video.duration
  }

  const duracion = video.timestamp || video.duration

  if (typeof duracion !== 'string') return 0

  const partes = duracion.split(':').map(Number)

  if (partes.some(Number.isNaN)) return 0

  if (partes.length === 3) {
    return partes[0] * 3600 + partes[1] * 60 + partes[2]
  }

  if (partes.length === 2) {
    return partes[0] * 60 + partes[1]
  }

  return Number(partes[0]) || 0
}

const enviarInformacion = async (m, conn, video, thumb) => {
  const title = video.title || 'YouTube'
  const duration = video.timestamp || formatearDuracion(obtenerSegundos(video))
  const views = formatearVistas(video.views)
  const ago = video.ago || 'N/A'
  const author = video.author?.name || 'YouTube'
  const url = video.url || ''

  const caption =
    `✦ ᴅᴜʀᴀᴄɪᴏɴ: ${duration} ✦ ᴠɪsᴛᴀs: ${views} ✦ ᴘᴜʙʟɪᴄᴀᴅᴏ: ${ago} ✦ ᴀᴜᴛᴏʀ: ${author} ✦ ᴜʀʟ: ${url}`

  const canal = global.canal || 'https://whatsapp.com/channel/0029VaXHNMZL7UVTeseuqw3H'

  const locationMessage = {
    degreesLatitude: 0,
    degreesLongitude: 0,
    name: `🎧 ${title}`,
    address: caption,
    url: canal
  }

  if (thumb) {
    locationMessage.jpegThumbnail = thumb
  }

  try {
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
  } catch (error) {
    console.error('ERROR AL ENVIAR LOCATION:', error)
    await m.reply(caption)
  }
}

let handler = async (m, { conn, usedPrefix, command }) => {
  const texto = m.text?.trim().split(/\s+/).slice(1).join(' ')

  if (!texto) {
    return m.reply(
      `${global.e || '✦'} Ejemplo de uso *${usedPrefix + command}* <búsqueda o URL> de YouTube`
    )
  }

  if (descargaActiva) {
    return m.reply('🌙 Ya hay una descarga en proceso, espera a que termine.')
  }

  descargaActiva = true
  let archivo = null

  try {
    const video = await obtenerVideo(texto)

    if (!video?.url) {
      throw new Error('No se pudo obtener la URL del video.')
    }

    const title = limpiarNombre(video.title)
    const segundos = obtenerSegundos(video)
    const thumb = video.thumbnail
      ? await obtenerMiniatura(video.thumbnail)
      : null

    await enviarInformacion(m, conn, video, thumb)

    const esDocumentoForzado = [
      'play3', 'ytadoc', 'mp3doc', 'ytmp3doc'
    ].includes(command)

    const esVideoDocumento = [
      'play4', 'ytvdoc', 'mp4doc', 'ytmp4doc'
    ].includes(command)

    const esAudio = [
      'play', 'yta', 'mp3', 'ytmp3', 'playaudio',
      'play3', 'ytadoc', 'mp3doc', 'ytmp3doc'
    ].includes(command)

    const esVideo = [
      'play2', 'ytv', 'mp4', 'ytmp4', 'playvid',
      'play4', 'ytvdoc', 'mp4doc', 'ytmp4doc'
    ].includes(command)

    if (!esAudio && !esVideo) {
      throw new Error('Comando no compatible.')
    }

    const debeSerDocumento =
      esDocumentoForzado ||
      esVideoDocumento ||
      segundos > 1200

    const tipo = esAudio ? 'audio' : 'video'
    const descargado = await descargarArchivo(video.url, tipo)

    archivo = descargado.archivo

    const extension = descargado.extension
    const caption =
      `${tipo === 'audio' ? '🎵' : '🎬'} *${title}*\n\n` +
      `> Duración: ${video.timestamp || formatearDuracion(segundos)}\n` +
      '> YouTube'

    const opciones = tipo === 'audio'
      ? {
          mimetype: extension === 'm4a' ? 'audio/mp4' : 'audio/*',
          fileName: `${title}.${extension}`
        }
      : {
          mimetype: extension === 'mp4' ? 'video/mp4' : 'video/*',
          fileName: `${title}.${extension}`
        }

    if (debeSerDocumento) {
      await conn.sendMessage(
        m.chat,
        {
          document: { url: archivo },
          ...opciones,
          caption
        },
        { quoted: m }
      )
    } else if (tipo === 'audio') {
      await conn.sendMessage(
        m.chat,
        {
          audio: { url: archivo },
          ...opciones
        },
        { quoted: m }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        {
          video: { url: archivo },
          ...opciones,
          caption
        },
        { quoted: m }
      )
    }
  } catch (error) {
    console.error('YT-DLP ERROR:', error)

    await m.reply(
      `🌙 *No se pudo procesar la descarga.*\n\n> Error: ${String(error?.message || error).slice(0, 1200)}`
    )
  } finally {
    descargaActiva = false

    if (archivo) {
      await fs.promises.unlink(archivo).catch(() => {})
    }
  }
}

handler.help = [
  'play <texto o URL>',
  'play2 <texto o URL>',
  'play3 <texto o URL>',
  'play4 <texto o URL>'
]

handler.tags = ['descargas']

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

export default handler
