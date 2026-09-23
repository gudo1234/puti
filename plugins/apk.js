import { search, download } from "aptoide-scraper"
import fetch from "node-fetch"

let handler = async (m, { conn, usedPrefix, text }) => {
    const query = text?.trim() || ""

    if (!query) {
        return m.reply(
`${e} Ingresa el nombre de una aplicación.

Ejemplo:
*${usedPrefix}apk Facebook*`
        )
    }

    await m.react("🕒")

    try {
        const result = await search(query)

        if (!result.length) {
            await m.react("❌")
            return m.reply(`${e} No se encontraron resultados para: *${query}*`)
        }

        const app = await download(result[0].id)
        const thumbRes = await fetch(app.icon)
        const thumbBuffer = await thumbRes.buffer()

        const info = `✦ *Paquete:* ${app.package}
✦ *Última actualización:* ${app.lastup}
✦ *Tamaño:* ${app.size}`

        await conn.sendMessage(m.chat,
            {
                text: info,
                contextInfo: {
                    externalAdReply: {
                        title: app.name,
                        body: textbot,
                        thumbnail: thumbBuffer,
                        thumbnailUrl: redes,
                        sourceUrl: redes,
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            },
            { quoted: m }
        )

        if (
            app.size.includes("GB") ||
            parseInt(app.size.replace(" MB", ""), 10) > 999
        ) {
            await m.react("⚠️")
            return m.reply(`${e} El archivo es demasiado grande, no se enviará.`)
        }

        await conn.sendMessage(m.chat,
            {
                document: { url: app.dllink },
                mimetype: "application/vnd.android.package-archive",
                fileName: `${app.name}.apk`
            },
            { quoted: m }
        )

        await m.react("✅")

    } catch (err) {
        console.error("APK ERROR:", err)
        await m.react("❌")
        return m.reply(`${e} Error al procesar la solicitud.`)
    }
}

handler.help = ["apk"]
handler.tags = ["descargas"]
handler.command = ["apk", "aplicacion"]
handler.group = true

export default handler
