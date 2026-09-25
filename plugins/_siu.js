import ffmpeg from "fluent-ffmpeg"
import fs from "fs/promises"
import os from "os"
import path from "path"
import crypto from "crypto"

async function convertirNotaDeVoz(buffer, extension = "audio") {
    if (!Buffer.isBuffer(buffer) || !buffer.length)
        throw new Error("El audio recibido está vacío.")

    const id = crypto.randomBytes(8).toString("hex")
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `siu-${id}-`))
    const input = path.join(dir, `input.${extension || "audio"}`)
    const output = path.join(dir, "voice.ogg")

    try {
        await fs.writeFile(input, buffer)

        await new Promise((resolve, reject) => {
            let finished = false

            const fail = error => {
                if (finished) return
                finished = true
                reject(error)
            }

            const success = () => {
                if (finished) return
                finished = true
                resolve()
            }

            ffmpeg(input)
                .noVideo()
                .audioCodec("libopus")
                .audioChannels(1)
                .audioFrequency(48000)
                .audioBitrate("32k")
                .outputOptions([
                    "-map", "0:a:0",
                    "-vn",
                    "-c:a", "libopus",
                    "-application", "voip",
                    "-ac", "1",
                    "-ar", "48000",
                    "-b:a", "32k",
                    "-vbr", "on",
                    "-compression_level", "10",
                    "-frame_duration", "20",
                    "-avoid_negative_ts", "make_zero",
                    "-map_metadata", "-1"
                ])
                .format("ogg")
                .on("start", () => console.log("🎙️ FFmpeg iniciando conversión..."))
                .on("error", error => {
                    console.error("❌ FFmpeg:", error?.message || error)
                    fail(error)
                })
                .on("end", success)
                .save(output)
        })

        const result = await fs.readFile(output)

        if (!result?.length)
            throw new Error("FFmpeg produjo un archivo vacío.")

        if (result.subarray(0, 4).toString("ascii") !== "OggS")
            throw new Error("El archivo generado no es un OGG válido.")

        return result
    } finally {
        await fs.rm(dir, {
            recursive: true,
            force: true
        }).catch(() => {})
    }
}

function obtenerExtensionAudio(mimetype = "") {
    const mime = String(mimetype).toLowerCase()

    if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
    if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a"
    if (mime.includes("wav") || mime.includes("wave")) return "wav"
    if (mime.includes("webm")) return "webm"
    if (mime.includes("ogg") || mime.includes("opus")) return "ogg"
    if (mime.includes("flac")) return "flac"
    if (mime.includes("amr")) return "amr"

    return "audio"
}

