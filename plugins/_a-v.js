import fetch from 'node-fetch'
import ytSearch from 'yt-search'

const TUNELIO_API = 'https://tunelio.dev'

/*
 * ============================================================
 * CONFIGURACIÓN
 * ============================================================
 */

const TUNELIO_API_KEY = 'tnl_Drlt…n3OM'

const MAX_VIDEO_DURATION = 20 * 60 // 20 minutos
const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024 // 100 MB


/*
 * ============================================================
 * FETCH SEGURO
 * ============================================================
 */

async function safeFetch(url, options = {}, timeout = 60000) {
  const controller = new AbortController()

  const timer = setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })

    return response
  } finally {
    clearTimeout(timer)
  }
}


/*
 * ============================================================
 * UTILIDADES
 * ============================================================
 */

function cleanText(text = '') {
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function htmlDecode(text = '') {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function getVideoId(url = '') {
  try {
    const u = new URL(url)

    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0]
    }

    if (
      u.hostname === 'youtube.com' ||
      u.hostname === 'www.youtube.com' ||
      u.hostname === 'm.youtube.com'
    ) {
      return u.searchParams.get('v')
    }

    return null
  } catch {
    return null
  }
}

function isYouTubeUrl(text = '') {
  try {
    const u = new URL(text)

    return [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be'
    ].includes(u.hostname)
  } catch {
    return false
  }
}

function parseDuration(value) {
  if (!value) return 0

  if (typeof value === 'number') {
    return value
  }

  const text = String(value).trim()

  if (/^\d+$/.test(text)) {
    return Number(text)
  }

  const parts = text.split(':').map(Number)

  if (parts.some(Number.isNaN)) {
    return 0
  }

  if (parts.length === 3) {
    return (
      parts[0] * 3600 +
      parts[1] * 60 +
      parts[2]
    )
  }

  if (parts.length === 2) {
    return (
      parts[0] * 60 +
      parts[1]
    )
  }

  return 0
}

function formatDuration(seconds) {
  seconds = Number(seconds) || 0

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return `${m}:${String(s).padStart(2, '0')}`
}


/*
 * ============================================================
 * BÚSQUEDA DE YOUTUBE
 * ============================================================
 */

async function searchYouTube(query) {
  const text = String(query || '').trim()

  if (!text) {
    throw new Error('EMPTY_QUERY')
  }

  // Si ya proporcionaron una URL de YouTube,
  // no hacemos búsqueda.
  if (isYouTubeUrl(text)) {
    const id = getVideoId(text)

    if (!id) {
      throw new Error('INVALID_YOUTUBE_URL')
    }

    return {
      id,
      url: text,
      title: 'YouTube',
      duration: 0,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      author: ''
    }
  }

  const result = await ytSearch(text)

  if (!result || !result.videos || !result.videos.length) {
    throw new Error('VIDEO_NOT_FOUND')
  }

  const video = result.videos[0]

  return {
    id: video.videoId,
    url: video.url,
    title: video.title || 'Sin título',
    duration: parseDuration(video.duration),
    thumbnail:
      video.thumbnail ||
      `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
    author:
      video.author?.name ||
      video.author?.url ||
      '',
    views: video.views || 0
  }
}


/*
 * ============================================================
 * TUNELIO
 * ============================================================
 */

async function tunelioRequest(youtubeUrl, quality = 'mp3') {
  if (!TUNELIO_API_KEY) {
    throw new Error('TUNELIO_API_KEY_MISSING')
  }

  const params = new URLSearchParams({
    url: youtubeUrl,
    quality
  })

  const endpoint =
    `${TUNELIO_API}/create?${params.toString()}`

  const response = await safeFetch(
    endpoint,
    {
      headers: {
        Authorization: `Bearer ${TUNELIO_API_KEY}`,
        Accept: 'application/json'
      }
    },
    120000
  )

  const text = await response.text()

  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(
      `TUNELIO_INVALID_RESPONSE_${response.status}`
    )
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`

    throw new Error(
      `TUNELIO_ERROR: ${message}`
    )
  }

  return data
}


/*
 * ============================================================
 * OBTENER URL DE DESCARGA
 * ============================================================
 */

