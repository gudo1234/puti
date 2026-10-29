
import fetch from 'node-fetch'
import yts from 'yt-search'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { generateWAMessageFromContent } from '@whiskeysockets/baileys'

const YTDLP_PATH = '/home/container/yt-dlp'
const COOKIES_PATH = '/home/container/cookies.txt'
const DOWNLOAD_DIR = '/home/container/tmp'
const TEMP_DIR = '/home/container/tmp'
const MAX_INTENTOS = 3

process.env.TMPDIR = TEMP_DIR
process.env.TMP = TEMP_DIR
process.env.TEMP = TEMP_DIR

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

let YTDlpWrap
let ytDlp
let instalacionYtDlp
let descargaActiva = false

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms))

async function cargarYtDlp() {
  if (ytDlp && fs.existsSync(YTDLP_PATH)) {
    return ytDlp
  }

  if (instalacionYtDlp) {
    return instalacionYtDlp
  }

  instalacionYtDlp = (async () => {
    const modulo = await import('yt-dlp-wrap-plus')

    YTDlpWrap =
      modulo.default?.default ||
      modulo.default ||
      modulo.YTDlpWrap

    if (!YTDlpWrap) {
      throw new Error('No se pudo cargar yt-dlp-wrap-plus.')
    }

    if (!fs.existsSync(YTDLP_PATH)) {
      await YTDlpWrap.downloadFromGithub(YTDLP_PATH)
    }

    await fs.promises.chmod(YTDLP_PATH, 0o755)

    const instancia = new YTDlpWrap(YTDLP_PATH)
    await instancia.execPromise(['--version'])

    ytDlp = instancia
    return ytDlp
  })()

  try {
    return await instalacionYtDlp
  } finally {
    instalacionYtDlp = null
  }
}

function crearIdentificador() {
  return `yt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
}

async function limpiarArchivos(id) {
  if (!id) return

  let archivos = []

  try {
    archivos = await fs.promises.readdir(DOWNLOAD_DIR)
  } catch {
    return
  }

  for (const nombre of archivos) {
    if (
      !nombre.startsWith(`${id}.`) &&
      !nombre.startsWith(`${id}_`)
    ) {
      continue
    }

    const archivo = path.join(DOWNLOAD_DIR, nombre)

    try {
      const stat = await fs.promises.lstat(archivo)

      if (stat.isSymbolicLink() || stat.isFile()) {
        await fs.promises.unlink(archivo)
      } else if (stat.isDirectory()) {
        await fs.promises.rm(archivo, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 200
        })
      }
    } catch {}
  }
}

function buscarArchivoDescargado(id, tipo) {
  const extensiones = tipo === 'audio'
    ? ['.m4a', '.mp3', '.opus', '.webm', '.aac', '.wav']
    : ['.mp4', '.mkv', '.webm', '.mov']

  const archivos = fs.readdirSync(DOWNLOAD_DIR)

  const encontrados = archivos
    .filter(nombre => {
      if (!nombre.startsWith(`${id}.`)) return false

      const extension = path.extname(nombre).toLowerCase()

      if (!extensiones.includes(extension)) return false
      if (/\.(part|ytdl|temp)$/i.test(nombre)) return false

      return true
    })
    .map(nombre => {
      const archivo = path.join(DOWNLOAD_DIR, nombre)

      try {
        const stat = fs.statSync(archivo)

        if (!stat.isFile() || stat.size <= 0) return null

        return {
          archivo,
          nombre,
          size: stat.size,
          extension: path.extname(nombre).slice(1).toLowerCase()
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.size - a.size)

  return encontrados[0] || null
}

async function descargarArchivo(url, tipo) {
  let ultimoError

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const id = crearIdentificador()

    try {
      const downloader = await cargarYtDlp()
      await fs.promises.mkdir(DOWNLOAD_DIR, { recursive: true })

      const salida = path.join(DOWNLOAD_DIR, `${id}.%(ext)s`)

      const argumentos = [
        '--ignore-config',
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
        '--socket-timeout', '30',
        '--js-runtimes', 'node',
        '--remote-components', 'ejs:github',
        '--output', salida
      ]

      if (fs.existsSync(COOKIES_PATH)) {
        argumentos.push('--cookies', COOKIES_PATH)
      }

      if (tipo === 'audio') {
        argumentos.push(
          '-f', 'bestaudio[ext=m4a]/bestaudio',
          '--extract-audio',
          '--audio-format', 'm4a',
          '--audio-quality', '0'
        )
      } else {
        argumentos.push(
          '-f', 'best[ext=mp4][height<=720]/best[height<=720]/best',
          '--merge-output-format', 'mp4'
        )
      }

      argumentos.push(url)

      await downloader.execPromise(argumentos)

      const resultado = buscarArchivoDescargado(id, tipo)

      if (!resultado) {
        throw new Error(
          `yt-dlp terminó, pero no se encontró el archivo descargado en ${DOWNLOAD_DIR}.`
        )
      }

      return { ...resultado, id }
    } catch (error) {
      ultimoError = error

      await limpiarArchivos(id)

      const mensaje = String(error?.message || error)

      const errorEjecutable =
        !fs.existsSync(YTDLP_PATH) ||
        /permission denied|failed to extract|exec format error|pyi-70/i.test(mensaje)

      if (errorEjecutable && intento < MAX_INTENTOS) {
        try {
          ytDlp = null

          if (YTDlpWrap) {
            await fs.promises.unlink(YTDLP_PATH).catch(() => {})
            await YTDlpWrap.downloadFromGithub(YTDLP_PATH)
            await fs.promises.chmod(YTDLP_PATH, 0o755)

            ytDlp = new YTDlpWrap(YTDLP_PATH)
            await ytDlp.execPromise(['--version'])
          } else {
            await cargarYtDlp()
          }
        } catch (errorInstalacion) {
          ultimoError = errorInstalacion
        }
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
    const mensaje = generateWAMessageFromContent(
      m.chat,
      { locationMessage },
      {
        userJid: conn.user.id,
        quoted: m
      }
    )

    await conn.relayMessage(
      m.chat,
      mensaje.message,
      { messageId: mensaje.key.id }
    )
  } catch {
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
  let descarga = null

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

    descarga = await descargarArchivo(video.url, tipo)

    const extension = descarga.extension
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
          document: { url: descarga.archivo },
          ...opciones,
          caption
        },
        { quoted: m }
      )
    } else if (tipo === 'audio') {
      await conn.sendMessage(
        m.chat,
        {
          audio: { url: descarga.archivo },
          ...opciones
        },
        { quoted: m }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        {
          video: { url: descarga.archivo },
          ...opciones,
          caption
        },
        { quoted: m }
      )
    }
  } catch (error) {
    await m.reply(
      `🌙 *No se pudo procesar la descarga.*\n\n> Error: ${String(error?.message || error).slice(0, 1200)}`
    )
  } finally {
    descargaActiva = false

    if (descarga?.id) {
      await limpiarArchivos(descarga.id)
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
