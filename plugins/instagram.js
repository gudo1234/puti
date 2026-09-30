import fetch from "node-fetch"

const IG_HOST = "https://www.instagram.com"
const IG_APP_ID = "936619743392459"
const IG_DOC_ID = "27128499623469141"

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

function cleanUrl(url) {
  if (!url) return null

  return String(url)
    .replace(/\\u0026/g, "&")
    .replace(/\\u003D/g, "=")
    .replace(/\\u003F/g, "?")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .trim()
}

function getShortcode(url) {
  try {
    const parsed = new URL(url)

    if (
      !parsed.hostname.includes("instagram.com") &&
      !parsed.hostname.includes("instagr.am")
    ) {
      return null
    }

    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)

    const typeIndex = parts.findIndex(
      x =>
        x === "p" ||
        x === "reel" ||
        x === "reels" ||
        x === "tv"
    )

    if (typeIndex === -1 || !parts[typeIndex + 1])
      return null

    return parts[typeIndex + 1]
  } catch {
    return null
  }
}

async function getInstagramSession() {
  const response = await fetch(`${IG_HOST}/`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    },
    redirect: "follow"
  })

  const rawCookies =
    response.headers.raw()["set-cookie"] || []

  const cookies = []

  for (const cookie of rawCookies) {
    const value = cookie.split(";")[0]

    if (
      value.startsWith("csrftoken=") ||
      value.startsWith("mid=") ||
      value.startsWith("ig_did=")
    ) {
      cookies.push(value)
    }
  }

  const csrf =
    cookies
      .find(x => x.startsWith("csrftoken="))
      ?.split("=")
      .slice(1)
      .join("=") || ""

  return {
    csrf,
    cookie: cookies.join("; ")
  }
}

async function instagramGraphQL(shortcode) {
  const session = await getInstagramSession()

  const variables = {
    shortcode,
    __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider:
      false
  }

  const body =
    `doc_id=${encodeURIComponent(IG_DOC_ID)}` +
    `&variables=${encodeURIComponent(JSON.stringify(variables))}`

  const response = await fetch(
    `${IG_HOST}/graphql/query`,
    {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "*/*",
        "Content-Type":
          "application/x-www-form-urlencoded",
        "X-IG-App-ID": IG_APP_ID,
        "X-CSRFToken": session.csrf,
        "X-Requested-With": "XMLHttpRequest",
        Origin: IG_HOST,
        Referer: `${IG_HOST}/`,
        Cookie: session.cookie
      },
      body
    }
  )

  if (!response.ok)
    throw new Error(
      `Instagram GraphQL HTTP ${response.status}`
    )

  const json = await response.json()

  const data =
    json?.data
      ?.xdt_api__v1__media__shortcode__web_info

  if (!data?.items?.length)
    throw new Error(
      json?.errors?.[0]?.message ||
      "Instagram no devolvió información del contenido"
    )

  return data.items[0]
}

function getBestImage(media) {
  const candidates =
    media?.image_versions2?.candidates

  if (!Array.isArray(candidates) || !candidates.length)
    return null

  return (
    [...candidates]
      .sort(
        (a, b) =>
          (b.width || 0) * (b.height || 0) -
          (a.width || 0) * (a.height || 0)
      )
      .map(x => cleanUrl(x.url))
      .find(Boolean) || null
  )
}

function getBestVideo(media) {
  const videos = media?.video_versions

  if (Array.isArray(videos) && videos.length) {
    return (
      [...videos]
        .sort(
          (a, b) =>
            (b.width || 0) * (b.height || 0) -
            (a.width || 0) * (a.height || 0)
        )
        .map(x => cleanUrl(x.url))
        .find(Boolean) || null
    )
  }

  return getVideoFromDash(media?.video_dash_manifest)
}

function getVideoFromDash(manifest) {
  if (!manifest) return null

  const xml = String(manifest)
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")

  const urls = []

  const regex =
    /<BaseURL[^>]*>([\s\S]*?)<\/BaseURL>/gi

  for (const match of xml.matchAll(regex)) {
    const url = cleanUrl(
      match[1]
        .replace(/<!\[CDATA\[/g, "")
        .replace(/\]\]>/g, "")
    )

    if (
      url &&
      /^https?:\/\//i.test(url)
    ) {
      urls.push(url)
    }
  }

  return urls[0] || null
}