function extractTunelioUrl(data) {
  if (!data || typeof data !== 'object') {
    return null
  }

  const possibleUrls = [
    data.url,
    data.download,
    data.downloadUrl,
    data.download_url,
    data.result?.url,
    data.result?.download,
    data.data?.url,
    data.data?.download
  ]

  for (const value of possibleUrls) {
    if (
      typeof value === 'string' &&
      /^https?:\/\//i.test(value)
    ) {
      return value
    }
  }

  return null
}


/*
 * ============================================================
 * DESCARGAR ARCHIVO
 * ============================================================
 */

async function downloadFile(url) {
  const response = await safeFetch(
    url,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0'
      }
    },
    180000
  )

  if (!response.ok) {
    throw new Error(
      `DOWNLOAD_HTTP_${response.status}`
    )
  }

  const contentLength =
    Number(response.headers.get('content-length')) || 0

  if (
    contentLength &&
    contentLength > MAX_DOWNLOAD_SIZE
  ) {
    throw new Error('FILE_TOO_LARGE')
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  )

  if (
    buffer.length > MAX_DOWNLOAD_SIZE
  ) {
    throw new Error('FILE_TOO_LARGE')
  }

  if (!buffer.length) {
    throw new Error('EMPTY_FILE')
  }

  return {
    buffer,
    contentType:
      response.headers.get('content-type') ||
      'application/octet-stream'
  }
}


/*
 * ============================================================
 * PROCESAR AUDIO
 * ============================================================
 */

async function processAudio(video) {
  const data = await tunelioRequest(
    video.url,
    'mp3'
  )

  const downloadUrl =
    extractTunelioUrl(data)

  if (!downloadUrl) {
    throw new Error(
      'TUNELIO_NO_DOWNLOAD_URL'
    )
  }

  const file =
    await downloadFile(downloadUrl)

  return {
    ...file,
    url: downloadUrl,
    filename:
      `${cleanText(video.title).slice(0, 80) || 'audio'}.mp3`
  }
}


/*
 * ============================================================
 * PROCESAR VIDEO
 * ============================================================
 */

async function processVideo(video) {
  const data = await tunelioRequest(
    video.url,
    'mp4'
  )

  const downloadUrl =
    extractTunelioUrl(data)

  if (!downloadUrl) {
    throw new Error(
      'TUNELIO_NO_DOWNLOAD_URL'
    )
  }

  const file =
    await downloadFile(downloadUrl)

  return {
    ...file,
    url: downloadUrl,
    filename:
      `${cleanText(video.title).slice(0, 80) || 'video'}.mp4`
  }
}


/*
 * ============================================================
 * MENSAJES DE ERROR
 * ============================================================
 */

function getErrorMessage(error) {
  const code = error?.message || String(error)

  switch (code) {
    case 'EMPTY_QUERY':
      return '❌ Escribe el nombre o la URL del vídeo.'

    case 'INVALID_YOUTUBE_URL':
      return '❌ La URL de YouTube no es válida.'

    case 'VIDEO_NOT_FOUND':
      return '❌ No encontré ningún vídeo con esa búsqueda.'

    case 'TUNELIO_API_KEY_MISSING':
      return (
        '❌ Falta configurar `TUNELIO_API_KEY` en el servidor.'
      )

    case 'TUNELIO_NO_DOWNLOAD_URL':
      return (
        '❌ Tunelio no devolvió una URL de descarga.'
      )

    case 'FILE_TOO_LARGE':
      return (
        '❌ El archivo supera el límite permitido.'
      )

    case 'EMPTY_FILE':
      return (
        '❌ El servidor devolvió un archivo vacío.'
      )

    default:
      if (code.startsWith('TUNELIO_ERROR:')) {
        return (
          `❌ Error de Tunelio:\n> ${code.replace('TUNELIO_ERROR:', '').trim()}`
        )
      }

      if (code.startsWith('DOWNLOAD_HTTP_')) {
        return (
          `❌ No se pudo descargar el archivo (${code.replace('DOWNLOAD_HTTP_', 'HTTP ')}).`
        )
      }

      return (
        `❌ Ocurrió un error procesando el vídeo.\n\n> ${code}`
      )
  }
}


/*
 * ============================================================
 * HANDLER
 * ============================================================
 */

