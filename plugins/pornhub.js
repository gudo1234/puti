import fetch from "node-fetch"
import axios from "axios"
import cheerio from "cheerio"
import { CookieJar } from "tough-cookie"
import { wrapper } from "axios-cookiejar-support"

async function phfans(url) {
    const jar = new CookieJar()
    const client = wrapper(axios.create({ jar }))

    await client.get("https://pornhubfans.com/", {
        headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://pornhubfans.com/"
        }
    })

    const res = await client.post(
        "https://pornhubfans.com/resolve",
        { url, source: "phfans" },
        {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0",
                Referer: "https://pornhubfans.com/"
            }
        }
    )

    const data = res.data
    const build = (type, token) => `${data.endpoint}/${type}?token=${token}`

    return {
        title: data.title,
        video: data.video.map(v => ({
            quality: v.quality,
            download: build("video", v.token)
        }))
    }
}

async function searchPornhub(text) {
    try {
        const res = await axios.get(
            `https://www.pornhub.com/video/search?search=${encodeURIComponent(text)}`
        )

        const $ = cheerio.load(res.data)
        const results = []

        $('ul#videoSearchResult > li.pcVideoListItem').each(function () {
            const title = $(this).find("a").attr("title")
            const url = "https://www.pornhub.com" + $(this).find("a").attr("href")
            results.push({ title, url })
        })

        return results
    } catch {
        return []
    }
}

let handler = async (m, { conn, args, usedPrefix }) => {

    // 🔞 LÓGICA NSFW (IGUAL AL SEGUNDO CÓDIGO)
    if (!db.data.chats[m.chat].nsfw && m.isGroup) {
        return m.reply(
            `${e} El contenido *NSFW* está desactivado en este grupo.\n` +
            `> Un administrador puede activarlo con el comando » *${usedPrefix}nsfw on*`
        )
    }

    const query = args.join(" ")

    if (!query)
        return m.reply(
            `${e} Ingresa un texto o link válido.\n\n` +
            `Ejemplos:\n` +
            `• ${usedPrefix}pornhub colegiala\n` +
            `• ${usedPrefix}pornhub https://www.pornhub.com/view_video.php?viewkey=xxxx`
        )

    let link

    if (/^https?:\/\//i.test(query)) {
        link = query
    } else {
        m.react("🕒")
        const results = await searchPornhub(query)
        if (!results.length)
            return m.reply(`${e} No se encontraron resultados.`)
        link = results[0].url
    }

    try {
        const info = await phfans(link)
        if (!info.video.length)
            return m.reply(`${e} No se pudo obtener el video.`)

        const best = info.video[0]
        const res = await fetch(best.download)
        const buffer = Buffer.from(await res.arrayBuffer())

        await conn.sendMessage(
            m.chat,
            {
                document: buffer,
                mimetype: "video/mp4",
                fileName: `${info.title}.mp4`
            },
            { quoted: m }
        )

        m.react("✅")

    } catch (err) {
        console.error("[PH ERROR]", err)
        m.react("❌")
        m.reply(`${e} Error al descargar el video.`)
    }
}

handler.help = ["pornhub"]
handler.tags = ["descargas"]
handler.command = ["pornhub", "phhub"]
handler.group = true

export default handler
