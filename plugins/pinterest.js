import fetch from "node-fetch"
import {
  generateWAMessageFromContent,
  generateWAMessage,
  delay
} from "@whiskeysockets/baileys"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

const PINTEREST_HOSTS = [
  "https://www.pinterest.com",
  "https://id.pinterest.com"
]

async function sendAlbumMessage(conn, jid, medias, options = {}) {
  if (!Array.isArray(medias) || medias.length < 2)
    throw new RangeError("Se requieren mínimo 2 imágenes")

  const caption = options.caption || ""
  const wait = !isNaN(options.delay) ? options.delay : 500

  const album = generateWAMessageFromContent(
    jid,
    {
      albumMessage: {
        expectedImageCount: medias.length,
        expectedVideoCount: 0,
        ...(options.quoted
          ? {
              contextInfo: {
                remoteJid: options.quoted.key.remoteJid,
                fromMe: options.quoted.key.fromMe,
                stanzaId: options.quoted.key.id,
                participant:
                  options.quoted.key.participant ||
                  options.quoted.key.remoteJid,
                quotedMessage: options.quoted.message
              }
            }
          : {})
      }
    },
    {}
  )

  await conn.relayMessage(album.key.remoteJid, album.message, {
    messageId: album.key.id
  })

  for (let i = 0; i < medias.length; i++) {
    const msg = await generateWAMessage(
      album.key.remoteJid,
      {
        image: medias[i],
        ...(i === 0 ? { caption } : {})
      },
      { upload: conn.waUploadToServer }
    )

    msg.message.messageContextInfo = {
      messageAssociation: {
        associationType: 1,
        parentMessageKey: album.key
      }
    }

    await conn.relayMessage(msg.key.remoteJid, msg.message, {
      messageId: msg.key.id
    })

    await delay(wait)
  }
}

function cleanUrl(url) {
  if (!url) return null

  return String(url)
    .replace(/\\u002F/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003D/gi, "=")
    .replace(/\\u003F/gi, "?")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/\\+"/g, '"')
    .trim()
}

function isPinterestImage(url) {
  if (!url) return false

  return /^https?:\/\/[^"'\\ ]*pinimg\.com\/(?:originals|736x|564x|474x|400x|236x|170x|60x60)\//i.test(
    cleanUrl(url)
  )
}

