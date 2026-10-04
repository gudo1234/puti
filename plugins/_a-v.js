import fetch from "node-fetch"

const YT1Z = "https://yt1z.top"

const docAudio = ['play3', 'ytadoc', 'mp3doc', 'ytmp3doc']
const docVideo = ['play4', 'ytvdoc', 'mp4doc', 'ytmp4doc']
const normalAudio = ['play', 'yta', 'mp3', 'ytmp3', 'playaudio']
const normalVideo = ['play2', 'ytv', 'mp4', 'ytmp4', 'playvid']

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const safeFetch = async (url, options = {}, timeout = 30000) => {
  let timer

  try {
    const controller = new AbortController()

    timer = setTimeout(() => controller.abort(), timeout)

    const headers = {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(options.headers || {})
    }

    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    })

    if (!res.ok) return null

    return res
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const htmlDecode = (str = '') => {
  return String(str)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x3D;/gi, '=')
    .replace(/&#x26;/gi, '&')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCharCode(code) : _
    })
}

const decodeJs = (str = '') => {
  return String(str)
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\')
}

const cleanText = (str = '') => {
  return htmlDecode(str)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const absoluteUrl = value => {
  if (!value) return ''

  let url = decodeJs(htmlDecode(value).trim())

  url = url
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/&amp;/gi, '&')

  if (!url) return ''

  if (url.startsWith('//')) {
    return `https:${url}`
  }

  if (url.startsWith('/')) {
    return `${YT1Z}${url}`
  }

  if (/^https?:\/\//i.test(url)) {
    return url
  }

  return ''
}

const getVideoId = text => {
  const value = String(text || '').trim()

  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/i,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  ]

  for (const regex of patterns) {
    const match = value.match(regex)
    if (match?.[1]) return match[1]
  }

  return null
}

const searchYT1Z = async query => {
  const res = await safeFetch(`${YT1Z}/s/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': YT1Z,
      'Referer': `${YT1Z}/`
    },
    body: new URLSearchParams({
      search: query
    }).toString()
  }, 45000)

  if (!res) return null

  try {
    const raw = await res.text()

    if (!raw) return null

    const start = raw.indexOf('[')

    if (start === -1) {
      try {
        const direct = JSON.parse(raw)

        if (direct?.error) return null

        return Array.isArray(direct) ? direct : null
      } catch {
        return null
      }
    }

    const end = raw.lastIndexOf(']')

    if (end === -1 || end < start) return null

    const json = JSON.parse(raw.slice(start, end + 1))

    if (!Array.isArray(json)) return null

    return json
      .filter(item => item?.videoId)
      .map(item => {
        const videoId = String(item.videoId).trim()

        return {
          videoId,
          title: cleanText(item.title || ''),
          url: `https://youtu.be/${videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
        }
      })
      .filter(item => item.videoId)
  } catch {
    return null
  }
}

const extractMeta = (html, key) => {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      'i'
    )
  ]

  for (const regex of patterns) {
    const match = html.match(regex)

    if (match?.[1]) {
      return cleanText(match[1])
    }
  }

  return ''
}

