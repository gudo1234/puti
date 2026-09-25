import {
    prepareWAMessageMedia,
    generateWAMessageFromContent
} from "@whiskeysockets/baileys"

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
                        "noti2-"
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

let handler = async (
    m,
    {
        conn,
        text,
        usedPrefix,
        command
    }
) => {

    if (!text?.trim())
        return m.reply(
            `${e} Usa:\n${usedPrefix + command} <link grupo> | <texto> | <botón> | <número> | <texto WhatsApp>\n\nDebes responder a una imagen, video o GIF.`
        )

    const partes =
        text
            .split("|")
            .map(x => x.trim())

    const link =
        partes[0]

    const texto =
        partes[1]

    const displayText =
        partes[2]

    const numero =
        partes[3]

    const textoWhatsApp =
        partes
            .slice(4)
            .join("|")
            .trim()

    if (!texto)
        return m.reply(
            `${e} Debes colocar el texto de la notificación.`
        )

    if (!displayText)
        return m.reply(
            `${e} Debes colocar el texto del botón.`
        )

    if (!numero)
        return m.reply(
            `${e} Debes colocar el número de WhatsApp.`
        )

    if (!textoWhatsApp)
        return m.reply(
            `${e} Debes colocar el texto que abrirá WhatsApp.`
        )

    const match =
        link?.match(
            /(?:https?:\/\/)?chat\.whatsapp\.com\/([0-9A-Za-z]+)/
        )

    if (!match)
        return m.reply(
            `${e} Debes colocar un enlace de grupo válido.`
        )

    const groupCode =
        match[1]

    const numeroLimpio =
        numero.replace(/\D/g, "")

    if (!numeroLimpio)
        return m.reply(
            `${e} El número de WhatsApp no es válido.`
        )

    const urlBoton =
        `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(textoWhatsApp).replace(/%20/g, "+")}`

    let targetChat = null

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

    const users =
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

    let actual =
        encontrarMedia(
            m.message || {}
        )

    let mediaSource =
        actual
            ? m
            : null

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

    if (!actual)
        return m.reply(
            `${e} Debes responder a una imagen, video o GIF.`
        )

    try {

        await m.react("🕒")

        const buffer =
            await descargarMedia(
                conn,
                mediaSource
            )

        if (
            !Buffer.isBuffer(buffer) ||
            !buffer.length
        )
            throw new Error(
                "El multimedia está vacío."
            )

        const tipo =
            actual.type === "imageMessage"
                ? "image"
                : "video"

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
                                                urlBoton
                                        })
                                }
                            ]
                        },

                        contextInfo: {
                            mentionedJid:
                                users
                        }
                    }
                },
                {
                    userJid:
                        conn.user.id,
                    quoted: null
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
            "❌ Error en noti2:",
            error
        )

        await m.react("❌")
            .catch(() => {})

        return m.reply(
            `${e} No se pudo enviar la notificación.\n\n${error?.message || "Error desconocido."}`
        )
    }
}

handler.help = ["noti2"]
handler.tags = ["g"]
handler.command = ["noti2"]
handler.owner = true

export default handler
