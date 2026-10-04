import fetch from "node-fetch"

const YT1Z = "https://yt1z.top"

const docAudio = ['play3', 'ytadoc', 'mp3doc', 'ytmp3doc']
const docVideo = ['play4', 'ytvdoc', 'mp4doc', 'ytmp4doc']
const normalAudio = ['play', 'yta', 'mp3', 'ytmp3', 'playaudio']
const normalVideo = ['play2', 'ytv', 'mp4', 'ytmp4', 'playvid']

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

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
      signal: controller.signal,
      redirect: 'follow'
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
      return Number.isFinite(code)
        ? String.fromCharCode(code)
        : _
    })
}

const decodeJs = (str = '') => {
  let value = String(str)

  for (let i = 0; i < 3; i++) {
    const previous = value

    value = value
      .replace(/\\u0026/gi, '&')
      .replace(/\\u003d/gi, '=')
      .replace(/\\u002f/gi, '/')
      .replace(/\\u0025/gi, '%')
      .replace(/\\x26/gi, '&')
      .replace(/\\x3d/gi, '=')
      .replace(/\\x2f/gi, '/')
      .replace(/\\\//g, '/')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')

    if (value === previous) break
  }

  return value
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

  let url = decodeJs(
    htmlDecode(String(value).trim())
  )

  url = url
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\\u0026/gi, '&')
    .replace(/&amp;/gi, '&')
    .trim()

  if (!url) return ''

  if (/^(javascript|data|mailto|tel):/i.test(url)) {
    return ''
  }

  if (url.startsWith('//')) {
    return `https:${url}`
  }

  if (url.startsWith('/')) {
    return new URL(url, YT1Z).href
  }

  if (/^https?:\/\//i.test(url)) {
    return url
  }

  try {
    return new URL(url, YT1Z).href
  } catch {
    return ''
  }
}

