import {
    prepareWAMessageMedia,
    generateWAMessageFromContent
} from "@whiskeysockets/baileys"

const IMAGEN_DEFAULT =
    "https://raw.githubusercontent.com/edar123/im/main/media/me25.jpg"

function encontrarMedia(message = {}) {

    const tipos = [
        "imageMessage",
        "videoMessage"
    ]

    const wrappers = [
        "ephemeralMessage",
        "viewOnceMessage",
        "viewOnceMessageV2",
        "viewOnceMessageV2Extension",
        "documentWithCaptionMessage",
        "editedMessage",
        "deviceSentMessage",
        "futureproofMessage"
    ]

    function buscar(obj, profundidad = 0) {

        if (
            !obj ||
            typeof obj !== "object" ||
            profundidad > 15
        )
            return null

        for (const tipo of tipos) {

            if (obj[tipo]) {

                return {
                    type: tipo,
                    message: obj
                }
            }
        }

        for (const wrapper of wrappers) {

            const contenido =
                obj[wrapper]?.message

            if (contenido) {

                const encontrado =
                    buscar(
                        contenido,
                        profundidad + 1
                    )

                if (encontrado)
                    return encontrado
            }
        }

        return null
    }

    return buscar(message)
}

async function descargarMedia(conn, source) {

    if (!source)
        throw new Error(
            "No se encontró el multimedia."
        )

    let buffer = null

    if (
        typeof source.download === "function"
    ) {

        try {
            buffer =
                await source.download()
        } catch {}
    }

    if (
        Buffer.isBuffer(buffer) &&
        buffer.length
    )
        return buffer

    if (
        typeof conn.downloadMediaMessage === "function"
    ) {

        try {
            buffer =
                await conn.downloadMediaMessage(
                    source
                )
        } catch {}
    }

    if (
        Buffer.isBuffer(buffer) &&
        buffer.length
    )
        return buffer

    if (
        typeof conn.downloadAndSaveMediaMessage === "function"
    ) {

        try {

            const os =
                await import("os")

            const fs =
                await import("fs/promises")

            const path =
                await import("path")

            const dir =
                await fs.mkdtemp(
                    path.join(
                        os.tmpdir(),
                        "noti3-"
                    )
                )

            const file =
                path.join(
                    dir,
                    "media"
                )

            const saved =
                await conn.downloadAndSaveMediaMessage(
                    source,
                    file
                )

            const data =
                await fs.readFile(
                    saved || file
                )

            await fs.rm(
                dir,
                {
                    recursive: true,
                    force: true
                }
            ).catch(() => {})

            if (
                Buffer.isBuffer(data) &&
                data.length
            )
                return data

        } catch {}
    }

    throw new Error(
        "No se pudo descargar el multimedia."
    )
}