function isPinterestVideo(url) {
  if (!url) return false

  const value = cleanUrl(url)

  return (
    /pinimg\.com\/videos\//i.test(value) &&
    /\.(?:mp4|m4v)(?:[?#&]|$)/i.test(value)
  )
}

function originalPinterestUrl(url) {
  url = cleanUrl(url)

  if (!url) return null

  try {
    const parsed = new URL(url)

    if (!parsed.hostname.includes("pinimg.com"))
      return url

    parsed.pathname = parsed.pathname.replace(
      /^\/(?:736x|564x|474x|400x|236x|170x|60x60)\//i,
      "/originals/"
    )

    return parsed.toString()
  } catch {
    return url
  }
}

function extractUrls(text) {
  const results = new Set()

  if (!text) return []

  const decoded = cleanUrl(text)

  const regex =
    /https?:\\?\/\\?\/[^"'<>\\\s]+/gi

  for (const match of text.match(regex) || []) {
    const url = cleanUrl(match)

    if (url)
      results.add(url)
  }

  for (const match of decoded.match(regex) || []) {
    const url = cleanUrl(match)

    if (url)
      results.add(url)
  }

  return [...results]
}

function extractImageUrls(text) {
  const found = new Set()

  for (const url of extractUrls(text)) {
    if (isPinterestImage(url))
      found.add(url)
  }

  return [...found]
}

function extractVideoUrls(text) {
  const found = new Set()

  for (const url of extractUrls(text)) {
    if (isPinterestVideo(url))
      found.add(url)
  }

  return [...found]
}

async function getPinterestCookies(host) {
  const response = await fetch(`${host}/`, {
    headers: {
      "User-Agent": UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    },
    redirect: "follow"
  })

  const setCookie = response.headers.raw()["set-cookie"] || []

  const cookies = []

  for (const cookie of setCookie) {
    const value = cookie.split(";")[0]

    if (
      value.startsWith("csrftoken=") ||
      value.startsWith("_pinterest_sess=")
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
    cookie: cookies.join("; "),
    csrf
  }
}

async function pinterestInternalSearch(query, limit = 5) {
  let lastError = null

  for (const host of PINTEREST_HOSTS) {
    try {
      const auth = await getPinterestCookies(host)

      const sourceUrl =
        `/search/pins/?q=${encodeURIComponent(query)}`

      let bookmark = null
      const results = []
      const seen = new Set()

      while (results.length < limit) {
        const data = {
          options: {
            query,
            scope: "pins",
            bookmarks: bookmark ? [bookmark] : []
          },
          context: {}
        }

        const body =
          `source_url=${encodeURIComponent(sourceUrl)}` +
          `&data=${encodeURIComponent(JSON.stringify(data))}`

        const response = await fetch(
          `${host}/resource/BaseSearchResource/get/`,
          {
            method: "POST",
            headers: {
              Accept:
                "application/json, text/javascript, */*; q=0.01",
              "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",
              "User-Agent": UA,
              "X-Requested-With": "XMLHttpRequest",
              "X-CSRFToken": auth.csrf,
              "X-Pinterest-Source-Url": sourceUrl,
              Cookie: auth.cookie,
              Referer: `${host}${sourceUrl}`
            },
            body
          }
        )

        if (!response.ok)
          throw new Error(`Pinterest HTTP ${response.status}`)

        const json = await response.json()

        const resource = json?.resource_response
        const pins = resource?.data?.results

        if (!Array.isArray(pins))
          throw new Error("Pinterest no devolvió resultados válidos")

        for (const pin of pins) {
          if (!pin || typeof pin !== "object")
            continue

          const images = pin.images

          if (!images || typeof images !== "object")
            continue

          const candidates = [
            images.orig?.url,
            images["1200x"]?.url,
            images["736x"]?.url,
            images["564x"]?.url,
            images["474x"]?.url,
            images["400x"]?.url,
            images["236x"]?.url,
            images["170x"]?.url
          ]

          let image = candidates
            .map(cleanUrl)
            .find(isPinterestImage)

          if (!image)
            continue

          const original = originalPinterestUrl(image)

          if (
            original &&
            !seen.has(original)
          ) {
            seen.add(original)
            results.push(original)
          }

          if (results.length >= limit)
            break
        }

        bookmark = resource?.bookmark

        if (
          !bookmark ||
          pins.length === 0 ||
          results.length >= limit
        ) {
          break
        }
      }

      if (results.length)
        return results.slice(0, limit)

      throw new Error("Pinterest no encontró imágenes")
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error("Falló la búsqueda interna de Pinterest")
}

async function pinterestHtmlSearch(query, limit = 5) {
  const url =
    `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`

  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      Referer: "https://www.pinterest.com/"
    },
    redirect: "follow"
  })

  if (!response.ok)
    throw new Error(`Pinterest HTML HTTP ${response.status}`)

  const html = await response.text()
  const results = []
  const seen = new Set()

  for (const image of extractImageUrls(html)) {
    const original = originalPinterestUrl(image)

    if (!original || seen.has(original))
      continue

    seen.add(original)
    results.push(original)

    if (results.length >= limit)
      break
  }

  if (!results.length)
    throw new Error("No se encontraron imágenes en el HTML de Pinterest")

  return results
}

async function searchPinterest(query, limit = 5) {
  try {
    return await pinterestInternalSearch(query, limit)
  } catch (internalError) {
    console.warn(
      "[PINTEREST INTERNAL SEARCH]",
      internalError.message
    )

    return await pinterestHtmlSearch(query, limit)
  }
}

async function getPinterestPinMedia(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      Referer: "https://www.pinterest.com/"
    },
    redirect: "follow"
  })

  if (!response.ok)
    throw new Error(`Pinterest HTTP ${response.status}`)

  const finalUrl = response.url
  const html = await response.text()

  const videos = extractVideoUrls(html)

  if (videos.length) {
    const video =
      videos.find(x => /720|1080|V_720|V_1080/i.test(x)) ||
      videos[0]

    return {
      type: "video",
      url: video,
      page: finalUrl
    }
  }

  const images = []

  const metaRegex =
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi

  for (const match of html.matchAll(metaRegex)) {
    const image = cleanUrl(match[1])

    if (isPinterestImage(image))
      images.push(image)
  }

  for (const image of extractImageUrls(html))
    images.push(image)

  const unique = [...new Set(images)]

  const original =
    unique
      .map(originalPinterestUrl)
      .find(Boolean)

  if (original) {
    return {
      type: "image",
      url: original,
      page: finalUrl
    }
  }

  throw new Error("Pinterest no devolvió ningún medio")
}

