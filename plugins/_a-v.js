import fetch from 'node-fetch'

const API_ENDPOINTS = [
  {
    name: 'Vexo',
    url: 'https://vexoapi.site/api/download/ytmp3',
    type: 'ytmp3'
  },
  {
    name: 'YouTube DL CC',
    url: 'https://jonell01-youtube-dl-ccapi-hutchin.hf.space',
    type: 'cc'
  }
]

const docAudio = ['play3', 'ytadoc', 'mp3doc', 'ytmp3doc']
const docVideo = ['play4', 'ytvdoc', 'mp4doc', 'ytmp4doc']

const normalAudio = ['play', 'yta', 'mp3', 'ytmp3', 'playaudio']
const normalVideo = ['play2', 'ytv', 'mp4', 'ytmp4', 'playvid']

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const safeFetch = async (url, options = {}, timeout = 60000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow',
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

const getVideoId = url => {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]{11})/i
  )

  return match?.[1] || null
}

const isYoutube = url =>
  !!getVideoId(url)

const normalizeUrl = value => {
  if (!value || typeof value !== 'string') return null

  let url = value.trim()

  url = url
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/')
    .replace(/^["']|["']$/g, '')
    .replace(/[),.;]+$/g, '')

  if (!/^https?:\/\//i.test(url)) return null

  return url
}

const extractUrls = text => {
  if (!text) return []

  const urls = []

  const regex =
    /https?:\\?\/\\?\/[^\s"'<>]+/gi

  const matches = text.match(regex) || []

  for (let url of matches) {
    url = url
      .replace(/\\\//g, '/')
      .replace(/\\u0026/g, '&')
      .replace(/&amp;/g, '&')

    const clean = normalizeUrl(url)

    if (clean && !urls.includes(clean)) {
      urls.push(clean)
    }
  }

  return urls
}

const findDownloadUrl = (data, rawText = '') => {
  const candidates = []

  const add = value => {
    if (typeof value !== 'string') return

    const url = normalizeUrl(value)

    if (url && !candidates.includes(url)) {
      candidates.push(url)
    }
  }

  if (typeof data === 'string') {
    add(data)
  }

  if (data && typeof data === 'object') {
    add(data.url)
    add(data.download)
    add(data.download_url)
    add(data.downloadUrl)
    add(data.link)
    add(data.file)
    add(data.file_url)
    add(data.fileUrl)
    add(data.audio)
    add(data.video)

    if (data.data) {
      add(data.data.url)
      add(data.data.download)
      add(data.data.download_url)
      add(data.data.downloadUrl)
      add(data.data.link)
      add(data.data.file)
    }

    if (data.result) {
      add(data.result.url)
      add(data.result.download)
      add(data.result.download_url)
      add(data.result.downloadUrl)
      add(data.result.link)
      add(data.result.file)
    }
  }

  for (const url of extractUrls(rawText)) {
    add(url)
  }

  return candidates.find(url =>
    /\.(mp3|mp4)(?:\?|$)/i.test(url)
  ) || candidates.find(url =>
    /download|audio|video|stream|media/i.test(url)
  ) || candidates[0] || null
}

const parseResponse = async (response, type) => {
  const contentType =
    response.headers.get('content-type') || ''

  if (
    contentType.includes('audio/') ||
    contentType.includes('video/') ||
    contentType.includes('application/octet-stream')
  ) {
    return {
      direct: true,
      url: response.url,
      contentType
    }
  }

  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    const json = JSON.parse(text)

    const url = findDownloadUrl(json, text)

    if (url) {
      return {
        direct: false,
        url,
        contentType
      }
    }
  } catch {}

  const url = findDownloadUrl(null, text)

  if (url) {
    return {
      direct: false,
      url,
      contentType
    }
  }

  if (/captcha|turnstile|cloudflare|challenge/i.test(text)) {
    throw new Error('El servidor devolvió una verificación/CAPTCHA.')
  }

  return null
}

const vexo = async (youtubeUrl, type) => {
  const endpoint =
    'https://vexoapi.site/api/download/ytmp3'

  const url =
    `${endpoint}?url=${encodeURIComponent(youtubeUrl)}`

  const response = await safeFetch(
    url,
    {
      method: 'GET'
    },
    90000
  )

  if (!response.ok) {
    throw new Error(
      `Vexo HTTP ${response.status}`
    )
  }

  const result =
    await parseResponse(response, type)

  if (!result?.url) {
    throw new Error(
      'Vexo no devolvió un enlace multimedia.'
    )
  }

  return result
}

const ccApi = async (youtubeUrl, type) => {
  const endpoint =
    'https://jonell01-youtube-dl-ccapi-hutchin.hf.space'

  const possibleUrls = [
    `${endpoint}/?url=${encodeURIComponent(youtubeUrl)}&type=${type}`,
    `${endpoint}/download?url=${encodeURIComponent(youtubeUrl)}&type=${type}`,
    `${endpoint}/api/download?url=${encodeURIComponent(youtubeUrl)}&type=${type}`
  ]

  let lastError = null

  for (const url of possibleUrls) {
    try {
      const response = await safeFetch(
        url,
        {
          method: 'GET'
        },
        120000
      )

      if (!response.ok) {
        lastError =
          new Error(`CC API HTTP ${response.status}`)

        continue
      }

      const result =
        await parseResponse(response, type)

      if (result?.url) {
        return result
      }
    } catch (e) {
      lastError = e
    }
  }

  throw lastError ||
    new Error('CC API no respondió correctamente.')
}

const downloadFromApis = async (youtubeUrl, type) => {
  const errors = []

  try {
    const result =
      await vexo(youtubeUrl, type)

    return {
      ...result,
      provider: 'Vexo'
    }
  } catch (e) {
    errors.push(`Vexo: ${e.message}`)
  }

  try {
    const result =
      await ccApi(youtubeUrl, type)

    return {
      ...result,
      provider: 'YouTube DL CC'
    }
  } catch (e) {
    errors.push(`YouTube DL CC: ${e.message}`)
  }

  throw new Error(
    errors.join('\n')
  )
}

const getInfo = async youtubeUrl => {
  const id = getVideoId(youtubeUrl)

  const fallback = {
    title: 'YouTube',
    author: '',
    thumbnail:
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  }

  try {
    const url =
      `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`

    const response =
      await safeFetch(
        url,
        {},
        15000
      )

    if (!response.ok) {
      return fallback
    }

    const data =
      await response.json()

    return {
      title:
        data.title ||
        fallback.title,

      author:
        data.author_name ||
        '',

      thumbnail:
        data.thumbnail_url ||
        fallback.thumbnail
    }
  } catch {
    return fallback
  }
}

const downloadMedia = async (url, type) => {
  const response =
    await safeFetch(
      url,
      {
        method: 'GET'
      },
      180000
    )

  if (!response.ok) {
    throw new Error(
      `El servidor multimedia respondió HTTP ${response.status}`
    )
  }

  const contentType =
    response.headers.get('content-type') || ''

  if (
    !contentType.includes('audio') &&
    !contentType.includes('video') &&
    !contentType.includes('octet-stream')
  ) {
    const text =
      await response.text()

    if (
      /captcha|turnstile|cloudflare|challenge/i.test(text)
    ) {
      throw new Error(
        'El enlace devolvió una verificación/CAPTCHA.'
      )
    }

    throw new Error(
      `La URL no devolvió ${type.toUpperCase()}.`
    )
  }

  const buffer =
    Buffer.from(
      await response.arrayBuffer()
    )

  if (!buffer.length) {
    throw new Error(
      'El archivo recibido está vacío.'
    )
  }

  return {
    buffer,
    contentType
  }
}

let handler = async (
  m,
  {
    conn,
    usedPrefix,
    command,
    args,
    text
  }
) => {
  const cmd =
    command.toLowerCase()

  let query =
    text?.trim()

  if (!query && args?.length) {
    query =
      args.join(' ').trim()
  }

  if (!query) {
    return m.reply(
      `╭━━〔 🎵 ᴅᴇsᴄᴀʀɢᴀʀ ʏᴏᴜᴛᴜʙᴇ 〕━━⬣\n` +
      `┃\n` +
      `┃ ✦ Envía un enlace de YouTube\n` +
      `┃\n` +
      `┃ Ejemplo:\n` +
      `┃ ${usedPrefix + command} https://youtu.be/VIDEO\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━⬣`
    )
  }

  const match =
    query.match(
      /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]{11}[^\s]*|youtu\.be\/[\w-]{11}[^\s]*|youtube\.com\/shorts\/[\w-]{11}[^\s]*)/i
    )

  const youtubeUrl =
    match?.[0] || null

  if (
    !youtubeUrl ||
    !isYoutube(youtubeUrl)
  ) {
    return m.reply(
      `❌ Envía un enlace válido de YouTube.\n\n` +
      `Ejemplo:\n` +
      `${usedPrefix + command} https://youtu.be/VIDEO`
    )
  }

  let type = 'mp3'
  let asDocument = false

  if (docAudio.includes(cmd)) {
    type = 'mp3'
    asDocument = true
  }

  if (docVideo.includes(cmd)) {
    type = 'mp4'
    asDocument = true
  }

  if (normalVideo.includes(cmd)) {
    type = 'mp4'
  }

  if (normalAudio.includes(cmd)) {
    type = 'mp3'
  }

  await m.reply(
    type === 'mp3'
      ? '⏳ *Procesando audio...*'
      : '⏳ *Procesando video...*'
  )

  try {
    const info =
      await getInfo(youtubeUrl)

    const result =
      await downloadFromApis(
        youtubeUrl,
        type
      )

    if (!result?.url) {
      throw new Error(
        'No se obtuvo una URL de descarga.'
      )
    }

    let media

    if (result.direct) {
      media = await downloadMedia(
        result.url,
        type
      )
    } else {
      media = await downloadMedia(
        result.url,
        type
      )
    }

    const cleanTitle =
      (info.title || 'youtube')
        .replace(
          /[\\/:*?"<>|]/g,
          ''
        )
        .slice(0, 150)

    const filename =
      `${cleanTitle}.${type}`

    const caption =
      `╭━━〔 🎵 ʏᴏᴜᴛᴜʙᴇ 〕━━⬣\n` +
      `┃\n` +
      `┃ 🎬 *${info.title || 'YouTube'}*\n` +
      `┃ ${type === 'mp3' ? '🎧 Audio MP3' : '🎥 Video MP4'}\n` +
      `┃ ⚡ ${result.provider}\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━⬣`

    if (asDocument) {
      await conn.sendMessage(
        m.chat,
        {
          document:
            media.buffer,

          mimetype:
            type === 'mp3'
              ? 'audio/mpeg'
              : 'video/mp4',

          fileName:
            filename,

          caption
        },
        {
          quoted: m
        }
      )

      return
    }

    if (type === 'mp3') {
      await conn.sendMessage(
        m.chat,
        {
          audio:
            media.buffer,

          mimetype:
            'audio/mpeg',

          fileName:
            filename
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
        video:
          media.buffer,

        mimetype:
          'video/mp4',

        fileName:
          filename,

        caption
      },
      {
        quoted: m
      }
    )
  } catch (e) {
    console.error(
      '[YOUTUBE]',
      e
    )

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
  'ytmp4doc'
]

handler.group = true

export default handler
