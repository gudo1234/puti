import { Innertube, UniversalCache } from 'youtubei.js'
import ytSearch from 'yt-search'

const MAX_DURATION = 20 * 60 // 20 minutos

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
  'ytmp4doc'
])

let youtubePromise = null

function getYouTube() {
  if (!youtubePromise) {
    youtubePromise = Innertube.create({
      cache: new UniversalCache(false),

      // SnapTube utiliza clientes internos de YouTube.
      // WEB es el punto de partida más compatible.
      client_type: 'WEB',

      lang: 'es',
      location: 'US',

      // Necesario para que youtubei.js pueda
      // obtener y descifrar el player.
      retrieve_player: true
    })
  }

  return youtubePromise
}

function cleanFileName(name = 'youtube') {
  return String(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150) || 'youtube'
}

function extractVideoId(input) {
  const value = String(input || '').trim()

  try {
    const url = new URL(value)

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, '')

    if (host === 'youtu.be') {
      return url.pathname
        .split('/')
        .filter(Boolean)[0] || null
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    ) {
      const v = url.searchParams.get('v')

      if (v) return v

      const parts = url.pathname
        .split('/')
        .filter(Boolean)

      if (
        ['shorts', 'embed', 'live'].includes(parts[0]) &&
        parts[1]
      ) {
        return parts[1]
      }
    }
  } catch {}

  return null
}

