import fetch from 'node-fetch'
import ytSearch from 'yt-search'

const TUNELIO_API = 'https://tunelio.dev'
const TUNELIO_API_KEY =
  process.env.TUNELIO_API_KEY ||
  global.TUNELIO_API_KEY ||
  'tnl_Drlt…n3OM'

const MAX_DURATION = 20 * 60 // 20 minutos
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

const AUDIO_COMMANDS = new Set([
  'play',
  'yta',
  'mp3',
  'ytmp3',
  'playaudio'
])

const AUDIO_DOC_COMMANDS = new Set([
  'play3',
  'ytadoc',
  'mp3doc',
  'ytmp3doc'
])

const VIDEO_COMMANDS = new Set([
  'play2',
  'ytv',
  'mp4',
  'ytmp4',
  'playvid'
])

const VIDEO_DOC_COMMANDS = new Set([
  'play4',
  'ytvdoc',
  'mp4doc',
  'ytvdoc',
  'ytmp4doc'
])

function cleanFileName(name = 'youtube') {
  return String(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150) || 'youtube'
}

function isYouTubeUrl(value = '') {
  try {
    const url = new URL(value)

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, '')

    return (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'music.youtube.com'
    )
  } catch {
    return false
  }
}

function getVideoId(value = '') {
  try {
    const url = new URL(value)

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, '')

    if (host === 'youtu.be') {
      return url.pathname.slice(1).split('/')[0] || null
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    ) {
      const v = url.searchParams.get('v')
      if (v) return v

      const parts = url.pathname.split('/').filter(Boolean)

      if (parts[0] === 'shorts' && parts[1]) {
        return parts[1]
      }

      if (parts[0] === 'embed' && parts[1]) {
        return parts[1]
      }

      if (parts[0] === 'live' && parts[1]) {
        return parts[1]
      }
    }
  } catch {}

  return null
}

function formatDuration(seconds) {
  seconds = Number(seconds) || 0

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return [
      h,
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0')
    ].join(':')
  }

  return [
    m,
    String(s).padStart(2, '0')
  ].join(':')
}

async function safeJson(response) {
  const text = await response.text()

  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(
      `Tunelio respondió algo que no es JSON (${response.status})`
    )
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.status ||
      `HTTP ${response.status}`

    throw new Error(message)
  }

  return data
}

