import fetch from "node-fetch"

const YT1Z = "https://yt1z.top"

const docAudio = ['play3', 'ytadoc', 'mp3doc', 'ytmp3doc']
const docVideo = ['play4', 'ytvdoc', 'mp4doc', 'ytmp4doc']
const normalAudio = ['play', 'yta', 'mp3', 'ytmp3', 'playaudio']
const normalVideo = ['play2', 'ytv', 'mp4', 'ytmp4', 'playvid']

const safeFetch = async (url, options = {}, timeout = 30000) => {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        ...(options.headers || {})
      }
    })

    clearTimeout(timer)

    if (!res.ok) return null
    return res
  } catch {
    return null
  }
}

const htmlDecode = (str = '') => {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

const cleanText = (str = '') => {
  return htmlDecode(str)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const extractAttr = (html, tag, attr, value) => {
  const regex = new RegExp(
    `<${tag}[^>]*${attr}\\s*=\\s*["']${value}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
    'i'
  )

  const match = html.match(regex)
  return match ? cleanText(match[1]) : ''
}

const extractMeta = (html, key) => {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i'
  )

  const reverse = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
    'i'
  )

  const match = html.match(regex) || html.match(reverse)
  return match ? htmlDecode(match[1]) : ''
}

const extractDownloadLinks = html => {
  const links = []

  const patterns = [
    /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?(?:download|mp3|mp4|1080|720|4k|2160p)[\s\S]*?<\/a>/gi,
    /<a[^>]+href=["']([^"']+)["'][^>]*download[^>]*>/gi,
    /<a[^>]+download[^>]+href=["']([^"']+)["'][^>]*>/gi
  ]

  for (const regex of patterns) {
    let match

    while ((match = regex.exec(html)) !== null) {
      let url = htmlDecode(match[1])

      if (!url) continue

      if (url.startsWith('/')) {
        url = YT1Z + url
      }

      if (!/^https?:\/\//i.test(url)) continue

      if (!links.includes(url)) {
        links.push(url)
      }
    }
  }

  const generic = /href=["'](https?:\/\/[^"']+)["']/gi

  let match
  while ((match = generic.exec(html)) !== null) {
    const url = htmlDecode(match[1])

    if (
      /\.(mp3|mp4)(?:\?|$)/i.test(url) ||
      /download/i.test(url)
    ) {
      if (!links.includes(url)) {
        links.push(url)
      }
    }
  }

  return links
}

const getVideoId = text => {
  const match = String(text).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )

  return match?.[1] || null
}

const searchYT1Z = async query => {
  const res = await safeFetch(`${YT1Z}/s/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': `${YT1Z}/`
    },
    body: new URLSearchParams({
      search: query
    }).toString()
  }, 30000)

  if (!res) return null

  try {
    const raw = await res.text()

    const start = raw.indexOf('[')
    if (start === -1) return null

    const json = JSON.parse(raw.slice(start))

    if (!Array.isArray(json) || !json.length) {
      return null
    }

    return json
      .filter(x => x?.videoId)
      .map(x => ({
        videoId: x.videoId,
        title: cleanText(x.title || ''),
        url: `https://youtu.be/${x.videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${x.videoId}/hqdefault.jpg`
      }))
  } catch {
    return null
  }
}

const processYT1Z = async (url, format) => {
  const params = new URLSearchParams({
    url,
    lng: 'en',
    t: '',
    fmt: format
  })

  const res = await safeFetch(
    `${YT1Z}/d/?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Referer': `${YT1Z}/`
      }
    },
    120000
  )

  if (!res) return null

  try {
    const html = await res.text()

    if (!html || html.length < 100) {
      return null
    }

    const title =
      extractMeta(html, 'og:title') ||
      extractAttr(html, 'h1', 'class', 'dl-title') ||
      extractAttr(html, 'h2', 'class', 'dl-title') ||
      extractAttr(html, 'div', 'class', 'dl-title') ||
      ''

    const description =
      extractMeta(html, 'og:description') || ''

    const thumbnail =
      extractMeta(html, 'og:image') || ''

    const links = extractDownloadLinks(html)

    if (!links.length) {
      return {
        html,
        title: cleanText(title),
        description: cleanText(description),
        thumbnail,
        links: []
      }
    }

    const preferred = links.find(link => {
      if (format === 'mp3') {
        return /\.mp3(?:\?|$)/i.test(link)
      }

      return /\.mp4(?:\?|$)/i.test(link)
    })

    return {
      html,
      title: cleanText(title),
      description: cleanText(description),
      thumbnail,
      links,
      link: preferred || links[0]
    }
  } catch {
    return null
  }
}

const parseInfoFromHTML = html => {
  const title =
    extractMeta(html, 'og:title') ||
    extractAttr(html, 'h1', 'class', 'dl-title') ||
    extractAttr(html, 'h2', 'class', 'dl-title') ||
    ''

  const thumbnail =
    extractMeta(html, 'og:image') || ''

  const author =
    extractAttr(html, 'div', 'class', 'dl-author') ||
    extractAttr(html, 'span', 'class', 'dl-author') ||
    ''

  const duration =
    extractAttr(html, 'div', 'class', 'dl-duration') ||
    extractAttr(html, 'span', 'class', 'dl-duration') ||
    ''

  return {
    title: cleanText(title),
    thumbnail,
    author: cleanText(author),
    duration: cleanText(duration)
  }
}

const secondsFromDuration = duration => {
  if (!duration) return 0

  const parts = duration
    .split(':')
    .map(x => Number(x))
    .filter(x => Number.isFinite(x))

  if (!parts.length) return 0

  return parts.reduce((total, value) => total * 60 + value, 0)
}

const getDownload = async (url, format) => {
  const result = await processYT1Z(url, format)

  if (!result?.link) {
    return null
  }

  const info = parseInfoFromHTML(result.html)

  return {
    link: result.link,
    title: result.title || info.title || 'YouTube',
    thumbnail: result.thumbnail || info.thumbnail,
    author: info.author,
    duration: info.duration
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

    return m.reply(`${e} Ingresa _texto_ o _enlace_ de YouTube para descargar el *${tipo}.*`)
  }

  await m.react("🕒")

  try {
    const query = args.join(" ")

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
      : 'mp4-hd'

    const data = await getDownload(videoUrl, format)

    if (!data?.link) {
      await m.react("✖️")
      return m.reply(`${e} YT1Z no pudo generar el enlace de descarga.`)
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
    m.reply(caption)

    /*await conn.sendMessage(
      m.chat,
      {
        text: caption,
        footer: textbot,
        contextInfo: {
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: channelRD.id,
            newsletterName: channelRD.name,
            serverMessageId: -1
          },
          externalAdReply: {
            title: '🎧 YOUTUBE EXTRACTOR',
            body: textbot,
            thumbnailUrl: thumbnail,
            sourceUrl: videoUrl,
            mediaType: 1
          }
        }
      },
      { quoted: m }
    )*/

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
          document: { url: data.link },
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
    return m.reply(`${e} No se pudo procesar la descarga desde YT1Z, intenta nuevamente.`)
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