const extractTagText = (html, tag, className) => {
  const regex = new RegExp(
    `<${tag}[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
    'i'
  )

  const match = html.match(regex)

  return match ? cleanText(match[1]) : ''
}

const extractInfo = html => {
  const title =
    extractMeta(html, 'og:title') ||
    extractMeta(html, 'twitter:title') ||
    extractTagText(html, 'h1', 'dl-title') ||
    extractTagText(html, 'h2', 'dl-title') ||
    extractTagText(html, 'div', 'dl-title') ||
    extractTagText(html, 'div', 'video-title') ||
    extractTagText(html, 'div', 'title') ||
    ''

  const description =
    extractMeta(html, 'og:description') ||
    extractMeta(html, 'twitter:description') ||
    ''

  const thumbnail =
    extractMeta(html, 'og:image') ||
    extractMeta(html, 'twitter:image') ||
    ''

  const author =
    extractTagText(html, 'div', 'dl-author') ||
    extractTagText(html, 'span', 'dl-author') ||
    extractTagText(html, 'div', 'author') ||
    extractTagText(html, 'span', 'author') ||
    ''

  const duration =
    extractTagText(html, 'div', 'dl-duration') ||
    extractTagText(html, 'span', 'dl-duration') ||
    extractTagText(html, 'div', 'duration') ||
    extractTagText(html, 'span', 'duration') ||
    ''

  return {
    title,
    description,
    thumbnail,
    author,
    duration
  }
}

const extractCandidates = html => {
  const candidates = []

  const add = (value, context = '') => {
    const url = absoluteUrl(value)

    if (!url) return

    if (
      url.startsWith(`${YT1Z}/`) &&
      !/\/(?:download|dl|file|api|d)\//i.test(url)
    ) {
      return
    }

    if (
      /^(?:javascript:|data:|mailto:|tel:)/i.test(url)
    ) {
      return
    }

    if (!candidates.some(x => x.url === url)) {
      candidates.push({
        url,
        context: cleanText(context)
      })
    }
  }

  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi

  let match

  while ((match = anchorRegex.exec(html)) !== null) {
    const attrs = match[1] || ''
    const body = match[2] || ''

    const href =
      attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ||
      attrs.match(/\bhref\s*=\s*([^\s>]+)/i)?.[1]

    const dataUrl =
      attrs.match(/\bdata-(?:url|href|download)\s*=\s*["']([^"']+)["']/i)?.[1]

    const text = cleanText(body)
    const context = `${attrs} ${text}`

    add(href, context)
    add(dataUrl, context)
  }

  const attrRegex = /\b(?:href|src|data-url|data-href|data-download)\s*=\s*["']([^"']+)["']/gi

  while ((match = attrRegex.exec(html)) !== null) {
    add(match[1], match[0])
  }

  const onclickRegex = /\bonclick\s*=\s*["']([^"']+)["']/gi

  while ((match = onclickRegex.exec(html)) !== null) {
    const code = decodeJs(htmlDecode(match[1]))

    const urls = code.match(
      /https?:\/\/[^'"`\s)]+|\/(?:download|dl|file|api|d)\/[^'"`\s)]+/gi
    ) || []

    for (const url of urls) {
      add(url, code)
    }
  }

  const jsUrlRegex =
    /(?:window\.open|location(?:\.href)?|window\.location(?:\.href)?)\s*\(\s*["'`]([^"'`]+)["'`]/gi

  while ((match = jsUrlRegex.exec(html)) !== null) {
    add(match[1], match[0])
  }

  const absoluteRegex =
    /https?:\/\/[^\s"'<>\\]+/gi

  while ((match = absoluteRegex.exec(html)) !== null) {
    add(match[0], 'absolute-url')
  }

  return candidates
}

const scoreDownloadCandidate = (candidate, format) => {
  const url = candidate.url.toLowerCase()
  const context = candidate.context.toLowerCase()

  let score = 0

  if (format === 'mp3') {
    if (/\.mp3(?:[?#]|$)/i.test(url)) score += 100
    if (/\bmp3\b/.test(context)) score += 70
    if (/audio|music|sound/.test(context)) score += 30
  } else {
    if (/\.mp4(?:[?#]|$)/i.test(url)) score += 100
    if (/\bmp4\b/.test(context)) score += 70
    if (/video/.test(context)) score += 30

    if (/2160|4k/.test(context)) score += 15
    if (/1080|full\s*hd/.test(context)) score += 12
    if (/720|hd/.test(context)) score += 8
  }

  if (/download/.test(context)) score += 50
  if (/download/.test(url)) score += 40
  if (/get\s*(file|video|audio)|save\s*(file|video|audio)/.test(context)) score += 30

  if (/facebook|instagram|twitter|tiktok|youtube\.com\/(watch|shorts)/.test(url)) {
    score -= 100
  }

  if (
    /\.(?:css|js|png|jpg|jpeg|gif|svg|webp|ico)(?:[?#]|$)/i.test(url)
  ) {
    score -= 200
  }

  return score
}

const extractDownloadLink = (html, format) => {
  const candidates = extractCandidates(html)

  if (!candidates.length) return null

  const ranked = candidates
    .map(candidate => ({
      ...candidate,
      score: scoreDownloadCandidate(candidate, format)
    }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.url || null
}

const processYT1Z = async (url, format) => {
  const params = new URLSearchParams({
    url,
    lng: 'en',
    t: '',
    fmt: format
  })

  const endpoint = `${YT1Z}/d/?${params.toString()}`

  const res = await safeFetch(endpoint, {
    method: 'GET',
    headers: {
      'Referer': `${YT1Z}/`,
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8'
    }
  }, 180000)

  if (!res) return null

  try {
    const html = await res.text()

    if (!html || html.length < 50) {
      return null
    }

    const info = extractInfo(html)
    const link = extractDownloadLink(html, format)

    return {
      html,
      link,
      ...info
    }
  } catch {
    return null
  }
}

const secondsFromDuration = duration => {
  if (!duration) return 0

  const clean = String(duration)
    .replace(/[^\d:]/g, '')
    .trim()

  if (!clean) return 0

  const parts = clean
    .split(':')
    .map(Number)

  if (
    !parts.length ||
    parts.some(value => !Number.isFinite(value))
  ) {
    return 0
  }

  return parts.reduce(
    (total, value) => total * 60 + value,
    0
  )
}

const getDownload = async (url, format) => {
  const result = await processYT1Z(url, format)

  if (!result?.link) {
    return null
  }

  return {
    link: result.link,
    title: result.title || 'YouTube',
    thumbnail: result.thumbnail || '',
    author: result.author || '',
    duration: result.duration || ''
  }
}

const handler = async (m, { conn, text, usedPrefix, command, args }) => {
  if (!text) {
    const tipo = normalAudio.includes(command)
      ? 'audio'
      : docAudio.includes(command)
      ? 'audio en documento'
      : normalVideo.includes(command)
      ? 'video'
      : 'video en documento'

    return m.reply(
      `${e} Ingresa _texto_ o _enlace_ de YouTube para descargar el *${tipo}.*`
    )
  }

  await m.react("🕒")

  try {
    const query = args.join(" ").trim()

    const videoId = getVideoId(query)

    let videoUrl = ''
    let searchInfo = null

    if (videoId) {
      videoUrl = `https://youtu.be/${videoId}`

      searchInfo = {
        videoId,
        title: '',
        url: videoUrl,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      }
    } else {
      const results = await searchYT1Z(query)

      if (!results?.length) {
        await m.react("✖️")
        return m.reply(`${e} No se encontraron resultados en YT1Z.`)
      }

      searchInfo = results[0]
      videoUrl = searchInfo.url
    }

    const isAudio = [
      ...docAudio,
      ...normalAudio
    ].includes(command)

    const sendDoc =
      docAudio.includes(command) ||
      docVideo.includes(command)

    const format = isAudio
      ? 'mp3'
      : 'mp4-any'

    const data = await getDownload(videoUrl, format)

    if (!data?.link) {
      await m.react("✖️")
      return m.reply(
        `${e} YT1Z recibió el video, pero no devolvió un enlace de descarga válido.`
      )
    }

    const title =
      data.title ||
      searchInfo?.title ||
      'YouTube'

    const thumbnail =
      data.thumbnail ||
      searchInfo?.thumbnail ||
      `https://i.ytimg.com/vi/${searchInfo?.videoId}/hqdefault.jpg`

    const duration =
      data.duration ||
      'No disponible'

    const author =
      data.author ||
      'YouTube'

    const durationSeconds = secondsFromDuration(duration)
    const mins = durationSeconds / 60

    const automaticDoc =
      !docAudio.includes(command) &&
      !docVideo.includes(command) &&
      mins > 20

    const finalDoc = sendDoc || automaticDoc

    const type = isAudio
      ? (finalDoc ? 'audio (doc)' : 'audio')
      : (finalDoc ? 'video (doc)' : 'video')

    const aviso = automaticDoc
      ? `\n> ‣ Se enviará como documento por superar 20 minutos.`
      : ''

    const caption = `╭──── • ────╮
> ✰ *Título:* ${title}
> ♢ *Canal:* ${author}
> ♪ *Duración:* ${duration}
> ♬ *Link:* ${videoUrl}
╰──── • ────╯

⏳ _Preparando ${type}..._${aviso}`.trim()

    await conn.sendMessage(
      m.chat,
      {
        image: {
          url: thumbnail
        },
        caption
      },
      { quoted: m }
    )

    const ext = isAudio ? 'mp3' : 'mp4'

    const mimetype = isAudio
      ? 'audio/mpeg'
      : 'video/mp4'

    const safeTitle = title
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'YouTube'

    const fileName = `${safeTitle}.${ext}`

    const msg = finalDoc
      ? {
          document: {
            url: data.link
          },
          mimetype,
          fileName
        }
      : {
          [isAudio ? 'audio' : 'video']: {
            url: data.link
          },
          mimetype,
          fileName,
          ptt: false
        }

    await conn.sendMessage(
      m.chat,
      msg,
      { quoted: m }
    )

    await m.react("✨")

  } catch (err) {
    await m.react("✖️")
    return m.reply(
      `${e} No se pudo procesar la descarga desde YT1Z, intenta nuevamente.`
    )
  }
}

handler.command = [
  'play', 'yta', 'mp3', 'ytmp3', 'playaudio',
  'play3', 'ytadoc', 'mp3doc', 'ytmp3doc',
  'play2', 'ytv', 'mp4', 'ytmp4', 'playvid',
  'play4', 'ytvdoc', 'mp4doc', 'ytmp4doc'
]

handler.group = true

export default handler