const isMediaUrl = url => {
  if (!url) return false

  const value = String(url).toLowerCase()

  if (
    /^(javascript|data|mailto|tel):/i.test(value)
  ) {
    return false
  }

  if (
    /\.(?:css|js|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf)(?:[?#]|$)/i.test(value)
  ) {
    return false
  }

  if (
    /youtube\.com\/(?:watch|shorts|live|embed)/i.test(value) ||
    /youtu\.be\//i.test(value)
  ) {
    return false
  }

  return true
}

const getVideoId = text => {
  const value = String(text || '').trim()

  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/i,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  ]

  for (const regex of patterns) {
    const match = value.match(regex)

    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

const searchYT1Z = async query => {
  const res = await safeFetch(
    `${YT1Z}/s/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': YT1Z,
        'Referer': `${YT1Z}/`
      },
      body: new URLSearchParams({
        search: query
      }).toString()
    },
    45000
  )

  if (!res) return null

  try {
    const raw = await res.text()

    if (!raw) return null

    try {
      const direct = JSON.parse(raw)

      if (Array.isArray(direct)) {
        return direct
          .filter(item => item?.videoId)
          .map(item => {
            const videoId = String(item.videoId).trim()

            return {
              videoId,
              title: cleanText(item.title || ''),
              url: `https://youtu.be/${videoId}`,
              thumbnail:
                `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
            }
          })
      }
    } catch {}

    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')

    if (start === -1 || end === -1 || end < start) {
      return null
    }

    const json = JSON.parse(
      raw.slice(start, end + 1)
    )

    if (!Array.isArray(json)) {
      return null
    }

    return json
      .filter(item => item?.videoId)
      .map(item => {
        const videoId = String(item.videoId).trim()

        return {
          videoId,
          title: cleanText(item.title || ''),
          url: `https://youtu.be/${videoId}`,
          thumbnail:
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
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

  return match
    ? cleanText(match[1])
    : ''
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

    if (!url || !isMediaUrl(url)) {
      return
    }

    const normalized = url
      .replace(/&amp;/gi, '&')
      .trim()

    if (
      candidates.some(
        item => item.url === normalized
      )
    ) {
      return
    }

    candidates.push({
      url: normalized,
      context: cleanText(context)
    })
  }

  let match

  const anchorRegex =
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi

  while ((match = anchorRegex.exec(html)) !== null) {
    const attrs = match[1] || ''
    const body = match[2] || ''

    const href =
      attrs.match(
        /\bhref\s*=\s*["']([^"']+)["']/i
      )?.[1] ||
      attrs.match(
        /\bhref\s*=\s*([^\s>]+)/i
      )?.[1]

    const dataUrl =
      attrs.match(
        /\bdata-(?:url|href|download|file)\s*=\s*["']([^"']+)["']/i
      )?.[1]

    const text = cleanText(body)
    const context = `${attrs} ${text}`

    add(href, context)
    add(dataUrl, context)
  }

  const attrRegex =
    /\b(?:href|src|data-url|data-href|data-download|data-file|data-link)\s*=\s*["']([^"']+)["']/gi

  while ((match = attrRegex.exec(html)) !== null) {
    add(match[1], match[0])
  }

  const onclickRegex =
    /\bonclick\s*=\s*["']([^"']+)["']/gi

  while ((match = onclickRegex.exec(html)) !== null) {
    const code = decodeJs(
      htmlDecode(match[1])
    )

    const urls =
      code.match(
        /https?:\/\/[^'"`\s)]+|\/[^'"`\s)]+/gi
      ) || []

    for (const url of urls) {
      add(url, code)
    }
  }

  const jsPatterns = [
    /(?:window\.open|location(?:\.href)?|window\.location(?:\.href)?)\s*\(\s*["'`]([^"'`]+)["'`]/gi,
    /(?:url|downloadUrl|download_url|file|fileUrl|mediaUrl|href|src)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi
  ]

  for (const regex of jsPatterns) {
    while ((match = regex.exec(html)) !== null) {
      add(match[1], match[0])
    }
  }

  const quotedUrlRegex =
    /["'`]((?:https?:\/\/|\/\/|\/)[^"'`<>\\\s]+)["'`]/gi

  while ((match = quotedUrlRegex.exec(html)) !== null) {
    add(match[1], 'quoted-url')
  }

  const absoluteRegex =
    /https?:\/\/[^\s"'<>\\]+/gi

  while ((match = absoluteRegex.exec(html)) !== null) {
    add(match[0], 'absolute-url')
  }

  return candidates
}

const scoreDownloadCandidate = (
  candidate,
  format
) => {
  const url = candidate.url.toLowerCase()
  const context =
    candidate.context.toLowerCase()

  let score = 0

  const isAudio = format === 'mp3'

  if (isAudio) {
    if (/\.mp3(?:[?#]|$)/i.test(url)) {
      score += 150
    }

    if (
      /audio|mp3|music|sound|convert/i.test(context)
    ) {
      score += 80
    }

    if (
      /\/(?:mp3|audio|download|dl)\b/i.test(url)
    ) {
      score += 60
    }
  } else {
    if (/\.mp4(?:[?#]|$)/i.test(url)) {
      score += 150
    }

    if (
      /video|mp4|download|convert/i.test(context)
    ) {
      score += 80
    }

    if (
      /\/(?:mp4|video|download|dl)\b/i.test(url)
    ) {
      score += 60
    }

    if (/2160|4k/.test(context)) {
      score += 15
    }

    if (/1080|full\s*hd/.test(context)) {
      score += 12
    }

    if (/720|hd/.test(context)) {
      score += 8
    }
  }

  if (/download|get\s*(file|video|audio)/i.test(context)) {
    score += 60
  }

  if (
    /facebook|instagram|twitter|tiktok|youtube\.com\/(?:watch|shorts)/i.test(
      url
    )
  ) {
    score -= 200
  }

  if (
    /\.(?:css|js|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2)(?:[?#]|$)/i.test(
      url
    )
  ) {
    score -= 300
  }

  return score
}

const extractDownloadLink = (
  html,
  format
) => {
  const candidates =
    extractCandidates(html)

  if (!candidates.length) {
    return null
  }

  const ranked = candidates
    .map(candidate => ({
      ...candidate,
      score:
        scoreDownloadCandidate(
          candidate,
          format
        )
    }))
    .sort(
      (a, b) => b.score - a.score
    )

  const valid = ranked.find(
    candidate =>
      candidate.score > 0 &&
      isMediaUrl(candidate.url)
  )

  if (valid) {
    return valid.url
  }

  /*
   * Último intento:
   * si YT1Z devuelve una URL válida pero
   * no tiene extensión ni texto "download",
   * no la descartamos automáticamente.
   */
  const fallback = ranked.find(
    candidate =>
      isMediaUrl(candidate.url) &&
      !/yt1z\.top\/(?:s|d)\/?/i.test(
        candidate.url
      )
  )

  return fallback?.url || null
}

const processYT1Z = async (
  url,
  format
) => {
  const params =
    new URLSearchParams({
      url,
      lng: 'en',
      t: '',
      fmt: format
    })

  const endpoint =
    `${YT1Z}/d/?${params.toString()}`

  const res = await safeFetch(
    endpoint,
    {
      method: 'GET',
      headers: {
        'Referer': `${YT1Z}/`,
        'Accept':
          'text/html,application/xhtml+xml,application/json,*/*;q=0.8'
      }
    },
    180000
  )

  if (!res) {
    return null
  }

  try {
    const html =
      await res.text()

    if (!html || html.length < 20) {
      return null
    }

    let json = null

    try {
      json = JSON.parse(html)
    } catch {}

    if (json) {
      const directLink =
        json.url ||
        json.download_url ||
        json.downloadUrl ||
        json.link ||
        json.file ||
        json.fileUrl

      if (
        directLink &&
        isMediaUrl(directLink)
      ) {
        return {
          html,
          link: absoluteUrl(directLink),
          title:
            json.title ||
            json.name ||
            '',
          thumbnail:
            json.thumbnail ||
            json.thumb ||
            '',
          author:
            json.author ||
            json.channel ||
            '',
          duration:
            json.duration ||
            ''
        }
      }
    }

    const info =
      extractInfo(html)

    const link =
      extractDownloadLink(
        html,
        format
      )

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

  const clean =
    String(duration)
      .replace(/[^\d:]/g, '')
      .trim()

  if (!clean) return 0

  const parts =
    clean
      .split(':')
      .map(Number)

  if (
    !parts.length ||
    parts.some(
      value =>
        !Number.isFinite(value)
    )
  ) {
    return 0
  }

  return parts.reduce(
    (total, value) =>
      total * 60 + value,
    0
  )
}

const getDownload = async (
  url,
  format
) => {
  const result =
    await processYT1Z(
      url,
      format
    )

  if (!result?.link) {
    return null
  }

  return {
    link: result.link,
    title:
      result.title ||
      'YouTube',
    thumbnail:
      result.thumbnail ||
      '',
    author:
      result.author ||
      '',
    duration:
      result.duration ||
      ''
  }
}

const handler = async (
  m,
  {
    conn,
    text,
    usedPrefix,
    command,
    args
  }
) => {
  if (!text) {
    const tipo =
      normalAudio.includes(command)
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
    const query =
      args.join(" ").trim()

    const videoId =
      getVideoId(query)

    let videoUrl = ''
    let searchInfo = null

    if (videoId) {
      videoUrl =
        `https://youtu.be/${videoId}`

      searchInfo = {
        videoId,
        title: '',
        url: videoUrl,
        thumbnail:
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      }
    } else {
      const results =
        await searchYT1Z(query)

      if (!results?.length) {
        await m.react("✖️")

        return m.reply(
          `${e} No se encontraron resultados en YT1Z.`
        )
      }

      searchInfo =
        results[0]

      videoUrl =
        searchInfo.url
    }

    const isAudio = [
      ...docAudio,
      ...normalAudio
    ].includes(command)

    const sendDoc =
      docAudio.includes(command) ||
      docVideo.includes(command)

    const format =
      isAudio
        ? 'mp3'
        : 'mp4-any'

    const data =
      await getDownload(
        videoUrl,
        format
      )

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

    const durationSeconds =
      secondsFromDuration(
        duration
      )

    const mins =
      durationSeconds / 60

    const automaticDoc =
      !docAudio.includes(command) &&
      !docVideo.includes(command) &&
      mins > 20

    const finalDoc =
      sendDoc ||
      automaticDoc

    const type =
      isAudio
        ? (
            finalDoc
              ? 'audio (doc)'
              : 'audio'
          )
        : (
            finalDoc
              ? 'video (doc)'
              : 'video'
          )

    const aviso =
      automaticDoc
        ? `\n> ‣ Se enviará como documento por superar 20 minutos.`
        : ''

    const caption =
      `╭──── • ────╮
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
      {
        quoted: m
      }
    )

    const ext =
      isAudio
        ? 'mp3'
        : 'mp4'

    const mimetype =
      isAudio
        ? 'audio/mpeg'
        : 'video/mp4'

    const safeTitle =
      title
        .replace(
          /[\\/:*?"<>|]/g,
          ''
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim()
        .slice(0, 100) ||
      'YouTube'

    const fileName =
      `${safeTitle}.${ext}`

    const msg =
      finalDoc
        ? {
            document: {
              url: data.link
            },
            mimetype,
            fileName
          }
        : {
            [isAudio
              ? 'audio'
              : 'video']: {
              url: data.link
            },
            mimetype,
            fileName,
            ptt: false
          }

    await conn.sendMessage(
      m.chat,
      msg,
      {
        quoted: m
      }
    )

    await m.react("✨")

  } catch (err) {
    console.error(
      '[YT1Z]',
      err?.message || err
    )

    await m.react("✖️")

    return m.reply(
      `${e} No se pudo procesar la descarga desde YT1Z, intenta nuevamente.`
    )
  }
}

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