function extractMediaFromItem(item) {
  const results = []

  const carousel =
    Array.isArray(item?.carousel_media)
      ? item.carousel_media
      : null

  if (carousel?.length) {
    for (const media of carousel) {
      const video = getBestVideo(media)

      if (video) {
        results.push({
          type: "video",
          url: video
        })

        continue
      }

      const image = getBestImage(media)

      if (image) {
        results.push({
          type: "image",
          url: image
        })
      }
    }

    return results
  }

  const video = getBestVideo(item)

  if (video) {
    results.push({
      type: "video",
      url: video
    })

    return results
  }

  const image = getBestImage(item)

  if (image) {
    results.push({
      type: "image",
      url: image
    })
  }

  return results
}

async function instagramHTML(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    },
    redirect: "follow"
  })

  if (!response.ok)
    throw new Error(
      `Instagram HTML HTTP ${response.status}`
    )

  const html = await response.text()

  const results = []

  const videoPatterns = [
    /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)/i,
    /"video_url":"([^"]+)"/i,
    /"video_versions":\s*\[\s*\{\s*"type":\d+,\s*"url":"([^"]+)"/i
  ]

  for (const pattern of videoPatterns) {
    const match = html.match(pattern)

    if (match?.[1]) {
      const video = cleanUrl(match[1])

      if (
        video &&
        /^https?:\/\//i.test(video)
      ) {
        results.push({
          type: "video",
          url: video
        })

        break
      }
    }
  }

  if (results.length)
    return results

  const imagePatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i,
    /"display_url":"([^"]+)"/i,
    /"image_versions2":\s*\{\s*"candidates":\s*\[\s*\{\s*"url":"([^"]+)"/i
  ]

  for (const pattern of imagePatterns) {
    const match = html.match(pattern)

    if (match?.[1]) {
      const image = cleanUrl(match[1])

      if (
        image &&
        /^https?:\/\//i.test(image)
      ) {
        results.push({
          type: "image",
          url: image
        })

        break
      }
    }
  }

  return results
}

async function getInstagramMedia(url) {
  const shortcode = getShortcode(url)

  if (!shortcode)
    throw new Error(
      "El enlace no parece ser un Post, Reel o video válido de Instagram"
    )

  try {
    const item =
      await instagramGraphQL(shortcode)

    const media =
      extractMediaFromItem(item)

    if (media.length)
      return media
  } catch (error) {
    console.warn(
      "[IG GRAPHQL]",
      error.message
    )
  }

  const fallback =
    await instagramHTML(url)

  if (fallback.length)
    return fallback

  throw new Error(
    "Instagram no permitió obtener el contenido"
  )
}

async function downloadMedia(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "*/*",
      Referer: IG_HOST + "/"
    },
    redirect: "follow"
  })

  if (!response.ok)
    throw new Error(
      `CDN Instagram HTTP ${response.status}`
    )

  const buffer = Buffer.from(
    await response.arrayBuffer()
  )

  if (!buffer.length)
    throw new Error(
      "Instagram devolvió un archivo vacío"
    )

  return buffer
}

const handler = async (m, { args, conn }) => {
  if (!args[0]) {
    return conn.reply(
      m.chat,
      `${e} Por favor, ingresa un enlace de Instagram.\n\n` +
      `Ejemplo:\n` +
      `.ig https://www.instagram.com/reel/XXXXXXXXXXX/`,
      m
    )
  }

  const url = args[0].trim()

  if (!/^https?:\/\/(?:www\.)?instagram\.com\//i.test(url)) {
    return conn.reply(
      m.chat,
      `${e} El enlace no parece ser de Instagram.`,
      m
    )
  }

  try {
    await m.react("🕒")

    const media =
      await getInstagramMedia(url)

    if (!media.length)
      throw new Error(
        "No se encontró ningún medio"
      )

    let enviados = 0

    for (const item of media) {
      try {
        const buffer =
          await downloadMedia(item.url)

        if (item.type === "video") {
          await conn.sendMessage(
            m.chat,
            {
              video: buffer,
              caption:
                `${e} *Video de Instagram*`
            },
            { quoted: m }
          )
        } else {
          await conn.sendMessage(
            m.chat,
            {
              image: buffer,
              caption:
                `${e} *Imagen de Instagram*`
            },
            { quoted: m }
          )
        }

        enviados++

      } catch (error) {
        console.warn(
          "[IG DOWNLOAD]",
          error.message
        )
      }
    }

    if (!enviados)
      throw new Error(
        "No fue posible descargar el contenido desde el CDN de Instagram"
      )

    await m.react("✅")

  } catch (error) {
    console.error(
      "[INSTAGRAM ERROR]",
      error
    )

    await m.react("❌")

    return conn.reply(
      m.chat,
      `${msm} Ocurrió un error al descargar el contenido de Instagram.\n\n` +
      `${error.message}`,
      m
    )
  }
}

handler.help = ["instagram"]
handler.tags = ["descargas"]
handler.command = [
  "instagram",
  "ig"
]
handler.group = true

export default handler