let handler = async (m, { conn, text, usedPrefix, command }) => {

    if (!text?.trim())
        return m.reply(
            `${e} Usa:\n\n` +
            `${usedPrefix + command} <link grupo/canal> | <texto> | <botón> | <sitio web>\n` +
            `${usedPrefix + command} <texto> | <botón> | <sitio web>`
        )

    const partes =
        text
            .split("|")
            .map(x => x.trim())

    let targetChat = null
    let texto = ""
    let displayText = ""
    let urlWeb = ""

    let esCanal = false

    const posibleCanal =
        partes[0]?.match(
            /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([0-9A-Za-z]+)/
        )

    if (posibleCanal) {

        esCanal = true

        if (partes.length < 4)
            return m.reply(
                `${e} Formato incorrecto.\n\n` +
                `Usa:\n` +
                `${usedPrefix + command} link del canal | texto | botón | sitio web`
            )

        const channelCode =
            posibleCanal[1]

        texto =
            partes[1]

        displayText =
            partes[2]

        urlWeb =
            partes
                .slice(3)
                .join("|")
                .trim()

        try {

            if (
                typeof conn.newsletterMetadata !== "function"
            )
                throw new Error(
                    "Tu versión de Baileys no soporta canales/newsletters."
                )

            const metadata =
                await conn.newsletterMetadata(
                    "invite",
                    channelCode
                )

            if (metadata?.id)
                targetChat =
                    metadata.id

        } catch (error) {

            console.error(
                "❌ Error obteniendo canal:",
                error
            )
        }

        if (!targetChat)
            return m.reply(
                `${e} No pude identificar el canal de WhatsApp. Verifica que el enlace sea válido.`
            )
    }

    else {

        const posibleGrupo =
            partes[0]?.match(
                /(?:https?:\/\/)?chat\.whatsapp\.com\/([0-9A-Za-z]+)/
            )

        if (posibleGrupo) {

            if (partes.length < 4)
                return m.reply(
                    `${e} Formato incorrecto.\n\n` +
                    `Usa:\n` +
                    `${usedPrefix + command} link del grupo | texto | botón | sitio web`
                )

            const groupCode =
                posibleGrupo[1]

            texto =
                partes[1]

            displayText =
                partes[2]

            urlWeb =
                partes
                    .slice(3)
                    .join("|")
                    .trim()

            try {

                const info =
                    await conn.groupGetInviteInfo(
                        groupCode
                    )

                if (info?.id)
                    targetChat =
                        info.id

            } catch {}

            if (!targetChat) {

                try {

                    const joined =
                        await conn.groupAcceptInvite(
                            groupCode
                        )

                    if (
                        typeof joined === "string" &&
                        joined.includes("@g.us")
                    )
                        targetChat =
                            joined

                } catch {}
            }

            if (!targetChat)
                return m.reply(
                    `${e} No pude identificar el grupo. El enlace puede estar vencido, ser inválido o el bot no puede acceder al grupo.`
                )
        }

        else {

            if (!m.isGroup)
                return m.reply(
                    `${e} Este formato debe ejecutarse dentro de un grupo.`
                )

            if (partes.length < 3)
                return m.reply(
                    `${e} Formato incorrecto.\n\n` +
                    `Usa:\n` +
                    `${usedPrefix + command} texto | botón | sitio web`
                )

            targetChat =
                m.chat

            texto =
                partes[0]

            displayText =
                partes[1]

            urlWeb =
                partes
                    .slice(2)
                    .join("|")
                    .trim()
        }
    }

    if (!texto)
        return m.reply(
            `${e} Debes colocar el texto de la notificación.`
        )

    if (!displayText)
        return m.reply(
            `${e} Debes colocar el texto del botón.`
        )

    if (!urlWeb)
        return m.reply(
            `${e} Debes colocar el sitio web del botón.`
        )

    let urlFinal

    try {

        urlFinal =
            new URL(urlWeb)

        if (
            urlFinal.protocol !== "http:" &&
            urlFinal.protocol !== "https:"
        )
            throw new Error()

    } catch {

        return m.reply(
            `${e} El sitio web no es válido.\n\nEjemplo:\nhttps://www.instagram.com/edi504_/`
        )
    }

    let users = []

    if (!esCanal) {

        const metadata =
            await conn
                .groupMetadata(targetChat)
                .catch(() => null)

        if (!metadata)
            return m.reply(
                `${e} No pude obtener la información del grupo.`
            )

        const botJid =
            conn.user?.id ||
            conn.user?.jid

        users =
            metadata.participants
                .map(u => u.id)
                .filter(
                    id =>
                        id &&
                        id !== botJid
                )

        if (!users.length)
            return m.reply(
                `${e} No encontré participantes para mencionar.`
            )
    }

    let actual =
        encontrarMedia(
            m.message || {}
        )

    let mediaSource =
        actual ?
            m :
            null

    if (!actual && m.quoted) {

        actual =
            encontrarMedia(
                m.quoted.message ||
                m.quoted.msg ||
                {}
            )

        if (actual)
            mediaSource =
                m.quoted
    }

    let tipo = "image"
    let buffer = null

    if (actual && mediaSource) {

        try {

            buffer =
                await descargarMedia(
                    conn,
                    mediaSource
                )

            tipo =
                actual.type === "imageMessage"
                    ? "image"
                    : "video"

        } catch (error) {

            console.error(
                "❌ Error descargando multimedia:",
                error
            )

            return m.reply(
                `${e} No pude descargar el multimedia citado.`
            )
        }

    } else {

        try {

            const response =
                await fetch(
                    IMAGEN_DEFAULT
                )

            if (!response.ok)
                throw new Error(
                    `HTTP ${response.status}`
                )

            const arrayBuffer =
                await response.arrayBuffer()

            buffer =
                Buffer.from(
                    arrayBuffer
                )

        } catch (error) {

            console.error(
                "❌ Error descargando imagen:",
                error
            )

            return m.reply(
                `${e} No pude descargar la imagen predeterminada.`
            )
        }
    }

    try {

        await m.react("🕒")

        if (
            !Buffer.isBuffer(buffer) ||
            !buffer.length
        )
            throw new Error(
                "El multimedia está vacío."
            )

        const contenido =
            tipo === "image"
                ? {
                    image: buffer
                }
                : {
                    video: buffer
                }

        const media =
            await prepareWAMessageMedia(
                contenido,
                {
                    upload:
                        conn.waUploadToServer
                }
            )

        const header =
            tipo === "image"
                ? {
                    title: "",
                    hasMediaAttachment: true,
                    imageMessage:
                        media.imageMessage
                }
                : {
                    title: "",
                    hasMediaAttachment: true,
                    videoMessage:
                        media.videoMessage
                }

        const contextInfo =
            esCanal
                ? {}
                : {
                    mentionedJid:
                        users
                }

        const mensaje =
            generateWAMessageFromContent(
                targetChat,
                {
                    interactiveMessage: {

                        header,

                        body: {
                            text: ""
                        },

                        footer: {
                            text: texto
                        },

                        nativeFlowMessage: {

                            buttons: [
                                {
                                    name: "cta_url",

                                    buttonParamsJson:
                                        JSON.stringify({
                                            display_text:
                                                displayText,
                                            url:
                                                urlFinal.toString()
                                        })
                                }
                            ]
                        },

                        contextInfo
                    }
                },
                {
                    userJid:
                        conn.user.id,

                    quoted:
                        null
                }
            )

        await conn.relayMessage(
            targetChat,
            mensaje.message,
            {
                messageId:
                    mensaje.key.id
            }
        )

        await m.react("✅")

    } catch (error) {

        console.error(
            "❌ Error en noti3:",
            error
        )

        await m.react("❌")
            .catch(() => {})

        return m.reply(
            `${e} No se pudo enviar la notificación.\n\n${error?.message || "Error desconocido."}`
        )
    }
}

handler.help = ["noti3"]
handler.tags = ["g"]
handler.command = ["noti3"]
handler.owner = true

export default handler
