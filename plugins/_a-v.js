import fetch from 'node-fetch'

const API_ENDPOINTS = [
  'https://najemi.cz/ytdl/handler.php',
  'https://ytdl.ga/handler.php'
]

const docAudio = ['play3', 'ytadoc', 'mp3doc', 'ytmp3doc']
const docVideo = ['play4', 'ytvdoc', 'mp4doc', 'ytmp4doc']

const normalAudio = ['play', 'yta', 'mp3', 'ytmp3', 'playaudio']
const normalVideo = ['play2', 'ytv', 'mp4', 'ytmp4', 'playvid']

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const safeFetch = async (url, options = {}, timeout = 30000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: '*/*',
        ...(options.headers || {})
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

const isYoutube = url =>
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)[\w-]{11}/i.test(url)

const getVideoId = url => {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]{11})/i
  )
  return match?.[1] || null
}

const normalizeUrl = value => {
  if (!value || typeof value !== 'string') return null

  let url = value.trim()

  url = url
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/')
    .replace(/^["']|["']$/g, '')

  if (!/^https?:\/\//i.test(url)) return null

  return url
}

const extractUrls = text => {
  if (!text) return []

  const found = []

  const patterns = [
    /https?:\/\/[^\s"'<>\\]+/gi,
    /https?:\\\/\\\/[^\s"'<>]+/gi
  ]

  for (const regex of patterns) {
    const matches = text.match(regex) || []

    for (let url of matches) {
      url = url
        .replace(/\\u0026/g, '&')
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&')
        .replace(/[),.;]+$/g, '')

      const clean = normalizeUrl(url)

      if (clean && !found.includes(clean)) {
        found.push(clean)
      }
    }
  }

  return found
}

const findMediaUrl = (text, type) => {
  const urls = extractUrls(text)

  if (!urls.length) return null

  const wanted = type === 'mp3'
    ? ['.mp3', 'audio', 'mp3', 'audio/mpeg']
    : ['.mp4', 'video', 'mp4', 'video/mp4']

  const preferred = urls.find(url => {
    const lower = url.toLowerCase()
    return wanted.some(x => lower.includes(x))
  })

  return preferred || urls[0]
}

const parseApiResponse = async (response, type) => {
  const contentType = response.headers.get('content-type') || ''

  if (!response.ok) {
    try {
      const errorText = await response.text()
      return {
        url: null,
        text: errorText
      }
    } catch {
      return {
        url: null,
        text: ''
      }
    }
  }

  if (
    contentType.includes('audio/') ||
    contentType.includes('video/') ||
    contentType.includes('application/octet-stream')
  ) {
    return {
      url: response.url,
      direct: true,
      contentType
    }
  }

  const text = await response.text()

  try {
    const json = JSON.parse(text)

    const candidates = [
      json.url,
      json.download,
      json.download_url,
      json.downloadUrl,
      json.link,
      json.file,
      json.file_url,
      json.fileUrl,
      json.result,
      json.data?.url,
      json.data?.download,
      json.data?.download_url,
      json.data?.link,
      json.data?.file,
      json.result?.url,
      json.result?.download,
      json.result?.link
    ]

    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue

      const clean = normalizeUrl(candidate)

      if (!clean) continue

      if (
        clean.includes('.mp3') ||
        clean.includes('.mp4') ||
        clean.includes('download') ||
        clean.includes('audio') ||
        clean.includes('video') ||
        type === 'mp3' ||
        type === 'mp4'
      ) {
        return {
          url: clean,
          direct: false,
          contentType
        }
      }
    }
  } catch {}

  const mediaUrl = findMediaUrl(text, type)

  if (mediaUrl) {
    return {
      url: mediaUrl,
      direct: false,
      contentType
    }
  }

  return {
    url: null,
    text
  }
}

const downloadFromApi = async (youtubeUrl, type) => {
  const errors = []

  for (const endpoint of API_ENDPOINTS) {
    try {
      const apiUrl =
        `${endpoint}?url=${encodeURIComponent(youtubeUrl)}&format=${type}`

      const response = await safeFetch(apiUrl, {
        method: 'GET',
        redirect: 'follow'
      }, 45000)

      const result = await parseApiResponse(response, type)

      if (result.url) {
        return result
      }

      errors.push(`${endpoint}: respuesta sin enlace`)
    } catch (e) {
      errors.push(`${endpoint}: ${e.message}`)
    }
  }

  throw new Error(errors.join('\n'))
}

const getInfo = async youtubeUrl => {
  const id = getVideoId(youtubeUrl)

  if (!id) {
    return {
      title: 'YouTube',
      thumbnail: `https://i.ytimg.com/vi/${id || 'dQw4w9WgXcQ'}/hqdefault.jpg`
    }
  }

  try {
    const oembed =
      `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`

    const response = await safeFetch(oembed, {
      method: 'GET'
    }, 15000)

    if (response.ok) {
      const data = await response.json()

      return {
        title: data.title || 'YouTube',
        author: data.author_name || '',
        thumbnail:
          data.thumbnail_url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      }
    }
  } catch {}

  return {
    title: 'YouTube',
    author: '',
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  }
}

const getYoutubeUrlFromText = text => {
  if (!text) return null

  const match = text.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]{11}[^\s]*|youtu\.be\/[\w-]{11}[^\s]*|youtube\.com\/shorts\/[\w-]{11}[^\s]*)/i
  )

  return match?.[0] || null
}