function encontrarMedia(message = {}) {
    const tipos = [
        "imageMessage",
        "videoMessage",
        "audioMessage",
        "stickerMessage",
        "documentMessage"
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
        if (!obj || typeof obj !== "object" || profundidad > 15)
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
            const contenido = obj[wrapper]?.message

            if (contenido) {
                const encontrado = buscar(
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
        throw new Error("No se encontró el mensaje multimedia.")

    let buffer = null

    if (typeof source.download === "function") {
        try {
            buffer = await source.download()
        } catch {}
    }

    if (Buffer.isBuffer(buffer) && buffer.length)
        return buffer

    if (typeof conn.downloadMediaMessage === "function") {
        try {
            buffer = await conn.downloadMediaMessage(source)
        } catch {}
    }

    if (Buffer.isBuffer(buffer) && buffer.length)
        return buffer

    throw new Error("No se pudo descargar el multimedia.")
}

/*
 * Obtiene el texto ORIGINAL del mensaje.
 *
 * Esto evita que el framework entregue `text`
 * con los saltos de línea convertidos en espacios.
 */
function obtenerTextoOriginal(m) {
    const msg = m?.message

    if (!msg)
        return ""

    if (typeof msg.conversation === "string")
        return msg.conversation

    if (typeof msg.extendedTextMessage?.text === "string")
        return msg.extendedTextMessage.text

    if (typeof msg.imageMessage?.caption === "string")
        return msg.imageMessage.caption

    if (typeof msg.videoMessage?.caption === "string")
        return msg.videoMessage.caption

    if (typeof msg.documentMessage?.caption === "string")
        return msg.documentMessage.caption

    return ""
}

/*
 * Quita solamente el comando del comienzo.
 * NO modifica los saltos de línea ni los espacios internos.
 */
function quitarComando(texto, usedPrefix, command) {
    const inicio = `${usedPrefix}${command}`

    if (
        texto.startsWith(inicio)
    ) {
        return texto.slice(inicio.length).trimStart()
    }

    return texto
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

    /*
     * IMPORTANTE:
     * No usamos `text` para procesar el mensaje.
     * Sacamos el contenido directamente de Baileys.
     */
    const textoOriginal = obtenerTextoOriginal(m)

    const contenido = textoOriginal
        ? quitarComando(
            textoOriginal,
            usedPrefix,
            command
        )
        : text || ""

    if (!contenido.trim())
        return m.reply(
            `${e} Usa:\n${usedPrefix + command} <link del grupo> | <texto>`
        )

    /*
     * Busca SOLO el primer |
     *
     * Todo lo que venga después se conserva exactamente,
     * incluyendo ENTERS y espacios.
     */
    const separador = contenido.indexOf("|")

    const link =
        separador !== -1
            ? contenido.slice(0, separador).trim()
            : contenido.trim()

    const caption =
        separador !== -1
            ? contenido.slice(separador + 1).trim()
            : ""

    const match = link.match(
        /(?:https?:\/\/)?chat\.whatsapp\.com\/([0-9A-Za-z]+)/
    )

    if (!match)
        return m.reply(
            `${e} Debes colocar un enlace de grupo válido.`
        )

    const groupCode = match[1]
    let targetChat = null

    try {
        const inviteInfo =
            await conn.groupGetInviteInfo(groupCode)

        if (inviteInfo?.id)
            targetChat = inviteInfo.id

    } catch {
        console.log(
            "⚠️ No se pudo obtener información de la invitación."
        )
    }

    if (!targetChat) {
        try {
            const joined =
                await conn.groupAcceptInvite(groupCode)

            if (
                typeof joined === "string" &&
                joined.includes("@g.us")
            ) {
                targetChat = joined
            }

        } catch {
            console.log(
                "⚠️ El bot posiblemente ya está en el grupo."
            )
        }
    }

    if (!targetChat)
        return m.reply(
            `${e} No pude identificar el grupo. El enlace puede estar vencido, ser inválido o el bot no puede acceder al grupo.`
        )

    const metadata =
        await conn.groupMetadata(targetChat).catch(() => null)

    if (!metadata)
        return m.reply(
            `${e} No pude obtener la información del grupo. Verifica que el bot pueda acceder al grupo.`
        )

    const botJid =
        conn.user?.id ||
        conn.user?.jid

    const users = metadata.participants
        .map(u => u.id)
        .filter(id => id && id !== botJid)

    let mediaSource = null
    let mediaMsg = null
    let mediaType = null

    const actual =
        encontrarMedia(m.message || {})

    if (actual) {
        mediaType = actual.type
        mediaMsg = actual.message
        mediaSource = m
    }

    if (!mediaType && m.quoted) {
        const quotedMessage =
            m.quoted.message ||
            m.quoted.msg ||
            {}

        const quoted =
            encontrarMedia(quotedMessage)

        if (quoted) {
            mediaType = quoted.type
            mediaMsg = quoted.message
            mediaSource = m.quoted
        }
    }

    if (!mediaType) {

        if (!caption)
            return m.reply(
                `${e} Debes escribir un texto después de | o responder a un multimedia.`
            )

        /*
         * caption se manda directamente.
         * No se hace replace, split ni join.
         */
        await conn.sendMessage(
            targetChat,
            {
                text: caption,
                contextInfo: {
                    mentionedJid: users
                }
            },
            {
                quoted: null
            }
        )

        await m.react("✅")
        return
    }

    try {
        await m.react("🕒")

        console.log(
            "📦 Multimedia detectado:",
            mediaType
        )

        const media =
            await descargarMedia(
                conn,
                mediaSource
            )

        if (!media?.length)
            throw new Error(
                "No se pudo descargar el multimedia."
            )

        const msg = {
            contextInfo: {
                mentionedJid: users
            }
        }

        let mediaCaption = ""

        if (mediaType === "imageMessage")
            mediaCaption =
                mediaMsg.imageMessage?.caption || ""

        if (mediaType === "videoMessage")
            mediaCaption =
                mediaMsg.videoMessage?.caption || ""

        if (mediaType === "documentMessage")
            mediaCaption =
                mediaMsg.documentMessage?.caption || ""

        /*
         * Se mantiene exactamente el contenido.
         */
        const finalCaption =
            caption || mediaCaption || ""

        switch (mediaType) {

            case "imageMessage": {
                msg.image = media

                if (finalCaption)
                    msg.caption = finalCaption

                break
            }

            case "videoMessage": {
                msg.video = media

                if (finalCaption)
                    msg.caption = finalCaption

                break
            }

            case "audioMessage": {

                const audioInfo =
                    mediaMsg.audioMessage || {}

                const originalMime =
                    audioInfo.mimetype ||
                    mediaSource.mimetype ||
                    "audio/unknown"

                const extension =
                    obtenerExtensionAudio(
                        originalMime
                    )

                const voice =
                    await convertirNotaDeVoz(
                        media,
                        extension
                    )

                msg.audio = voice
                msg.ptt = true
                msg.mimetype =
                    "audio/ogg; codecs=opus"

                break
            }

            case "stickerMessage": {

                msg.sticker = media

                break
            }

            case "documentMessage": {

                msg.document = media

                msg.fileName =
                    mediaMsg.documentMessage?.fileName ||
                    mediaSource.fileName ||
                    "archivo"

                msg.mimetype =
                    mediaMsg.documentMessage?.mimetype ||
                    mediaSource.mimetype ||
                    "application/octet-stream"

                if (finalCaption)
                    msg.caption = finalCaption

                break
            }

            default:
                throw new Error(
                    "Tipo de multimedia no soportado."
                )
        }

        await conn.sendMessage(
            targetChat,
            msg,
            {
                quoted: null
            }
        )

        if (
            mediaType === "stickerMessage" &&
            finalCaption
        ) {
            await conn.sendMessage(
                targetChat,
                {
                    text: finalCaption,
                    contextInfo: {
                        mentionedJid: users
                    }
                },
                {
                    quoted: null
                }
            )
        }

        await m.react("✅")

    } catch (err) {

        console.error(
            "❌ Error en siu:",
            err
        )

        await m.react("❌").catch(() => {})

        return m.reply(
            `${e} No pude procesar el multimedia.\n\n${err?.message || "Error desconocido."}`
        )
    }
}

handler.help = ["siu"]
handler.tags = ["g"]
handler.command = ["siu"]
handler.owner = true

export default handler
