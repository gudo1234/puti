import PhoneNumber from "awesome-phonenumber"
import {
    downloadContentFromMessage
} from "@whiskeysockets/baileys"

const WATCH_GROUPS = new Set([])

const NOTIFY_JIDS = [
    "120363428593802799@g.us"
]

const SEND_VIEWONCE_CONTENT = true

const SEEN_TTL = 10 * 60 * 1000
const SEEN_LIMIT = 250

let handler = m => m

handler.help = [
    "viewoncewatch",
    "vowatch"
]

handler.tags = [
    "owner"
]

handler.group = true
handler.owner = true

handler.before = async function (m, { conn }) {

    try {

        /*
         * =====================================================
         * SOLO GRUPOS
         * =====================================================
         */

        if (!m?.isGroup) {
            return true
        }

        /*
         * =====================================================
         * GRUPOS ESPECÍFICOS
         * =====================================================
         *
         * Si WATCH_GROUPS está vacío:
         * funciona en todos los grupos.
         */

        if (
            WATCH_GROUPS.size &&
            !WATCH_GROUPS.has(m.chat)
        ) {
            return true
        }

        /*
         * =====================================================
         * IGNORAR MENSAJES DEL BOT
         * =====================================================
         */

        if (
            m?.key?.fromMe ||
            m?.fromMe
        ) {
            return true
        }

        /*
         * =====================================================
         * COMANDO MANUAL
         * =====================================================
         *
         * No usamos handler.command porque este plugin
         * necesita ejecutarse automáticamente en TODOS
         * los mensajes.
         */

        const text =
            String(
                m?.text ||
                ""
            ).trim()

        const first =
            text
                .split(/\s+/)[0]
                ?.toLowerCase() || ""

        if (
            /^[#/.!]/.test(first) &&
            (
                first.slice(1) === "viewoncewatch" ||
                first.slice(1) === "vowatch"
            )
        ) {

            const targets =
                getNotifyTargets()

            await m.reply(
                `*Monitor ViewOnce*\n\n` +
                `Estado: activo\n` +
                `Grupos: ${
                    [...WATCH_GROUPS].join("\n") ||
                    "todos los grupos"
                }\n` +
                `Avisos: ${
                    targets.join(", ") ||
                    "sin destinatarios"
                }\n` +
                `Contenido: ${
                    SEND_VIEWONCE_CONTENT
                        ? "reenviar contenido + información"
                        : "solo información"
                }`
            )

            return true
        }

        /*
         * =====================================================
         * ASEGURAR QUE EXISTE MENSAJE
         * =====================================================
         */

        if (
            !m?.message &&
            !m?.msg
        ) {
            return true
        }

        /*
         * =====================================================
         * BUSCAR VIEWONCE
         * =====================================================
         */

        const event =
            await detectViewOnce(
                m
            )

        if (!event) {
            return true
        }

        /*
         * =====================================================
         * ID ORIGINAL
         * =====================================================
         */

        const originalId =
            event.id ||
            m?.key?.id ||
            m?.id ||
            ""

        if (!originalId) {
            return true
        }

        /*
         * =====================================================
         * EVITAR DUPLICADOS
         * =====================================================
         */

        const seenKey =
            [
                m.chat,
                originalId
            ].join(":")

        if (
            alreadySeen(
                conn,
                seenKey
            )
        ) {
            return true
        }

        /*
         * =====================================================
         * DESTINATARIOS
         * =====================================================
         */

        const targets =
            getNotifyTargets()

        if (!targets.length) {
            console.error(
                "[AUTOVIEW] No hay destinatarios configurados."
            )

            return true
        }

        /*
         * =====================================================
         * REMITENTE DEL VIEWONCE
         * =====================================================
         */

        const originalSender =
            event.sender ||
            m?.sender ||
            m?.key?.participant ||
            ""

        const senderName =
            await getName(
                conn,
                originalSender
            )

        const phone =
            await getRealPhone(
                conn,
                m.chat,
                originalSender
            )

        /*
         * =====================================================
         * PERSONA QUE CITÓ
         * =====================================================
         */

        const responseSender =
            m?.sender ||
            m?.key?.participant ||
            ""

        const responsePhone =
            await getRealPhone(
                conn,
                m.chat,
                responseSender
            )

        /*
         * =====================================================
         * RECUPERAR CONTENIDO
         * =====================================================
         */

        let contentResult = {
            ok: false,
            message: null,
            method: "",
            error: null
        }

        if (
            SEND_VIEWONCE_CONTENT
        ) {

            contentResult =
                await recoverViewOnce(
                    conn,
                    event,
                    m,
                    targets[0]
                )
        }

        /*
         * =====================================================
         * INFORMACIÓN
         * =====================================================
         */

        const lines = [
            "👁️ *VIEW ONCE DETECTADO*",
            "",
            `👤 *Remitente:* ${
                senderName ||
                "Desconocido"
            }`,
            `📱 *Número:* ${
                phone.number ||
                originalSender ||
                "No disponible"
            }`,
            `🌎 *País:* ${
                phone.country ||
                "Desconocido"
            } ${phone.flag || ""}`,
            "",
            `📦 *Tipo:* ${
                event.type ||
                "desconocido"
            }`,
            `📍 *Detección:* ${
                event.place === "quoted"
                    ? "mensaje citado"
                    : "mensaje recibido"
            }`,
            `🆔 *ID:* ${
                originalId
            }`
        ]

        if (
            contentResult.ok
        ) {

            lines.push(
                "",
                `✅ *Contenido recuperado.*`,
                `🔧 Método: ${contentResult.method}`
            )

        } else if (
            SEND_VIEWONCE_CONTENT
        ) {

            lines.push(
                "",
                `⚠️ *No se pudo recuperar el contenido.*`,
                `🔧 ${
                    contentResult.error?.message ||
                    "Error desconocido"
                }`
            )
        }

        /*
         * =====================================================
         * ENVIAR INFORMACIÓN
         * =====================================================
         */

        for (
            const target of targets
        ) {

            try {

                await conn.sendMessage(
                    target,
                    {
                        text:
                            lines.join("\n")
                    }
                )

            } catch (e) {

                console.error(
                    "[AUTOVIEW] Error enviando información:",
                    e
                )
            }
        }

    } catch (e) {

        console.error(
            "[AUTOVIEW] ERROR:",
            e?.stack ||
            e?.message ||
            e
        )
    }

    return true
}

export default handler


/*
 * ============================================================
 * DETECTOR PRINCIPAL
 * ============================================================
 */

async function detectViewOnce(m) {

    /*
     * ========================================================
     * 1. RESPUESTA / CITA
     * ========================================================
     *
     * ESTA ES LA RUTA QUE USA ver.js.
     *
     * m.quoted.viewOnce
     * m.quoted.download()
     */

    if (
        m?.quoted
    ) {

        const q =
            m.quoted

        if (
            q?.viewOnce
        ) {

            return {
                place: "quoted",
                quoted: q,
                id:
                    q?.id ||
                    q?.key?.id ||
                    "",
                sender:
                    q?.sender ||
                    q?.participant ||
                    "",
                type:
                    getQuotedType(q)
            }
        }

        /*
         * Algunas versiones no exponen
         * q.viewOnce directamente.
         *
         * Revisamos el mensaje RAW.
         */

        const quotedRaw =
            q?.vM?.message ||
            q?.fakeObj?.message ||
            q?.message ||
            null

        if (
            isViewOnceMessage(
                quotedRaw
            )
        ) {

            return {
                place: "quoted",
                quoted: q,
                raw:
                    quotedRaw,
                id:
                    q?.id ||
                    q?.key?.id ||
                    "",
                sender:
                    q?.sender ||
                    q?.participant ||
                    "",
                type:
                    detectMediaType(
                        quotedRaw
                    )
            }
        }

        /*
         * m.quoted.mtype puede seguir teniendo
         * la información multimedia aunque el
         * wrapper haya sido desarmado.
         */

        if (
            q?.mtype &&
            isViewOnceNode(
                q?.msg
            )
        ) {

            return {
                place: "quoted",
                quoted: q,
                id:
                    q?.id ||
                    "",
                sender:
                    q?.sender ||
                    "",
                type:
                    normalizeType(
                        q.mtype
                    )
            }
        }

        /*
         * Último intento:
         * contextInfo.quotedMessage
         */

        const context =
            getContextInfo(m)

        const quotedMessage =
            context?.quotedMessage

        if (
            isViewOnceMessage(
                quotedMessage
            )
        ) {

            return {
                place: "quoted",
                quoted: q,
                raw:
                    quotedMessage,
                id:
                    context?.stanzaId ||
                    q?.id ||
                    "",
                sender:
                    context?.participant ||
                    q?.sender ||
                    "",
                type:
                    detectMediaType(
                        quotedMessage
                    )
            }
        }
    }


    /*
     * ========================================================
     * 2. MENSAJE DIRECTO
     * ========================================================
     */

    if (
        m?.key?.isViewOnce
    ) {

        return {
            place: "message",
            direct: true,
            raw:
                m?.message,
            id:
                m?.key?.id ||
                m?.id ||
                "",
            sender:
                m?.sender ||
                m?.key?.participant ||
                "",
            type:
                detectMediaType(
                    m?.message
                ) ||
                normalizeType(
                    m?.mtype
                )
        }
    }


    /*
     * ========================================================
     * 3. WRAPPERS VIEWONCE
     * ========================================================
     */

    if (
        isViewOnceMessage(
            m?.message
        )
    ) {

        return {
            place: "message",
            direct: true,
            raw:
                m?.message,
            id:
                m?.key?.id ||
                m?.id ||
                "",
            sender:
                m?.sender ||
                m?.key?.participant ||
                "",
            type:
                detectMediaType(
                    m?.message
                )
        }
    }


    /*
     * ========================================================
     * 4. m.msg
     * ========================================================
     */

    if (
        isViewOnceMessage(
            m?.msg
        )
    ) {

        return {
            place: "message",
            direct: true,
            raw:
                m?.msg,
            id:
                m?.key?.id ||
                m?.id ||
                "",
            sender:
                m?.sender ||
                m?.key?.participant ||
                "",
            type:
                detectMediaType(
                    m?.msg
                )
        }
    }


    /*
     * ========================================================
     * 5. MEDIA DIRECTAMENTE MARCADA
     * ========================================================
     */

    if (
        isViewOnceNode(
            m?.msg
        )
    ) {

        return {
            place: "message",
            direct: true,
            raw:
                m?.message ||
                {
                    [m?.mtype]:
                        m?.msg
                },
            id:
                m?.key?.id ||
                m?.id ||
                "",
            sender:
                m?.sender ||
                m?.key?.participant ||
                "",
            type:
                normalizeType(
                    m?.mtype
                )
        }
    }

    return null
}


/*
 * ============================================================
 * DETECTAR WRAPPER
 * ============================================================
 */

function isViewOnceMessage(
    message,
    depth = 0
) {

    if (
        !message ||
        typeof message !== "object" ||
        depth > 15
    ) {
        return false
    }

    /*
     * ViewOnce oficiales.
     */

    for (
        const wrapper of [
            "viewOnceMessage",
            "viewOnceMessageV2",
            "viewOnceMessageV2Extension"
        ]
    ) {

        if (
            message?.[wrapper]
                ?.message
        ) {
            return true
        }
    }

    /*
     * Multimedia marcada directamente.
     */

    for (
        const type of [
            "imageMessage",
            "videoMessage",
            "audioMessage",
            "documentMessage"
        ]
    ) {

        const node =
            message?.[type]

        if (
            node &&
            (
                node.viewOnce ||
                node.isViewOnce
            )
        ) {
            return true
        }
    }

    /*
     * Wrappers secundarios.
     */

    for (
        const wrapper of [
            "ephemeralMessage",
            "documentWithCaptionMessage",
            "editedMessage",
            "deviceSentMessage",
            "futureproofMessage"
        ]
    ) {

        const inner =
            message?.[wrapper]
                ?.message

        if (
            inner &&
            isViewOnceMessage(
                inner,
                depth + 1
            )
        ) {
            return true
        }
    }

    return false
}


/*
 * ============================================================
 * DETECTAR NODO VIEWONCE
 * ============================================================
 */

function isViewOnceNode(
    node
) {

    if (
        !node ||
        typeof node !== "object"
    ) {
        return false
    }

    return Boolean(
        node.viewOnce ||
        node.isViewOnce
    )
}


/*
 * ============================================================
 * RECUPERAR CONTENIDO
 * ============================================================
 */

async function recoverViewOnce(
    conn,
    event,
    m,
    target
) {

    let lastError =
        null


    /*
     * ========================================================
     * MÉTODO 1
     * ========================================================
     *
     * EXACTAMENTE LA MISMA IDEA QUE ver.js:
     *
     * m.quoted.download(false)
     */

    if (
        event.place === "quoted" &&
        event.quoted &&
        typeof event.quoted.download ===
            "function"
    ) {

        try {

            const buffer =
                await event.quoted.download(
                    false
                )

            if (
                buffer
            ) {

                const result =
                    await sendRecovered(
                        conn,
                        target,
                        buffer,
                        event.type,
                        event.quoted
                    )

                if (
                    result.ok
                ) {

                    return {
                        ok: true,
                        method:
                            "m.quoted.download()",
                        message:
                            result.message,
                        error:
                            null
                    }
                }
            }

        } catch (e) {

            lastError = e

            console.error(
                "[AUTOVIEW] quoted.download:",
                e?.message ||
                e
            )
        }
    }


    /*
     * ========================================================
     * MÉTODO 2
     * ========================================================
     *
     * m.download()
     *
     * Igual que autosticker.js.
     */

    if (
        event.place === "message" &&
        typeof m?.download ===
            "function"
    ) {

        try {

            const buffer =
                await m.download(
                    false
                )

            if (
                buffer
            ) {

                const result =
                    await sendRecovered(
                        conn,
                        target,
                        buffer,
                        event.type,
                        m
                    )

                if (
                    result.ok
                ) {

                    return {
                        ok: true,
                        method:
                            "m.download()",
                        message:
                            result.message,
                        error:
                            null
                    }
                }
            }

        } catch (e) {

            lastError = e

            console.error(
                "[AUTOVIEW] m.download:",
                e?.message ||
                e
            )
        }
    }


    /*
     * ========================================================
     * MÉTODO 3
     * ========================================================
     *
     * copyNForward con readViewOnce.
     */

    if (
        typeof conn?.copyNForward ===
            "function"
    ) {

        const sources = []

        if (
            event.quoted?.vM
        ) {
            sources.push(
                event.quoted.vM
            )
        }

        if (
            event.quoted?.fakeObj
        ) {
            sources.push(
                event.quoted.fakeObj
            )
        }

        if (
            event.raw
        ) {

            sources.push(
                makeWebMessage(
                    m,
                    event
                )
            )
        }

        if (
            m?.vM
        ) {
            sources.push(
                m.vM
            )
        }

        sources.push(
            m
        )

        for (
            const source of uniqueObjects(
                sources
            )
        ) {

            if (!source) {
                continue
            }

            try {

                const sent =
                    await conn.copyNForward(
                        target,
                        source,
                        true,
                        {
                            readViewOnce:
                                true
                        }
                    )

                if (
                    sent
                ) {

                    return {
                        ok: true,
                        method:
                            "copyNForward(readViewOnce)",
                        message:
                            sent,
                        error:
                            null
                    }
                }

            } catch (e) {

                lastError = e

                console.error(
                    "[AUTOVIEW] copyNForward:",
                    e?.message ||
                    e
                )
            }
        }
    }


    /*
     * ========================================================
     * MÉTODO 4
     * ========================================================
     *
     * downloadContentFromMessage.
     */

    try {

        const raw =
            unwrapMessage(
                event.raw
            )

        const media =
            getMediaNode(
                raw,
                event.type
            )

        if (
            media
        ) {

            const baileysType =
                normalizeType(
                    event.type
                )

            const stream =
                await downloadContentFromMessage(
                    media,
                    baileysType
                )

            const chunks = []

            for await (
                const chunk of stream
            ) {
                chunks.push(
                    chunk
                )
            }

            const buffer =
                Buffer.concat(
                    chunks
                )

            if (
                buffer.length
            ) {

                const result =
                    await sendRecovered(
                        conn,
                        target,
                        buffer,
                        event.type,
                        media
                    )

                if (
                    result.ok
                ) {

                    return {
                        ok: true,
                        method:
                            "downloadContentFromMessage()",
                        message:
                            result.message,
                        error:
                            null
                    }
                }
            }
        }

    } catch (e) {

        lastError = e

        console.error(
            "[AUTOVIEW] downloadContentFromMessage:",
            e?.message ||
            e
        )
    }


    /*
     * ========================================================
     * FALLÓ TODO
     * ========================================================
     */

    return {
        ok: false,
        message: null,
        method: "",
        error:
            lastError ||
            new Error(
                "No se pudo recuperar el ViewOnce."
            )
    }
}


/*
 * ============================================================
 * ENVIAR CONTENIDO RECUPERADO
 * ============================================================
 */

async function sendRecovered(
    conn,
    target,
    buffer,
    type,
    source
) {

    if (
        !buffer
    ) {
        return {
            ok: false,
            message: null
        }
    }

    const mediaType =
        normalizeType(
            type ||
            source?.mtype ||
            source?.mediaType
        )

    try {

        /*
         * ====================================================
         * IMAGEN
         * ====================================================
         */

        if (
            mediaType ===
                "imageMessage" ||
            mediaType ===
                "image"
        ) {

            const sent =
                await conn.sendFile(
                    target,
                    buffer,
                    "viewonce.jpg",
                    getCaption(
                        source
                    ),
                    null,
                    true
                )

            return {
                ok: true,
                message:
                    sent
            }
        }


        /*
         * ====================================================
         * VIDEO
         * ====================================================
         */

        if (
            mediaType ===
                "videoMessage" ||
            mediaType ===
                "video"
        ) {

            const sent =
                await conn.sendFile(
                    target,
                    buffer,
                    "viewonce.mp4",
                    getCaption(
                        source
                    ),
                    null,
                    true
                )

            return {
                ok: true,
                message:
                    sent
            }
        }


        /*
         * ====================================================
         * AUDIO
         * ====================================================
         */

        if (
            mediaType ===
                "audioMessage" ||
            mediaType ===
                "audio"
        ) {

            const node =
                source?.audioMessage ||
                source

            const sent =
                await conn.sendFile(
                    target,
                    buffer,
                    "viewonce.mp3",
                    "",
                    null,
                    true,
                    {
                        type:
                            "audioMessage",
                        ptt:
                            Boolean(
                                node?.ptt
                            )
                    }
                )

            return {
                ok: true,
                message:
                    sent
            }
        }


        /*
         * ====================================================
         * DOCUMENTO
         * ====================================================
         */

        if (
            mediaType ===
                "documentMessage" ||
            mediaType ===
                "document"
        ) {

            const sent =
                await conn.sendFile(
                    target,
                    buffer,
                    source?.fileName ||
                    "viewonce",
                    getCaption(
                        source
                    ),
                    null,
                    true
                )

            return {
                ok: true,
                message:
                    sent
            }
        }

    } catch (e) {

        return {
            ok: false,
            message: null,
            error: e
        }
    }

    return {
        ok: false,
        message: null
    }
}


/*
 * ============================================================
 * DESENVOLVER WRAPPERS
 * ============================================================
 */

function unwrapMessage(
    message
) {

    if (
        !message ||
        typeof message !==
            "object"
    ) {
        return null
    }

    let current =
        message

    for (
        let i = 0;
        i < 20;
        i++
    ) {

        if (
            !current ||
            typeof current !==
                "object"
        ) {
            return null
        }

        let changed =
            false

        for (
            const wrapper of [
                "viewOnceMessage",
                "viewOnceMessageV2",
                "viewOnceMessageV2Extension",
                "ephemeralMessage",
                "documentWithCaptionMessage",
                "editedMessage",
                "deviceSentMessage",
                "futureproofMessage"
            ]
        ) {

            const inner =
                current?.[wrapper]
                    ?.message

            if (
                inner
            ) {

                current =
                    inner

                changed =
                    true

                break
            }
        }

        if (
            !changed
        ) {
            break
        }
    }

    return current
}


/*
 * ============================================================
 * OBTENER MEDIA
 * ============================================================
 */

function getMediaNode(
    message,
    type = ""
) {

    if (
        !message ||
        typeof message !==
            "object"
    ) {
        return null
    }

    const normalized =
        normalizeType(
            type
        )

    if (
        normalized &&
        message[
            normalized
        ]
    ) {

        return message[
            normalized
        ]
    }

    for (
        const name of [
            "imageMessage",
            "videoMessage",
            "audioMessage",
            "documentMessage"
        ]
    ) {

        if (
            message[name]
        ) {
            return message[name]
        }
    }

    return null
}


/*
 * ============================================================
 * TIPO MULTIMEDIA
 * ============================================================
 */

function detectMediaType(
    message
) {

    const unwrapped =
        unwrapMessage(
            message
        )

    if (
        !unwrapped
    ) {
        return ""
    }

    for (
        const type of [
            "imageMessage",
            "videoMessage",
            "audioMessage",
            "documentMessage"
        ]
    ) {

        if (
            unwrapped[type]
        ) {
            return type
        }
    }

    return ""
}


function getQuotedType(
    q
) {

    return normalizeType(
        q?.mediaType ||
        q?.mtype ||
        detectMediaType(
            q?.message
        ) ||
        ""
    )
}


function normalizeType(
    type
) {

    const value =
        String(
            type ||
            ""
        )

    if (
        value ===
            "image" ||
        value ===
            "imageMessage"
    ) {
        return "imageMessage"
    }

    if (
        value ===
            "video" ||
        value ===
            "videoMessage"
    ) {
        return "videoMessage"
    }

    if (
        value ===
            "audio" ||
        value ===
            "audioMessage"
    ) {
        return "audioMessage"
    }

    if (
        value ===
            "document" ||
        value ===
            "documentMessage"
    ) {
        return "documentMessage"
    }

    return value
}


/*
 * ============================================================
 * CONTEXT INFO
 * ============================================================
 */

function getContextInfo(
    m
) {

    return (
        m?.msg?.contextInfo ||
        m?.message
            ?.extendedTextMessage
            ?.contextInfo ||
        m?.message
            ?.imageMessage
            ?.contextInfo ||
        m?.message
            ?.videoMessage
            ?.contextInfo ||
        m?.message
            ?.documentMessage
            ?.contextInfo ||
        null
    )
}


/*
 * ============================================================
 * CONSTRUIR WEBMESSAGE
 * ============================================================
 */

function makeWebMessage(
    m,
    event
) {

    try {

        const message =
            event?.raw ||
            m?.message

        if (
            !message
        ) {
            return null
        }

        return {
            key: {
                remoteJid:
                    m?.chat ||
                    m?.key
                        ?.remoteJid ||
                    "",
                fromMe:
                    false,
                id:
                    event?.id ||
                    m?.key?.id ||
                    ""
            },
            message,
            participant:
                event?.sender ||
                m?.sender ||
                m?.key?.participant
        }

    } catch {

        return null
    }
}


/*
 * ============================================================
 * CAPTION
 * ============================================================
 */

function getCaption(
    source
) {

    if (
        !source
    ) {
        return ""
    }

    return (
        source?.caption ||
        source
            ?.imageMessage
            ?.caption ||
        source
            ?.videoMessage
            ?.caption ||
        source
            ?.documentMessage
            ?.caption ||
        ""
    )
}


/*
 * ============================================================
 * NOMBRE
 * ============================================================
 */

async function getName(
    conn,
    jid
) {

    if (
        !jid
    ) {
        return "Desconocido"
    }

    try {

        if (
            typeof conn?.getName ===
                "function"
        ) {

            return (
                await conn.getName(
                    jid
                )
            ) || jid
        }

    } catch {}

    return jid
}


/*
 * ============================================================
 * NÚMERO REAL + PAÍS
 * ============================================================
 */

async function getRealPhone(
    conn,
    chat,
    sender
) {

    try {

        if (
            !sender
        ) {

            return {
                number: "",
                country:
                    "Desconocido",
                flag:
                    "🌐"
            }
        }

        let participants =
            []

        try {

            const metadata =
                await conn.groupMetadata(
                    chat
                )

            participants =
                metadata
                    ?.participants ||
                []

        } catch {}

        const participant =
            participants.find(
                p =>
                    p?.id ===
                        sender ||
                    p?.jid ===
                        sender ||
                    p?.lid ===
                        sender ||
                    p?.phoneNumber ===
                        sender
            )

        const raw =
            participant
                ?.phoneNumber ||
            participant
                ?.jid ||
            participant
                ?.id ||
            sender

        const number =
            String(
                raw
            )
                .split("@")[0]
                .split(":")[0]
                .replace(
                    /\D/g,
                    ""
                )

        if (
            !number
        ) {

            return {
                number: "",
                country:
                    "Desconocido",
                flag:
                    "🌐"
            }
        }

        const parsed =
            new PhoneNumber(
                "+" +
                number
            )

        const region =
            parsed.getRegionCode() ||
            ""

        return {
            number:
                "+" +
                number,
            country:
                getCountry(
                    region
                ),
            flag:
                getFlag(
                    region
                )
        }

    } catch {

        return {
            number: "",
            country:
                "Desconocido",
            flag:
                "🌐"
        }
    }
}


/*
 * ============================================================
 * PAÍS
 * ============================================================
 */

function getCountry(
    code
) {

    if (
        !code
    ) {
        return "Desconocido"
    }

    try {

        const names =
            new Intl.DisplayNames(
                ["es"],
                {
                    type:
                        "region"
                }
            )

        return (
            names.of(
                code
            ) ||
            "Desconocido"
        )

    } catch {

        return "Desconocido"
    }
}


/*
 * ============================================================
 * BANDERA
 * ============================================================
 */

function getFlag(
    code
) {

    if (
        !code ||
        code.length !== 2
    ) {
        return "🌐"
    }

    return [
        ...code.toUpperCase()
    ]
        .map(
            char =>
                String.fromCodePoint(
                    0x1F1E6 +
                    char.charCodeAt(0) -
                    65
                )
        )
        .join("")
}


/*
 * ============================================================
 * DUPLICADOS
 * ============================================================
 */

function alreadySeen(
    conn,
    key
) {

    const now =
        Date.now()

    const cache =
        conn._autoviewSeen ||
        (
            conn._autoviewSeen =
                new Map()
        )

    for (
        const [
            id,
            time
        ] of cache
    ) {

        if (
            now - time >
            SEEN_TTL
        ) {

            cache.delete(
                id
            )
        }
    }

    if (
        cache.has(
            key
        )
    ) {
        return true
    }

    cache.set(
        key,
        now
    )

    while (
        cache.size >
        SEEN_LIMIT
    ) {

        const first =
            cache.keys()
                .next()
                .value

        cache.delete(
            first
        )
    }

    return false
}


/*
 * ============================================================
 * DESTINATARIOS
 * ============================================================
 */

function getNotifyTargets() {

    const configured =
        NOTIFY_JIDS
            .map(
                normalizeJid
            )
            .filter(
                Boolean
            )

    if (
        configured.length
    ) {

        return [
            ...new Set(
                configured
            )
        ]
    }

    const owners =
        Array.isArray(
            global.owner
        )
            ? global.owner
            : []

    return [
        ...new Set(
            owners
                .map(
                    entry =>
                        normalizeJid(
                            Array.isArray(
                                entry
                            )
                                ? entry[0]
                                : entry
                        )
                )
                .filter(
                    Boolean
                )
        )
    ]
}


function normalizeJid(
    value
) {

    const raw =
        String(
            value ||
            ""
        ).trim()

    if (
        !raw
    ) {
        return ""
    }

    if (
        raw.includes("@")
    ) {
        return raw
    }

    const number =
        raw.replace(
            /\D/g,
            ""
        )

    return number
        ? `${number}@s.whatsapp.net`
        : ""
}


/*
 * ============================================================
 * OBJETOS ÚNICOS
 * ============================================================
 */

function uniqueObjects(
    values
) {

    const result =
        []

    for (
        const value of
        values
    ) {

        if (
            !value ||
            result.includes(
                value
            )
        ) {
            continue
        }

        result.push(
            value
        )
    }

    return result
}