function isYouTubeUrl(input) {
  return Boolean(extractVideoId(input))
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

function classifyCommand(command) {
  const cmd = String(command || '').toLowerCase()

  if (AUDIO_COMMANDS.has(cmd)) {
    return {
      type: 'audio',
      document: false
    }
  }

  if (AUDIO_DOC_COMMANDS.has(cmd)) {
    return {
      type: 'audio',
      document: true
    }
  }

  if (VIDEO_COMMANDS.has(cmd)) {
    return {
      type: 'video',
      document: false
    }
  }

  if (VIDEO_DOC_COMMANDS.has(cmd)) {
    return {
      type: 'video',
      document: true
    }
  }

  return null
}

async function resolveVideo(input) {
  const youtube = await getYouTube()

  const directId = extractVideoId(input)

  /*
   * URL directa.
   */
  if (directId) {
    const info = await youtube.getBasicInfo(directId)

    return {
      youtube,
      info,
      videoId: directId
    }
  }

  /*
   * Búsqueda como SnapTube:
   *
   * texto
   *   ↓
   * búsqueda YouTube
   *   ↓
   * primer resultado
   */
  const search = await ytSearch(input)

  const video = search?.videos?.[0]

  if (!video) {
    throw new Error(
      'No encontré ningún resultado en YouTube.'
    )
  }

  const videoId = video.videoId

  const info = await youtube.getBasicInfo(videoId)

  return {
    youtube,
    info,
    videoId,
    searchVideo: video
  }
}

function getVideoTitle(info, fallback = 'YouTube') {
  return (
    info?.basic_info?.title ||
    info?.primary_info?.title?.text ||
    fallback
  )
}

function getDurationFromInfo(info) {
  return Number(
    info?.basic_info?.duration ||
    info?.basic_info?.duration_seconds ||
    0
  ) || 0
}

function getThumbnail(info, videoId) {
  return (
    info?.basic_info?.thumbnail?.[0]?.url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  )
}

function getFormatMime(format) {
  return String(
    format?.mime_type ||
    format?.mimeType ||
    ''
  )
}

function getFormatExtension(format, type) {
  const mime = getFormatMime(format)

  if (mime.includes('mp4')) {
    return 'mp4'
  }

  if (mime.includes('webm')) {
    return 'webm'
  }

  if (type === 'audio') {
    return 'm4a'
  }

  return 'mp4'
}

function chooseAudio(info) {
  /*
   * Primero intentamos MP4/AAC, que es el formato
   * más conveniente para WhatsApp.
   */
  try {
    return info.chooseFormat({
      type: 'audio',
      quality: 'best',
      format: 'mp4',
      codec: 'mp4a'
    })
  } catch {}

  /*
   * Fallback: cualquier audio.
   */
  return info.chooseFormat({
    type: 'audio',
    quality: 'best',
    format: 'any'
  })
}

function chooseVideo(info) {
  /*
   * Preferimos MP4/H.264 para WhatsApp.
   */
  try {
    return info.chooseFormat({
      type: 'video+audio',
      quality: '720p',
      format: 'mp4',
      codec: 'avc'
    })
  } catch {}

  /*
   * Si 720p no existe, dejamos que youtubei.js
   * seleccione la mejor combinación compatible.
   */
  try {
    return info.chooseFormat({
      type: 'video+audio',
      quality: 'best',
      format: 'mp4'
    })
  } catch {}

  /*
   * Último fallback.
   */
  return info.chooseFormat({
    type: 'video+audio',
    quality: 'best',
    format: 'any'
  })
}

async function getPlaybackUrl(youtube, info, format) {
  if (!format) {
    throw new Error(
      'YouTube no devolvió un formato compatible.'
    )
  }

  /*
   * Esta parte es equivalente conceptualmente
   * al paso de SnapTube donde transforma el
   * formato de YouTube en la URL final de reproducción.
   *
   * youtubei.js se encarga del decipher del player.
   */
  const url = await format.decipher(
    youtube.session.player
  )

  if (!url) {
    throw new Error(
      'No se pudo obtener la URL de reproducción.'
    )
  }

  return url
}

async function sendAudio(
  conn,
  m,
  {
    url,
    title,
    filename,
    document
  }
) {
  if (document) {
    return conn.sendMessage(
      m.chat,
      {
        document: {
          url
        },
        mimetype: 'audio/mp4',
        fileName: filename,
        caption: title
      },
      {
        quoted: m
      }
    )
  }

  return conn.sendMessage(
    m.chat,
    {
      audio: {
        url
      },
      mimetype: 'audio/mp4',
      fileName: filename,
      ptt: false
    },
    {
      quoted: m
    }
  )
}

async function sendVideo(
  conn,
  m,
  {
    url,
    title,
    filename,
    document
  }
) {
  if (document) {
    return conn.sendMessage(
      m.chat,
      {
        document: {
          url
        },
        mimetype: 'video/mp4',
        fileName: filename,
        caption: title
      },
      {
        quoted: m
      }
    )
  }

  return conn.sendMessage(
    m.chat,
    {
      video: {
        url
      },
      mimetype: 'video/mp4',
      fileName: filename,
      caption: title
    },
    {
      quoted: m
    }
  )
}

async function downloadFromYouTube({
  conn,
  m,
  input,
  type,
  document
}) {
  const {
    youtube,
    info,
    videoId,
    searchVideo
  } = await resolveVideo(input)

  const title = getVideoTitle(
    info,
    searchVideo?.title || 'YouTube'
  )

  const duration =
    getDurationFromInfo(info) ||
    Number(searchVideo?.seconds) ||
    0

  if (
    duration &&
    duration > MAX_DURATION
  ) {
    throw new Error(
      `El video dura ${formatDuration(duration)}. ` +
      `El límite es de 20 minutos.`
    )
  }

  /*
   * Comprobamos que YouTube no haya marcado
   * el vídeo como inaccesible.
   */
  const playability =
    info?.playability_status?.status

  if (
    playability &&
    !['OK', 'UNPLAYABLE'].includes(playability)
  ) {
    throw new Error(
      `YouTube respondió: ${playability}`
    )
  }

  let format

  if (type === 'audio') {
    format = chooseAudio(info)
  } else {
    format = chooseVideo(info)
  }

  const playbackUrl =
    await getPlaybackUrl(
      youtube,
      info,
      format
    )

  const extension =
    getFormatExtension(
      format,
      type
    )

  const filename =
    `${cleanFileName(title)}.${extension}`

  if (type === 'audio') {
    await sendAudio(
      conn,
      m,
      {
        url: playbackUrl,
        title,
        filename,
        document
      }
    )
  } else {
    await sendVideo(
      conn,
      m,
      {
        url: playbackUrl,
        title,
        filename,
        document
      }
    )
  }

  return {
    videoId,
    title,
    duration,
    thumbnail: getThumbnail(
      info,
      videoId
    ),
    url: playbackUrl,
    format
  }
}

const handler = async (
  m,
  {
    conn,
    text,
    command
  }
) => {
  const job =
    classifyCommand(command)

  if (!job) return

  const input =
    String(text || '').trim()

  if (!input) {
    return m.reply(
      `❌ Usa:\n\n` +
      `.${command} nombre o URL de YouTube`
    )
  }

  try {
    await m.react?.('⏳')

    await downloadFromYouTube({
      conn,
      m,
      input,
      type: job.type,
      document: job.document
    })

    await m.react?.('✅')

  } catch (error) {
    console.error(
      '[SNAPTUBE-STYLE YOUTUBE]',
      error
    )

    await m.react?.('❌')

    const message =
      String(error?.message || '')

    if (
      /login|required|sign.?in/i.test(message)
    ) {
      return m.reply(
        '❌ Este vídeo requiere iniciar sesión en YouTube.'
      )
    }

    if (
      /unplayable|unavailable|private/i.test(message)
    ) {
      return m.reply(
        '❌ Este vídeo no está disponible para reproducción.'
      )
    }

    if (
      /format|streaming|decipher|playback/i.test(message)
    ) {
      return m.reply(
        '❌ YouTube no proporcionó un formato de descarga compatible.'
      )
    }

    return m.reply(
      `❌ Error al procesar el vídeo:\n\n${message}`
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

handler.tags = [
  'downloader'
]

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
  'ytvdoc',
  'mp4doc',
  'ytmp4doc'
]

export default handler
