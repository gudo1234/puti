import fetch from "node-fetch"

const APIKEY = "oboe"
const GATAKEY = "gata-2026-ofc"

const handler = async (m, { conn, args, usedPrefix, command }) => {

    const input = args?.join(" ").trim() || ""

    if (!input) {
        return m.reply(
            `*¿Qué TikTok quieres descargar?*\n\n` +
            `Ejemplo:\n${usedPrefix + command} Diles\n` +
            `${usedPrefix + command} https://www.tiktok.com/@vitotvo.ec/video/7677072456238058759`
        )
    }

    await m.react?.("⌛")

    try {

        const isTikTok =
            /^(https?:\/\/)?((www|vm|vt|m|t)\.)?tiktok\.com\/\S+/i.test(input)

        let result = null

        if (isTikTok) {

            const res = await fetch(
                `https://api.evogb.org/dl/tiktok?key=${encodeURIComponent(GATAKEY)}&url=${encodeURIComponent(input)}`,
                {
                    headers: {
                        "User-Agent": "Mozilla/5.0"
                    }
                }
            )

            if (!res.ok) {
                throw new Error(`GataDios HTTP ${res.status}`)
            }

            const data = await res.json()

            if (
                !data?.status ||
                data?.code !== 200 ||
                !data?.data
            ) {
                throw new Error("GataDios no pudo obtener el TikTok.")
            }

            result = data.data

        } else {

            const res = await fetch(
                `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(input)}&key=${encodeURIComponent(APIKEY)}`
            )

            if (!res.ok) {
                throw new Error(`Búsqueda HTTP ${res.status}`)
            }

            const data = await res.json()

            if (
                !data?.status ||
                !Array.isArray(data.data) ||
                !data.data.length
            ) {
                throw new Error("No se encontraron resultados.")
            }

            result = data.data.find(
                x => x?.url || x?.dl
            )

            if (!result) {
                throw new Error("El resultado no contiene una URL válida.")
            }

            const url =
                result.url ||
                result.dl

            const gataRes = await fetch(
                `https://api.evogb.org/dl/tiktok?key=${encodeURIComponent(GATAKEY)}&url=${encodeURIComponent(url)}`,
                {
                    headers: {
                        "User-Agent": "Mozilla/5.0"
                    }
                }
            )

            if (!gataRes.ok) {
                throw new Error(`GataDios HTTP ${gataRes.status}`)
            }

            const gataData = await gataRes.json()

            if (
                !gataData?.status ||
                gataData?.code !== 200 ||
                !gataData?.data
            ) {
                throw new Error(
                    "GataDios no pudo procesar el resultado."
                )
            }

            result = gataData.data
        }

        const formatter = n => {
            n = Number(n) || 0

            if (n >= 1e9)
                return (n / 1e9).toFixed(1) + "B"

            if (n >= 1e6)
                return (n / 1e6).toFixed(1) + "M"

            if (n >= 1e3)
                return (n / 1e3).toFixed(1) + "K"

            return String(n)
        }

        const author = result.author || {}
        const stats = result.stats || {}

        const caption =
            `${result.title || "Sin título"}\n\n` +
            `> Autor › ${author.nickname || author.unique_id || "Desconocido"}\n` +
            `> Duración › ${result.duration || "-"}\n` +
            `> Región › ${result.region || "-"}\n` +
            `> Vistas › ${formatter(stats.plays)}\n` +
            `> Likes › ${formatter(stats.likes)}\n` +
            `> Comentarios › ${formatter(stats.comments)}\n` +
            `> Compartidos › ${formatter(stats.shares)}\n` +
            `> Descargas › ${formatter(stats.downloads)}`

        if (result.type === "image") {

            const images = Array.isArray(result.dl)
                ? result.dl
                : [result.dl]

            if (!images.length || !images[0]) {
                throw new Error("No se encontraron imágenes.")
            }

            for (let i = 0; i < images.length; i++) {

                await conn.sendMessage(
                    m.chat,
                    {
                        image: {
                            url: images[i]
                        },
                        caption: i === 0 ? caption : undefined
                    },
                    {
                        quoted: m
                    }
                )
            }

        } else {

            if (!result.dl) {
                throw new Error(
                    "GataDios no devolvió el enlace del video."
                )
            }

            await conn.sendMessage(
                m.chat,
                {
                    video: {
                        url: result.dl
                    },
                    caption,
                    mimetype: "video/mp4",
                    fileName: "tiktok.mp4"
                },
                {
                    quoted: m
                }
            )
        }

        await m.react?.("✅")

    } catch (e) {

        console.error(
            "❌ TIKTOK:",
            e
        )

        await m.react?.("❌")

        await m.reply(
            `❌ No pude procesar el TikTok.\n\n> ${e?.message || e}`
        )
    }
}

handler.help = ["tiktok"]
handler.tags = ["descargas"]
handler.command = [
    "tk",
    "tt",
    "ttv",
    "tiktok",
    "tkmp4",
    "ttvid",
    "tiktokvid"
]

handler.group = true
export default handler
