import fetch from "node-fetch"
import axios from "axios"
import Starlights from "starlights-scraper"

function extractTikTokUrl(text) {
    const patterns = [
        /https?:\/\/(?:www\.)?tiktok\.com\/[^\s]+/i,
        /https?:\/\/vm\.tiktok\.com\/[^\s]+/i,
        /https?:\/\/vt\.tiktok\.com\/[^\s]+/i,
        /tiktok\.com\/[^\s]+/i,
        /vm\.tiktok\.com\/[^\s]+/i,
        /vt\.tiktok\.com\/[^\s]+/i
    ]

    for (const reg of patterns) {
        const m = text.match(reg)
        if (m) {
            let url = m[0].replace(/^[^h]+/, "https://")
            if (!url.startsWith("http")) url = "https://" + url
            return url
        }
    }
    return null
}

let handler = async (m, { conn, text }) => {
    if (!text) return m.reply(`${e} Ingrese un *texto o link* de TikTok.`)

    await m.react("🕒")

    let result = null
    let dl_url = null

    try {
        const url = extractTikTokUrl(text)

        if (url) {
            try {
                const api = `https://api.deline.web.id/downloader/tiktok?url=${encodeURIComponent(url)}`
                const res = await fetch(api, { timeout: 20000 })
                const json = await res.json()

                if (json?.status && json?.result) {
                    const data = json.result
                    result = {
                        title: data.title || "Sin título",
                        author: data.author?.nickname || "Desconocido",
                        type: data.type || "video",
                        region: data.region || "-",
                        audio: data.music || null,
                        images: data.type === "image" && Array.isArray(data.download) ? data.download : []
                    }
                    dl_url = typeof data.download === "string" ? data.download : null
                }
            } catch {
                console.log("Deline falló → usando fallback...")
            }
        }

        if (!result) {
            const scrape = url
                ? await Starlights.tiktokdl(url)
                : await Starlights.tiktokvid(text)

            result = {
                title: scrape.title || "Sin título",
                author: scrape.author || "Desconocido",
                type: scrape.images ? "image" : "video",
                images: scrape.images || [],
                audio: scrape.audio || null
            }
            dl_url = scrape?.dl_url || scrape?.nowm || null
        }

        if (result.type === "image" && result.images.length) {
            for (let i = 0; i < result.images.length; i++) {
                await conn.sendMessage(
                    m.chat,
                    {
                        image: { url: result.images[i] },
                        caption: i === 0
                            ? `🎵 *TikTok*
✦ *Título:* ${result.title}
✦ *Autor:* ${result.author}`
                            : undefined
                    },
                    { quoted: m }
                )
            }

            if (result.audio) {
                await conn.sendMessage(
                    m.chat,
                    {
                        audio: { url: result.audio },
                        mimetype: "audio/mpeg",
                        fileName: "tiktok_audio.mp3"
                    },
                    { quoted: m }
                )
            }

            await m.react("✅")
            return
        }

        if (!dl_url) return m.reply(`${e} No pude obtener el enlace de descarga.`)

        const fileReq = await axios.get(dl_url, {
            responseType: "arraybuffer",
            timeout: 30000
        })
      let txt = `🎵 *TikTok Downloader*
✦ *Título:* ${result.title}
✦ *Autor:* ${result.author}`
      await conn.sendFile(m.chat, Buffer.from(fileReq.data), 'tiktok.mp4', txt, m, null, rcanal);

        if (result.audio) {
            await conn.sendMessage(
                m.chat,
                {
                    audio: { url: result.audio },
                    mimetype: "audio/mpeg",
                    fileName: "tiktok_audio.mp3"
                },
                { quoted: m }
            )
        }

        await m.react("✅")

    } catch (err) {
        console.error("ERROR TIKTOK:", err)
        return m.reply(`${e} Error procesando el TikTok.`)
    }
}

handler.help = ["tiktok"]
handler.tags = ["descargas"]
handler.command = ["tiktok", "tt", "ttdl", "tiktokvid", "tiktokdl", "ttvideo", "ttimg"]
handler.group = true

export default handler