const handler = async (m, {
  conn,
  args,
  command
}) => {
  const query =
    args?.join(' ')?.trim() || ''

  if (!query) {
    return m.reply(
      `⭐ *Descargador de YouTube*\n\n` +
      `Uso:\n` +
      `> .${command} nombre del vídeo\n` +
      `> .${command} https://youtu.be/xxxxx`
    )
  }

  const audioCommands = [
    'play',
    'yta',
    'mp3',
    'ytmp3',
    'playaudio'
  ]

  const audioDocCommands = [
    'play3',
    'ytadoc',
    'mp3doc',
    'ytmp3doc'
  ]

  const videoCommands = [
    'play2',
    'ytv',
    'mp4',
    'ytmp4',
    'playvid'
  ]

  const videoDocCommands = [
    'play4',
    'ytvdoc',
    'mp4doc',
    'ytmp4doc'
  ]

  const isAudio =
    audioCommands.includes(command)

  const isAudioDoc =
    audioDocCommands.includes(command)

  const isVideo =
    videoCommands.includes(command)

  const isVideoDoc =
    videoDocCommands.includes(command)

  if (
    !isAudio &&
    !isAudioDoc &&
    !isVideo &&
    !isVideoDoc
  ) {
    return
  }

  const type =
    isAudio || isAudioDoc
      ? 'mp3'
      : 'mp4'

  try {
    await m.reply(
      `⏳ Buscando en YouTube...`
    )

    const video =
      await searchYouTube(query)

    if (
      video.duration &&
      video.duration > MAX_VIDEO_DURATION
    ) {
      return m.reply(
        `❌ El vídeo dura *${formatDuration(video.duration)}*.\n\n` +
        `El límite permitido es de *20 minutos*.`
      )
    }

    await m.reply(
      `⬇️ Descargando *${video.title}*...\n\n` +
      `> Tipo: ${type.toUpperCase()}` +
      (
        video.duration
          ? `\n> Duración: ${formatDuration(video.duration)}`
          : ''
      )
    )

    const file =
      type === 'mp3'
        ? await processAudio(video)
        : await processVideo(video)

    const title =
      cleanText(video.title)
        .slice(0, 100) ||
      'YouTube'

    /*
     * ========================================================
     * AUDIO
     * ========================================================
     */

    if (type === 'mp3') {
      if (isAudioDoc) {
        await conn.sendMessage(
          m.chat,
          {
            document: file.buffer,
            mimetype:
              'audio/mpeg',
            fileName:
              file.filename,
            caption:
              `🎵 *${title}*\n\n` +
              `> Descargado desde YouTube`
          },
          {
            quoted: m
          }
        )

        return
      }

      await conn.sendMessage(
        m.chat,
        {
          audio: file.buffer,
          mimetype:
            'audio/mpeg',
          ptt: false,
          fileName:
            file.filename
        },
        {
          quoted: m
        }
      )

      return
    }

    /*
     * ========================================================
     * VIDEO
     * ========================================================
     */

    if (isVideoDoc) {
      await conn.sendMessage(
        m.chat,
        {
          document: file.buffer,
          mimetype:
            'video/mp4',
          fileName:
            file.filename,
          caption:
            `🎬 *${title}*\n\n` +
            `> Descargado desde YouTube`
        },
        {
          quoted: m
        }
      )

      return
    }

    await conn.sendMessage(
      m.chat,
      {
        video: file.buffer,
        mimetype:
          'video/mp4',
        fileName:
          file.filename,
        caption:
          `🎬 *${title}*`
      },
      {
        quoted: m
      }
    )

  } catch (error) {
    console.error(
      '[YOUTUBE DOWNLOAD]',
      error
    )

    return m.reply(
      getErrorMessage(error)
    )
  }
}


/*
 * ============================================================
 * EXPORTACIÓN
 * ============================================================
 */

handler.help = [
  'play <texto>',
  'yta <texto>',
  'mp3 <texto>',
  'ytmp3 <texto>',
  'play2 <texto>',
  'ytv <texto>',
  'mp4 <texto>',
  'ytmp4 <texto>',
  'play3 <texto>',
  'ytadoc <texto>',
  'mp3doc <texto>',
  'play4 <texto>',
  'ytvdoc <texto>',
  'mp4doc <texto>'
]

handler.tags = [
  'downloader'
]

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
  'ytvdoc',
  'ytmp4doc'
]

handler.limit = true

export default handler