let handler = async (m, { conn, usedPrefix, command, args, text }) => {
  const cmd = command.toLowerCase()

  let query = text?.trim()

  if (!query && args?.length) {
    query = args.join(' ').trim()
  }

  if (!query) {
    return m.reply(
      `╭━━〔 🎵 ᴅᴇsᴄᴀʀɢᴀʀ ʏᴏᴜᴛᴜʙᴇ 〕━━⬣\n` +
      `┃\n` +
      `┃ ✦ Ejemplo:\n` +
      `┃ ${usedPrefix + command} https://youtu.be/VIDEO\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━⬣`
    )
  }

  const youtubeUrl = getYoutubeUrlFromText(query)

  if (!youtubeUrl || !isYoutube(youtubeUrl)) {
    return m.reply(
      `❌ Envía un enlace válido de YouTube.\n\n` +
      `Ejemplo:\n${usedPrefix + command} https://youtu.be/VIDEO`
    )
  }

  const videoId = getVideoId(youtubeUrl)

  if (!videoId) {
    return m.reply('❌ No pude obtener el ID del video de YouTube.')
  }

  let type = 'mp3'
  let asDocument = false

  if (docAudio.includes(cmd)) {
    type = 'mp3'
    asDocument = true
  } else if (docVideo.includes(cmd)) {
    type = 'mp4'
    asDocument = true
  } else if (normalVideo.includes(cmd)) {
    type = 'mp4'
  } else if (normalAudio.includes(cmd)) {
    type = 'mp3'
  }

  await m.reply(
    type === 'mp3'
      ? '⏳ Procesando el audio...'
      : '⏳ Procesando el video...'
  )

  try {
    const info = await getInfo(youtubeUrl)

    const result = await downloadFromApi(youtubeUrl, type)

    if (!result?.url) {
      throw new Error('No se obtuvo una URL multimedia válida.')
    }

    const caption =
      `╭━━〔 🎵 ʏᴏᴜᴛᴜʙᴇ 〕━━⬣\n` +
      `┃\n` +
      `┃ 🎬 *${info.title || 'YouTube'}*\n` +
      `┃ ${type === 'mp3' ? '🎧 Audio MP3' : '🎥 Video MP4'}\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━⬣`

    if (result.direct) {
      await conn.sendMessage(
        m.chat,
        {
          [type === 'mp3' ? 'audio' : 'video']: {
            url: result.url
          },
          mimetype: type === 'mp3' ? 'audio/mpeg' : 'video/mp4',
          fileName:
            `${(info.title || 'youtube').replace(/[\\/:*?"<>|]/g, '')}.${type}`,
          caption: asDocument ? undefined : caption,
          ...(asDocument ? { document: undefined } : {})
        },
        { quoted: m }
      )

      if (asDocument) {
        await conn.sendMessage(
          m.chat,
          {
            document: {
              url: result.url
            },
            mimetype: type === 'mp3'
              ? 'audio/mpeg'
              : 'video/mp4',
            fileName:
              `${(info.title || 'youtube').replace(/[\\/:*?"<>|]/g, '')}.${type}`,
            caption
          },
          { quoted: m }
        )
      }

      return
    }

    const mediaResponse = await safeFetch(
      result.url,
      {
        method: 'GET',
        redirect: 'follow'
      },
      120000
    )

    if (!mediaResponse.ok) {
      throw new Error(
        `El servidor multimedia respondió HTTP ${mediaResponse.status}`
      )
    }

    const contentType =
      mediaResponse.headers.get('content-type') || ''

    if (
      !contentType.includes('audio') &&
      !contentType.includes('video') &&
      !contentType.includes('octet-stream')
    ) {
      const body = await mediaResponse.text()

      if (/captcha|turnstile|cloudflare|challenge/i.test(body)) {
        throw new Error(
          'El endpoint devolvió una verificación/CAPTCHA en lugar del archivo.'
        )
      }

      throw new Error(
        'El enlace obtenido no devolvió un archivo multimedia.'
      )
    }

    const buffer = Buffer.from(await mediaResponse.arrayBuffer())

    if (!buffer.length) {
      throw new Error('El archivo recibido está vacío.')
    }

    const filename =
      `${(info.title || 'youtube').replace(/[\\/:*?"<>|]/g, '')}.${type}`

    if (asDocument) {
      await conn.sendMessage(
        m.chat,
        {
          document: buffer,
          mimetype: type === 'mp3'
            ? 'audio/mpeg'
            : 'video/mp4',
          fileName: filename,
          caption
        },
        { quoted: m }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        type === 'mp3'
          ? {
              audio: buffer,
              mimetype: 'audio/mpeg',
              fileName: filename
            }
          : {
              video: buffer,
              mimetype: 'video/mp4',
              fileName: filename,
              caption
            },
        { quoted: m }
      )
    }
  } catch (e) {
    console.error('[YOUTUBE]', e)

    await m.reply(
      `❌ *No se pudo descargar el contenido.*\n\n` +
      `> ${e.message}`
    )
  }
}

handler.help = [
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

handler.group = true

export default handler
