import fetch from "node-fetch"
import * as cheerio from "cheerio"

const YT1Z = "https://yt1z.top/"

const safeFetch = async (url, options = {}) => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(options.headers || {})
      }
    })

    clearTimeout(timeout)
    return res.ok ? res : null
  } catch {
    return null
  }
}

const isYouTubeUrl = (text) => {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(text)
}

const getYouTubeUrl = async (query) => {
  if (isYouTubeUrl(query)) return query

  const url = `${YT1Z}?searchQuery=${encodeURIComponent(query)}`

  const res = await safeFetch(url)
  if (!res) return null

  const html = await res.text()
  const $ = cheerio.load(html)

  let videoUrl = null

  $("a").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return

    if (
      /youtube\.com\/watch\?v=/i.test(href) ||
      /youtu\.be\//i.test(href)
    ) {
      videoUrl = href
      return false
    }
  })

  return videoUrl
}

const getDownload = async (youtubeUrl, type) => {
  const url = `${YT1Z}?videoLink=${encodeURIComponent(youtubeUrl)}`

  const res = await safeFetch(url)
  if (!res) return null

  const html = await res.text()
  const $ = cheerio.load(html)

  let downloadUrl = null

  $("a, button").each((_, el) => {
    const text = $(el).text().trim().toLowerCase()
    const href = $(el).attr("href")

    if (!href) return

    if (type === "audio") {
      if (
        text.includes("mp3") ||
        text.includes("audio")
      ) {
        downloadUrl = new URL(href, YT1Z).href
        return false
      }
    }

    if (type === "video") {
      if (
        text.includes("1080p") ||
        text.includes("720p") ||
        text.includes("mp4")
      ) {
        downloadUrl = new URL(href, YT1Z).href
        return false
      }
    }
  })

  return downloadUrl
}

let handler = async (m, { conn, usedPrefix, command }) => {
  const text = m.text?.trim().replace(
    new RegExp(`^\\${usedPrefix}${command}\\s*`, "i"),
    ""
  ).trim()

  if (!text) {
    return m.reply(
      `❌ Escribe el nombre o URL del video.\n\n` +
      `Ejemplos:\n` +
      `${usedPrefix}audio Diles\n` +
      `${usedPrefix}video Diles\n` +
      `${usedPrefix}audio https://youtu.be/xxxxx\n` +
      `${usedPrefix}video https://youtu.be/xxxxx`
    )
  }

  await m.react("⌛")

  try {
    const type = command.toLowerCase() === "audio"
      ? "audio"
      : "video"

    let youtubeUrl = text

    if (!isYouTubeUrl(text)) {
      await m.reply(`🔎 Buscando en YouTube...\n> ${text}`)

      youtubeUrl = await getYouTubeUrl(text)

      if (!youtubeUrl) {
        await m.react("❌")
        return m.reply("❌ No encontré ningún video para esa búsqueda.")
      }
    }

    await m.reply(
      type === "audio"
        ? "🎵 Procesando audio con YT1Z..."
        : "🎬 Procesando video con YT1Z..."
    )

    const downloadUrl = await getDownload(youtubeUrl, type)

    if (!downloadUrl) {
      await m.react("❌")
      return m.reply(
        "❌ YT1Z no devolvió un enlace de descarga para este video."
      )
    }

    if (type === "audio") {
      await conn.sendMessage(
        m.chat,
        {
          audio: {
            url: downloadUrl
          },
          mimetype: "audio/mpeg",
          fileName: "audio.mp3"
        },
        {
          quoted: m
        }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        {
          video: {
            url: downloadUrl
          },
          mimetype: "video/mp4",
          fileName: "video.mp4"
        },
        {
          quoted: m
        }
      )
    }

    await m.react("✅")
  } catch (e) {
    console.error(e)
    await m.react("❌")
    await m.reply(
      `❌ Ocurrió un error al procesar el ${command}.\n> ${e.message}`
    )
  }
}

handler.command = ["audio", "video"]

export default handler