async function searchYouTube(query) {
  const result = await ytSearch(query)

  if (!result?.videos?.length) {
    throw new Error('No encontré ningún video en YouTube.')
  }

  const video = result.videos[0]

  return {
    url: video.url,
    videoId: video.videoId,
    title: video.title,
    duration: Number(video.seconds) || 0,
    thumbnail:
      video.thumbnail ||
      `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
  }
}

async function getYouTubeInfo(url) {
  const response = await fetch(
    `${TUNELIO_API}/info?${new URLSearchParams({ url })}`,
    {
      headers: {
        Authorization: `Bearer ${TUNELIO_API_KEY}`,
        Accept: 'application/json'
      }
    }
  )

  return safeJson(response)
}

async function createDownload(url, quality) {
  if (!TUNELIO_API_KEY) {
    throw new Error(
      'Falta configurar TUNELIO_API_KEY en las variables de entorno.'
    )
  }

  const params = new URLSearchParams({
    url,
    quality
  })

  const response = await fetch(
    `${TUNELIO_API}/create?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${TUNELIO_API_KEY}`,
        Accept: 'application/json'
      }
    }
  )

  const data = await safeJson(response)

  if (data.status && data.status !== 'ok') {
    throw new Error(
      data.message ||
      data.error ||
      data.status
    )
  }

  if (!data.url) {
    throw new Error(
      'Tunelio no devolvió una URL de descarga.'
    )
  }

  return data
}

async function downloadBuffer(url, maxSize = MAX_FILE_SIZE) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `No se pudo descargar el archivo (${response.status}).`
    )
  }

  const contentLength = Number(
    response.headers.get('content-length') || 0
  )

  if (contentLength > maxSize) {
    throw new Error(
      `El archivo pesa demasiado (${Math.round(
        contentLength / 1024 / 1024
      )} MB).`
    )
  }

  const chunks = []
  let total = 0

  for await (const chunk of response.body) {
    total += chunk.length

    if (total > maxSize) {
      throw new Error(
        `El archivo supera el límite de ${Math.round(
          maxSize / 1024 / 1024
        )} MB.`
      )
    }

    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

async function resolveInput(text) {
  text = String(text || '').trim()

  if (!text) {
    throw new Error(
      'Escribe un enlace de YouTube o el nombre de una canción/video.'
    )
  }

  if (isYouTubeUrl(text)) {
    return {
      url: text,
      videoId: getVideoId(text),
      title: null,
      duration: 0,
      thumbnail: null
    }
  }

  return searchYouTube(text)
}

async function processYouTube({
  conn,
  m,
  input,
  mode,
  asDocument
}) {
  const resolved = await resolveInput(input)

  let title = resolved.title
  let duration = resolved.duration
  let thumbnail = resolved.thumbnail

  /*
   * Cuando el usuario proporciona directamente una URL,
   * obtenemos metadata de Tunelio.
   *
   * /info cuesta créditos, por eso NO lo usamos cuando
   * ya tenemos los datos de yt-search.
   */
  if (!title || !duration) {
    try {
      const info = await getYouTubeInfo(resolved.url)

      title = info.title || title
      duration =
        Number(info.duration_seconds) ||
        duration ||
        0

      thumbnail =
        info.thumbnail ||
        thumbnail
    } catch {
      // No detenemos el proceso solamente por no obtener metadata.
    }
  }

  if (duration > MAX_DURATION) {
    throw new Error(
      `El video dura ${formatDuration(duration)}. ` +
      `El límite permitido es de 20 minutos.`
    )
  }

  const quality = mode === 'audio'
    ? 'mp3'
    : '720p'

  const download = await createDownload(
    resolved.url,
    quality
  )

  const finalTitle =
    title ||
    download.filename?.replace(/\.(mp3|mp4)$/i, '') ||
    'YouTube'

  const filenameBase = cleanFileName(finalTitle)

  const extension = mode === 'audio'
    ? 'mp3'
    : 'mp4'

  const filename =
    `${filenameBase}.${extension}`

  /*
   * Descargamos el archivo al buffer para que funcione
   * de forma consistente con distintas versiones de Baileys.
   */
  const buffer = await downloadBuffer(download.url)

  if (mode === 'audio') {
    if (asDocument) {
      await conn.sendMessage(
        m.chat,
        {
          document: buffer,
          mimetype: 'audio/mpeg',
          fileName: filename,
          caption: finalTitle
        },
        { quoted: m }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        {
          audio: buffer,
          mimetype: 'audio/mpeg',
          fileName: filename,
          ptt: false
        },
        { quoted: m }
      )
    }
  } else {
    if (asDocument) {
      await conn.sendMessage(
        m.chat,
        {
          document: buffer,
          mimetype: 'video/mp4',
          fileName: filename,
          caption: finalTitle
        },
        { quoted: m }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        {
          video: buffer,
          mimetype: 'video/mp4',
          fileName: filename,
          caption: finalTitle
        },
        { quoted: m }
      )
    }
  }

  return {
    title: finalTitle,
    duration,
    thumbnail,
    url: resolved.url,
    downloadUrl: download.url,
    filename,
    size: download.file_size_str || null
  }
}

const handler = async (m, { conn, text, command }) => {
  const cmd = String(command || '').toLowerCase()
  const input = String(text || '').trim()

  if (!input) {
    return m.reply(
      `Uso:\n\n` +
      `• .${cmd} nombre o URL de YouTube`
    )
  }

  try {
    await m.react?.('⏳')

    let mode
    let asDocument

    if (AUDIO_COMMANDS.has(cmd)) {
      mode = 'audio'
      asDocument = false
    } else if (AUDIO_DOC_COMMANDS.has(cmd)) {
      mode = 'audio'
      asDocument = true
    } else if (VIDEO_COMMANDS.has(cmd)) {
      mode = 'video'
      asDocument = false
    } else if (VIDEO_DOC_COMMANDS.has(cmd)) {
      mode = 'video'
      asDocument = true
    } else {
      return
    }

    await processYouTube({
      conn,
      m,
      input,
      mode,
      asDocument
    })

    await m.react?.('✅')
  } catch (error) {
    console.error('[TUNELIO]', error)

    await m.react?.('❌')

    return m.reply(
      `❌ No pude descargar el contenido.\n\n` +
      `${error?.message || 'Error desconocido.'}`
    )
  }
}

handler.help = [
  'play <texto>',
  'yta <texto>',
  'mp3 <texto>',
  'ytmp3 <texto>',
  'play2 <texto>',
  'ytv <texto>',
  'mp4 <texto>',
  'ytmp4 <texto>'
]

handler.tags = ['downloader']

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