async function downloadBuffer(url, referer = "https://www.pinterest.com/") {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
      Referer: referer
    },
    redirect: "follow"
  })

  if (!response.ok)
    throw new Error(
      `No se pudo descargar el medio: HTTP ${response.status}`
    )

  const buffer = Buffer.from(
    await response.arrayBuffer()
  )

  if (!buffer.length)
    throw new Error("Pinterest devolvió un archivo vacío")

  return buffer
}

const handler = async (m, { conn, args }) => {
  const text = args.join(" ").trim()
  const chat = m.chat

  if (!text)
    return m.reply(
      `${e} *Uso correcto:* .pinterest <texto | url>\n` +
      `Ejemplos:\n` +
      `• .pinterest Akame\n` +
      `• .pinterest https://pin.it/10HeaH0Uk`
    )

  await m.react("🕒")

  if (/^https?:\/\//i.test(text)) {
    try {
      const media = await getPinterestPinMedia(text)

      const buffer = await downloadBuffer(
        media.url,
        media.page
      )

      if (media.type === "video") {
        await conn.sendMessage(
          chat,
          {
            video: buffer,
            caption: `${e} Pinterest Video`
          },
          { quoted: m }
        )
      } else {
        await conn.sendMessage(
          chat,
          {
            image: buffer,
            caption: `${e} Pinterest Imagen`
          },
          { quoted: m }
        )
      }

      return m.react("✅")
    } catch (err) {
      console.error("[PINTEREST URL ERROR]", err)
      await m.react("❌")
      return m.reply(
        `${e} *No se pudo obtener el contenido de Pinterest:*\n${err.message}`
      )
    }
  }

  try {
    const urls = await searchPinterest(text, 5)

    if (!urls.length)
      throw new Error("Pinterest no devolvió imágenes")

    const buffers = []

    for (const url of urls) {
      try {
        const buffer = await downloadBuffer(url)

        if (buffer.length > 0)
          buffers.push(buffer)
      } catch (error) {
        console.warn(
          "[PINTEREST IMAGE]",
          error.message
        )
      }

      if (buffers.length >= 5)
        break
    }

    if (!buffers.length)
      throw new Error(
        "Se encontraron Pins, pero no se pudieron descargar sus imágenes"
      )

    if (buffers.length === 1) {
      await conn.sendMessage(
        chat,
        {
          image: buffers[0],
          caption: `${e} *Resultado para:* ${text}`
        },
        { quoted: m }
      )

      return m.react("✅")
    }

    await sendAlbumMessage(
      conn,
      chat,
      buffers,
      {
        caption: `${e} *Resultados para:* ${text}`,
        quoted: m
      }
    )

    await m.react("✅")
  } catch (err) {
    console.error("[PINTEREST SEARCH ERROR]", err)
    await m.react("❌")

    return m.reply(
      `${e} *No se encontraron imágenes en Pinterest:*\n${err.message}`
    )
  }
}

handler.help = ["pinterest"]
handler.tags = ["descargas"]
handler.command = [
  "pinterest",
  "pin",
  "pinimg",
  "pvid"
]
handler.group = true

export default handler
