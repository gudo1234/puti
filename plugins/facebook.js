import fetch from "node-fetch"

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

function cleanUrl(url) {
  if (!url) return null

  return String(url)
    .replace(/\\u0026/g, "&")
    .replace(/\\u003D/g, "=")
    .replace(/\\u003F/g, "?")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/\\+"/g, '"')
    .trim()
}

function decodeFacebookUrl(url) {
  let result = cleanUrl(url)

  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(result)

      if (decoded === result)
        break

      result = decoded
    } catch {
      break
    }
  }

  return result
}

function extractUrls(html) {
  const urls = new Set()

  const patterns = [
    /"(?:browser_native_hd_url|playable_url_quality_hd|hd_src)"\s*:\s*"([^"]+)"/gi,
    /"(?:browser_native_sd_url|playable_url|sd_src)"\s*:\s*"([^"]+)"/gi,
    /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/gi
  ]

  for (const regex of patterns) {
    for (const match of html.matchAll(regex)) {
      const url = decodeFacebookUrl(match[1])

      if (
        url &&
        /^https?:\/\//i.test(url)
      ) {
        urls.add(url)
      }
    }
  }

  return [...urls]
}

function extractImageUrls(html) {
  const urls = new Set()

  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
    /"(?:image|thumbnail_url|display_url)"\s*:\s*"([^"]+)"/gi
  ]

  for (const regex of patterns) {
    for (const match of html.matchAll(regex)) {
      const url = decodeFacebookUrl(match[1])

      if (
        url &&
        /^https?:\/\//i.test(url)
      ) {
        urls.add(url)
      }
    }
  }

  return [...urls]
}

function scoreVideoUrl(url) {
  let score = 0

  if (/hd/i.test(url))
    score += 100

  if (/quality_hd/i.test(url))
    score += 100

  if (/browser_native_hd_url/i.test(url))
    score += 100

  if (/playable_url_quality_hd/i.test(url))
    score += 100

  if (/720|1080|2160/i.test(url))
    score += 50

  if (/fbcdn\.net/i.test(url))
    score += 20

  return score
}

function getBestVideo(urls) {
  if (!urls.length)
    return null

  return [...urls].sort(
    (a, b) =>
      scoreVideoUrl(b) -
      scoreVideoUrl(a)
  )[0]
}

async function fetchFacebookPage(url, mobile = true) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": mobile
        ? USER_AGENT
        : DESKTOP_UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: "https://www.facebook.com/"
    },
    redirect: "follow"
  })

  if (!response.ok) {
    throw new Error(
      `Facebook HTTP ${response.status}`
    )
  }

  return {
    html: await response.text(),
    finalUrl: response.url
  }
}

async function getFacebookPage(url) {
  const attempts = []

  try {
    attempts.push(
      await fetchFacebookPage(url, true)
    )
  } catch (error) {
    console.warn(
      "[FB MOBILE]",
      error.message
    )
  }

  if (
    !attempts.length ||
    (
      !extractUrls(attempts[0].html).length &&
      !extractImageUrls(attempts[0].html).length
    )
  ) {
    try {
      attempts.push(
        await fetchFacebookPage(url, false)
      )
    } catch (error) {
      console.warn(
        "[FB DESKTOP]",
        error.message
      )
    }
  }

  if (!attempts.length)
    throw new Error(
      "Facebook no permitió abrir el enlace"
    )

  return attempts
}

function extractFacebookMedia(pages) {
  const videos = new Set()
  const images = new Set()

  for (const page of pages) {
    for (const url of extractUrls(page.html))
      videos.add(cleanUrl(url))

    for (const url of extractImageUrls(page.html))
      images.add(cleanUrl(url))
  }

  const videoList = [...videos]
    .filter(Boolean)

  const imageList = [...images]
    .filter(Boolean)

  if (videoList.length) {
    return {
      type: "video",
      url: getBestVideo(videoList),
      alternatives: videoList
    }
  }

  if (imageList.length) {
    return {
      type: "image",
      url: imageList[0],
      alternatives: imageList
    }
  }

  return null
}

async function getFacebookMedia(url) {
  let target = url

  try {
    const parsed = new URL(url)

    if (
      parsed.hostname === "m.facebook.com" ||
      parsed.hostname === "mbasic.facebook.com"
    ) {
      target = url
    }

    if (
      parsed.hostname === "fb.watch"
    ) {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT
        },
        redirect: "follow"
      })

      target = response.url
    }
  } catch {}

  const pages = await getFacebookPage(target)

  let media =
    extractFacebookMedia(pages)

  if (media)
    return media

  for (const page of pages) {
    const finalUrl = page.finalUrl

    if (
      finalUrl &&
      finalUrl !== target
    ) {
      try {
        const extra =
          await getFacebookPage(finalUrl)

        media =
          extractFacebookMedia(extra)

        if (media)
          return media
      } catch {}
    }
  }

  throw new Error(
    "No se encontró un video o imagen pública en Facebook"
  )
}

async function downloadFacebookMedia(url, referer) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "*/*",
      Referer:
        referer ||
        "https://www.facebook.com/"
    },
    redirect: "follow"
  })

  if (!response.ok) {
    throw new Error(
      `CDN Facebook HTTP ${response.status}`
    )
  }

  const contentType =
    response.headers.get("content-type") || ""

  const buffer = Buffer.from(
    await response.arrayBuffer()
  )

  if (!buffer.length)
    throw new Error(
      "Facebook devolvió un archivo vacío"
    )

  return {
    buffer,
    contentType
  }
}

function isFacebookUrl(url) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    return (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.watch" ||
      host.endsWith(".fb.watch")
    )
  } catch {
    return false
  }
}

const handler = async (m, { text, conn, args }) => {
  const url = args[0] || text?.trim()

  if (!url) {
    return conn.reply(
      m.chat,
      `${e} Por favor, ingresa un enlace de Facebook.\n\n` +
      `Ejemplo:\n` +
      `.fb https://www.facebook.com/reel/XXXXXXXX/`,
      m
    )
  }

  if (!isFacebookUrl(url)) {
    return conn.reply(
      m.chat,
      `${e} El enlace no parece ser de Facebook.`,
      m
    )
  }

  try {
    await m.react("🕒")

    const media =
      await getFacebookMedia(url)

    const downloaded =
      await downloadFacebookMedia(
        media.url,
        url
      )

    if (
      media.type === "video" ||
      /video/i.test(downloaded.contentType) ||
      /\.mp4(?:[?#]|$)/i.test(media.url)
    ) {
      await conn.sendMessage(
        m.chat,
        {
          video: downloaded.buffer,
          caption:
            `${e} *Video de Facebook*`
        },
        { quoted: m }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        {
          image: downloaded.buffer,
          caption:
            `${e} *Imagen de Facebook*`
        },
        { quoted: m }
      )
    }

    await m.react("✅")

  } catch (error) {
    console.error(
      "[FACEBOOK ERROR]",
      error
    )

    await m.react("❌")

    return conn.reply(
      m.chat,
      `${e} *No se pudo descargar el contenido de Facebook:*\n${error.message}`,
      m
    )
  }
}

handler.help = ["facebook"]
handler.tags = ["descargas"]
handler.command = [
  "facebook",
  "fb"
]
handler.group = true

export default handler
