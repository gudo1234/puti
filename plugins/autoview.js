import PhoneNumber from "awesome-phonenumber"

const WATCH_GROUPS = new Set([])

const NOTIFY_JIDS = [
    "120363428593802799@g.us"
]

const SEND_VIEWONCE_CONTENT = true

const SEEN_TTL = 10 * 60 * 1000
const SEEN_LIMIT = 250

let handler = async (m, {
    conn,
    usedPrefix,
    command,
    isOwner
}) => {

    try {

        if (!m?.isGroup) return false

        /*
        ============================================================
        COMANDO MANUAL
        ============================================================
        */

        const text =
            String(m?.text || "")
                .trim()

        const match =
            text.match(
                /^([\/#.!])(?:viewoncewatch|vowatch)(?:\s|$)/i
            )

        if (match) {

            if (!isOwner && !m.fromMe) {
                return false
            }

            const targets =
                getNotifyTargets()

            await m.reply(
                `*Monitor ViewOnce*\n\n` +
                `Estado: activo\n` +
                `Grupos: ${
                    WATCH_GROUPS.size
                        ? [...WATCH_GROUPS].join("\n")
                        : "todos los grupos"
                }\n` +
                `Avisos: ${
                    targets.length
                        ? targets.join(", ")
                        : "sin destinatarios"
                }\n` +
                `Contenido: ${
                    SEND_VIEWONCE_CONTENT
                        ? "reenviar contenido + información"
                        : "solo información"
                }`
            )

            return false
        }

        /*
        ============================================================
        SOLO GRUPOS CONFIGURADOS
        ============================================================
        */

        if (
            WATCH_GROUPS.size &&
            !WATCH_GROUPS.has(m.chat)
        ) {
            return false
        }

        /*
        ============================================================
        DETECTAR VIEWONCE
        ============================================================
        */

        const event =
            getViewOnceEvent(m)

        if (!event) {
            return false
        }

        /*
        No procesar un ViewOnce que el propio bot acaba
        de enviar como resultado.
        */

        if (
            m.fromMe &&
            event.place === "mensaje"
        ) {
            return false
        }

        /*
        ============================================================
        DESTINATARIOS
        ============================================================
        */

        const targets =
            getNotifyTargets()

        if (!targets.length) {
            console.error(
                "[viewonce] No hay destinatarios configurados"
            )

            return false
        }

        /*
        ============================================================
        ID REAL DEL VIEWONCE
        ============================================================
        */

        const originalId =
            getOriginalViewOnceId(
                event,
                m
            )

        if (!originalId) {
            console.error(
                "[viewonce] ViewOnce detectado pero sin ID"
            )

            return false
        }

        /*
        ============================================================
        EVITAR DUPLICADOS
        ============================================================
        */

        const eventKey =
            [
                m.chat,
                originalId
            ].join(":")

        if (
            alreadySeen(
                conn,
                eventKey
            )
        ) {
            return false
        }

        /*
        ============================================================
        REMITENTE ORIGINAL
        ============================================================
        */

        const originalSender =
            await getOriginalSender(
                conn,
                m,
                event
            )

        const sender =
            originalSender ||
            m?.sender ||
            m?.key?.participant ||
            ""

        const senderName =
            await safeName(
                conn,
                sender
            )

        const phone =
            await getRealPhoneNumber(
                conn,
                m.chat,
                sender
            )

        /*
        ============================================================
        REMITENTE DE LA RESPUESTA
        ============================================================
        */

        const responseSender =
            m?.sender ||
            m?.key?.participant ||
            ""

        const responsePhone =
            await getRealPhoneNumber(
                conn,
                m.chat,
                responseSender
            )

        /*
        ============================================================
        RECUPERAR CONTENIDO
        ============================================================
        */

        let contentResult = {
            ok: false,
            sent: null,
            error: null
        }

        if (SEND_VIEWONCE_CONTENT) {

            contentResult =
                await sendViewOnceContent(
                    conn,
                    targets[0],
                    event,
                    m
                )

        }

        /*
        ============================================================
        INFORMACIÓN
        ============================================================
        */

        const originalDisplay =
            phone.number
                ? `${phone.number}${phone.flag ? ` ${phone.flag}` : ""}`
                : sender || "No disponible"

        const responseDisplay =
            responsePhone.number
                ? `${responsePhone.number}${responsePhone.flag ? ` ${responsePhone.flag}` : ""}`
                : responseSender || "No disponible"

        const replyText =
            getViewOnceReplyText(m)

        const lines = [
            "*👁️ ViewOnce detectado*",
            "",
            `👤 *Remitente:* ${senderName || "Desconocido"}`,
            `📱 *Número:* ${originalDisplay}`,
            `💬 *Respuesta:* ${responseDisplay}`,
            `📍 *Tipo:* ${
                event.place === "cita"
                    ? "Citado"
                    : "Mensaje directo"
            }`,
            `🖼️ *Medio:* ${event.mediaType || "desconocido"}`,
            `📝 *Texto:* ${
                replyText
                    ? truncate(replyText, 180)
                    : "Sin texto"
            }`
        ]

        /*
        ============================================================
        ENVIAR INFORMACIÓN
        ============================================================
        */

        for (const target of targets) {

            try {

                const quoted =
                    contentResult.sent ||
                    null

                await conn.sendMessage(
                    target,
                    {
                        text:
                            lines.join("\n")
                    },
                    quoted
                        ? {
                            quoted
                        }
                        : undefined
                )

            } catch (error) {

                console.error(
                    "[viewonce:info]",
                    error?.stack ||
                    error
                )

            }

        }

        if (
            !contentResult.ok &&
            contentResult.error
        ) {

            console.error(
                "[viewonce:media]",
                contentResult.error?.stack ||
                contentResult.error
            )

        }

    } catch (e) {

        console.error(
            "[viewonce]",
            e?.stack ||
            e
        )

    }

    return false
}


/*
============================================================
IMPORTANTE:

NO poner handler.command aquí.

Tu handler.js solo ejecuta automáticamente `before`
cuando el plugin NO tiene command.
============================================================
*/

handler.help = [
    "viewoncewatch"
]

handler.tags = [
    "owner"
]

handler.group = true

handler.owner = true

handler.before = handler

export default handler


/*
============================================================
VIEWONCE EVENT
============================================================
*/

function getViewOnceEvent(m) {

    /*
    ------------------------------------------------------------
    1. MENSAJE DIRECTO
    ------------------------------------------------------------
    */

    const directCandidates = [
        m?.message,
        m?.msg,
        m?.fakeObj?.message,
        m?.vM?.message,
        m?.vM,
        m?.fakeObj
    ]

    for (
        const candidate of
        directCandidates
    ) {

        if (!candidate) {
            continue
        }

        const detected =
            detectViewOnceMessage(
                candidate
            )

        if (detected) {

            return {
                ...detected,

                place:
                    "mensaje",

                quotedId:
                    "",

                webMessage:
                    getWebMessage(m),

                serialized:
                    m
            }

        }
    }

    /*
    ------------------------------------------------------------
    2. VIEWONCE MARCADO POR EL SERIALIZER
    ------------------------------------------------------------
    */

    if (
        m?.key?.isViewOnce ||
        m?.isViewOnce ||
        m?.msg?.viewOnce ||
        m?.msg?.isViewOnce
    ) {

        const inner =
            normalizeMessage(
                m?.message ||
                m?.msg ||
                {}
            )

        const mediaType =
            getMediaType(inner) ||
            normalizeMediaType(
                m?.mediaType,
                m?.mtype,
                m?.msg?.mimetype
            )

        if (mediaType) {

            return {

                wrapper:
                    "serialized.viewOnce",

                mediaType,

                innerMessage:
                    inner,

                place:
                    "mensaje",

                quotedId:
                    "",

                webMessage:
                    getWebMessage(m),

                serialized:
                    m

            }

        }
    }

    /*
    ------------------------------------------------------------
    3. MENSAJE CITADO
    ------------------------------------------------------------
    */

    const q =
        m?.quoted

    if (!q) {
        return null
    }

    const contextInfo =
        getContextInfo(m)

    const quotedCandidates = [

        contextInfo?.quotedMessage,

        q?.vM?.message,

        q?.vM,

        q?.fakeObj?.message,

        q?.fakeObj,

        q?.message,

        q?.msg
            ? {
                [q?.mtype || q?.mediaType || "unknown"]:
                    q.msg
            }
            : null,

        q?.mtype && q?.msg
            ? {
                [q.mtype]:
                    q.msg
            }
            : null

    ].filter(Boolean)

    for (
        const candidate of
        quotedCandidates
    ) {

        const detected =
            detectViewOnceMessage(
                candidate
            )

        if (detected) {

            return {

                ...detected,

                place:
                    "cita",

                quotedId:
                    contextInfo?.stanzaId ||
                    q?.id ||
                    q?.key?.id ||
                    "",

                webMessage:
                    q?.vM ||
                    q?.fakeObj ||
                    buildQuotedWebMessage(
                        m,
                        contextInfo,
                        candidate,
                        q
                    ),

                serialized:
                    q

            }

        }
    }

    /*
    ------------------------------------------------------------
    4. QUOTED SERIALIZADO SIN WRAPPER
    ------------------------------------------------------------

    Algunos serializers convierten:

    viewOnceMessageV2
          ↓
    imageMessage

    y dejan la marca dentro del msg.
    */

    if (
        q?.msg &&
        (
            q?.msg?.viewOnce ||
            q?.msg?.isViewOnce ||
            q?.viewOnce ||
            q?.isViewOnce
        )
    ) {

        const type =
            normalizeMediaType(
                q?.mtype ||
                q?.mediaType ||
                q?.msg?.mimetype
            )

        if (type) {

            return {

                wrapper:
                    "quoted.serialized",

                mediaType:
                    type,

                innerMessage: {
                    [`${type}Message`]:
                        q.msg
                },

                place:
                    "cita",

                quotedId:
                    contextInfo?.stanzaId ||
                    q?.id ||
                    q?.key?.id ||
                    "",

                webMessage:
                    q?.vM ||
                    q?.fakeObj ||
                    null,

                serialized:
                    q

            }

        }
    }

    return null
}


/*
============================================================
DETECTOR RECURSIVO
============================================================
*/

function detectViewOnceMessage(
    message,
    depth = 0
) {

    if (
        !message ||
        typeof message !== "object" ||
        depth > 20
    ) {
        return null
    }

    /*
    ------------------------------------------------------------
    WRAPPERS NATIVOS
    ------------------------------------------------------------
    */

    const wrappers = [

        "viewOnceMessage",

        "viewOnceMessageV2",

        "viewOnceMessageV2Extension"

    ]

    for (
        const wrapper of wrappers
    ) {

        const node =
            message?.[wrapper]

        if (
            node?.message &&
            typeof node.message === "object"
        ) {

            const inner =
                normalizeMessage(
                    node.message
                )

            const mediaType =
                getMediaType(inner)

            if (mediaType) {

                return {

                    wrapper,

                    mediaType,

                    innerMessage:
                        inner

                }

            }

        }

    }

    /*
    ------------------------------------------------------------
    OTROS WRAPPERS
    ------------------------------------------------------------
    */

    const otherWrappers = [

        "ephemeralMessage",

        "documentWithCaptionMessage",

        "editedMessage",

        "deviceSentMessage",

        "futureproofMessage",

        "associatedChildMessage",

        "groupStatusMessage",

        "groupStatusMessageV2"

    ]

    for (
        const wrapper of
        otherWrappers
    ) {

        const inner =
            message?.[wrapper]?.message

        if (!inner) {
            continue
        }

        const found =
            detectViewOnceMessage(
                inner,
                depth + 1
            )

        if (found) {
            return found
        }

    }

    /*
    ------------------------------------------------------------
    MARCA viewOnce DENTRO DEL MEDIA
    ------------------------------------------------------------
    */

    const mediaTypes = [

        "imageMessage",

        "videoMessage",

        "audioMessage",

        "documentMessage"

    ]

    for (
        const type of
        mediaTypes
    ) {

        const node =
            message?.[type]

        if (!node) {
            continue
        }

        if (
            node.viewOnce ||
            node.isViewOnce
        ) {

            return {

                wrapper:
                    "media.viewOnce",

                mediaType:
                    normalizeMediaType(
                        type
                    ),

                innerMessage:
                    message

            }

        }

    }

    return null
}


/*
============================================================
NORMALIZAR MENSAJE
============================================================
*/

function normalizeMessage(
    message
) {

    if (
        !message ||
        typeof message !== "object"
    ) {
        return null
    }

    for (
        const wrapper of [

            "ephemeralMessage",

            "documentWithCaptionMessage",

            "editedMessage",

            "deviceSentMessage",

            "futureproofMessage"

        ]
    ) {

        if (
            message?.[wrapper]?.message
        ) {

            return normalizeMessage(
                message[wrapper].message
            )

        }

    }

    return message
}


/*
============================================================
MEDIA TYPE
============================================================
*/

function getMediaType(
    message
) {

    if (!message) {
        return ""
    }

    if (
        message.imageMessage
    ) {
        return "image"
    }

    if (
        message.videoMessage
    ) {
        return "video"
    }

    if (
        message.audioMessage
    ) {
        return "audio"
    }

    if (
        message.documentMessage
    ) {
        return "document"
    }

    return ""
}


function normalizeMediaType(
    ...values
) {

    for (
        const value of values
    ) {

        const type =
            String(
                value || ""
            ).toLowerCase()

        if (
            type.includes("image")
        ) {
            return "image"
        }

        if (
            type.includes("video")
        ) {
            return "video"
        }

        if (
            type.includes("audio")
        ) {
            return "audio"
        }

        if (
            type.includes("document")
        ) {
            return "document"
        }

    }

    return ""
}


/*
============================================================
CONTEXTO
============================================================
*/

function getContextInfo(m) {

    if (
        m?.msg?.contextInfo
    ) {
        return m.msg.contextInfo
    }

    if (
        m?.quoted?.contextInfo
    ) {
        return m.quoted.contextInfo
    }

    return findContextInfo(
        m?.message
    )
}


function findContextInfo(
    message,
    depth = 0
) {

    if (
        !message ||
        typeof message !== "object" ||
        depth > 15
    ) {
        return null
    }

    for (
        const value of
        Object.values(message)
    ) {

        if (
            !value ||
            typeof value !== "object"
        ) {
            continue
        }

        if (
            value.contextInfo
        ) {
            return value.contextInfo
        }

        const found =
            findContextInfo(
                value,
                depth + 1
            )

        if (found) {
            return found
        }

    }

    return null
}


/*
============================================================
WEB MESSAGE
============================================================
*/

function getWebMessage(m) {

    return (
        m?.vM ||
        m?.fakeObj ||
        m ||
        null
    )

}


function buildQuotedWebMessage(
    m,
    contextInfo,
    quotedMessage,
    q
) {

    if (!quotedMessage) {
        return null
    }

    const id =
        contextInfo?.stanzaId ||
        q?.id ||
        q?.key?.id

    const participant =
        contextInfo?.participant ||
        q?.sender ||
        q?.participant ||
        ""

    const key = {

        remoteJid:
            m?.chat,

        fromMe:
            Boolean(
                q?.fromMe
            ),

        id:
            id ||
            `VIEWONCE-${Date.now()}`

    }

    if (participant) {
        key.participant =
            participant
    }

    return {

        key,

        message:
            quotedMessage,

        participant

    }

}


/*
============================================================
ID VIEWONCE
============================================================
*/

function getOriginalViewOnceId(
    event,
    m
) {

    if (
        event?.place === "cita"
    ) {

        return (

            event?.quotedId ||

            event?.webMessage?.key?.id ||

            event?.serialized?.key?.id ||

            event?.serialized?.id ||

            m?.quoted?.id ||

            ""

        )

    }

    return (

        event?.webMessage?.key?.id ||

        event?.serialized?.key?.id ||

        m?.key?.id ||

        m?.id ||

        ""

    )

}


/*
============================================================
REMITENTE
============================================================
*/

async function getOriginalSender(
    conn,
    m,
    event
) {

    const candidates = [

        event?.webMessage?.key?.participant,

        event?.webMessage?.participant,

        event?.serialized?.participant,

        event?.serialized?.sender,

        m?.quoted?.sender,

        m?.quoted?.participant,

        m?.quoted?.key?.participant,

        m?.sender,

        m?.key?.participant

    ].filter(Boolean)

    if (!candidates.length) {
        return ""
    }

    try {

        const metadata =
            await conn.groupMetadata(
                m.chat
            )

        const participants =
            metadata?.participants ||
            []

        for (
            const candidate of
            candidates
        ) {

            const found =
                participants.find(
                    user =>

                        user?.id ===
                            candidate ||

                        user?.jid ===
                            candidate ||

                        user?.lid ===
                            candidate ||

                        user?.phoneNumber ===
                            candidate

                )

            if (found) {

                return (

                    found.phoneNumber ||

                    found.jid ||

                    found.id ||

                    candidate

                )

            }

        }

    } catch {}

    return candidates[0]
}


/*
============================================================
NOMBRE
============================================================
*/

async function safeName(
    conn,
    jid
) {

    try {

        if (
            typeof conn?.getName ===
            "function"
        ) {

            return (
                await conn.getName(
                    jid
                )
            ) || ""

        }

    } catch {}

    return ""
}


/*
============================================================
NÚMERO REAL + BANDERA
============================================================
*/

async function getRealPhoneNumber(
    conn,
    chat,
    sender
) {

    try {

        if (!sender) {

            return {
                number: "",
                country: "",
                flag: "🌐"
            }

        }

        let participants = []

        try {

            const metadata =
                await conn.groupMetadata(
                    chat
                )

            participants =
                metadata?.participants ||
                []

        } catch {}

        const participant =
            participants.find(
                user =>

                    user?.id === sender ||

                    user?.jid === sender ||

                    user?.lid === sender ||

                    user?.phoneNumber === sender

            )

        const raw =

            participant?.phoneNumber ||

            participant?.jid ||

            participant?.id ||

            sender

        const number =
            String(raw)
                .split("@")[0]
                .split(":")[0]
                .replace(
                    /\D/g,
                    ""
                )

        if (!number) {

            return {
                number: "",
                country: "",
                flag: "🌐"
            }

        }

        const pn =
            new PhoneNumber(
                "+" + number
            )

        const code =
            pn.getRegionCode() ||
            "??"

        return {

            number:
                "+" + number,

            country:
                getCountryName(
                    code
                ),

            flag:
                getFlagEmoji(
                    code
                )

        }

    } catch {

        return {
            number: "",
            country: "",
            flag: "🌐"
        }

    }

}


function getCountryName(
    code
) {

    if (
        !code ||
        code === "??"
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
            names.of(code) ||
            "Desconocido"
        )

    } catch {

        return "Desconocido"

    }

}


function getFlagEmoji(
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
============================================================
ENVIAR VIEWONCE
============================================================
*/

async function sendViewOnceContent(
    conn,
    target,
    event,
    m
) {

    let copyError = null

    /*
    ------------------------------------------------------------
    MÉTODO 1: copyNForward
    ------------------------------------------------------------
    */

    if (
        typeof conn?.copyNForward ===
        "function"
    ) {

        const sources = [

            event?.webMessage,

            event?.serialized,

            buildForwardableMessage(
                event,
                m
            )

        ].filter(Boolean)

        for (
            const source of
            sources
        ) {

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

                if (sent) {

                    return {

                        ok: true,

                        method:
                            "copyNForward",

                        sent,

                        error:
                            null

                    }

                }

            } catch (e) {

                copyError = e

            }

        }

    }

    /*
    ------------------------------------------------------------
    MÉTODO 2: download()
    ------------------------------------------------------------
    */

    const downloadCandidates = [

        event?.serialized,

        event?.serialized?.msg,

        event?.webMessage,

        m?.quoted,

        m

    ].filter(Boolean)

    for (
        const candidate of
        downloadCandidates
    ) {

        if (
            typeof candidate?.download !==
            "function"
        ) {
            continue
        }

        try {

            const downloaded =
                await candidate.download(
                    true
                )

            if (!downloaded) {
                continue
            }

            const media =
                typeof downloaded ===
                    "string"
                    ? {
                        url:
                            downloaded
                    }
                    : downloaded

            const sent =
                await sendDownloadedMedia(
                    conn,
                    target,
                    media,
                    event
                )

            if (sent) {

                return {

                    ok: true,

                    method:
                        "download",

                    sent,

                    error:
                        null

                }

            }

        } catch (e) {

            copyError = e

        }

    }

    /*
    ------------------------------------------------------------
    MÉTODO 3: downloadContentFromMessage
    ------------------------------------------------------------
    */

    try {

        const {
            downloadContentFromMessage
        } =
            await import(
                "@whiskeysockets/baileys"
            )

        const media =
            getMediaNode(
                event?.innerMessage,
                event?.mediaType
            )

        if (!media) {
            throw new Error(
                "No se encontró el nodo multimedia del ViewOnce"
            )
        }

        const stream =
            await downloadContentFromMessage(
                media,
                event.mediaType
            )

        const chunks = []

        for await (
            const chunk of
            stream
        ) {
            chunks.push(chunk)
        }

        const buffer =
            Buffer.concat(
                chunks
            )

        if (!buffer.length) {
            throw new Error(
                "El contenido descargado está vacío"
            )
        }

        let sent

        if (
            event.mediaType ===
            "image"
        ) {

            sent =
                await conn.sendMessage(
                    target,
                    {
                        image:
                            buffer,
                        caption:
                            getCaption(
                                event
                            )
                    }
                )

        } else if (
            event.mediaType ===
            "video"
        ) {

            sent =
                await conn.sendMessage(
                    target,
                    {
                        video:
                            buffer,
                        caption:
                            getCaption(
                                event
                            )
                    }
                )

        } else if (
            event.mediaType ===
            "audio"
        ) {

            const node =
                getMediaNode(
                    event.innerMessage,
                    "audio"
                )

            sent =
                await conn.sendMessage(
                    target,
                    {
                        audio:
                            buffer,
                        mimetype:
                            node?.mimetype ||
                            "audio/mpeg",
                        ptt:
                            Boolean(
                                node?.ptt
                            )
                    }
                )

        } else if (
            event.mediaType ===
            "document"
        ) {

            const node =
                getMediaNode(
                    event.innerMessage,
                    "document"
                )

            sent =
                await conn.sendMessage(
                    target,
                    {
                        document:
                            buffer,
                        mimetype:
                            node?.mimetype ||
                            "application/octet-stream",
                        fileName:
                            node?.fileName ||
                            "archivo"
                    }
                )

        }

        if (sent) {

            return {

                ok: true,

                method:
                    "downloadContentFromMessage",

                sent,

                error:
                    null

            }

        }

    } catch (e) {

        copyError =
            e

    }

    return {

        ok: false,

        sent:
            null,

        error:
            copyError ||
            new Error(
                "No se pudo recuperar el ViewOnce"
            )

    }

}


/*
============================================================
NODO MULTIMEDIA
============================================================
*/

function getMediaNode(
    message,
    type
) {

    if (!message) {
        return null
    }

    const normalized =
        normalizeMessage(
            message
        )

    if (!normalized) {
        return null
    }

    const key =
        `${type}Message`

    if (
        normalized?.[key]
    ) {
        return normalized[key]
    }

    if (
        normalized?.[
            type
        ]
    ) {
        return normalized[
            type
        ]
    }

    return null
}


/*
============================================================
ENVIAR MEDIA DESCARGADA
============================================================
*/

async function sendDownloadedMedia(
    conn,
    target,
    media,
    event
) {

    const caption =
        getCaption(
            event
        )

    if (
        event.mediaType ===
        "image"
    ) {

        return conn.sendMessage(
            target,
            {
                image:
                    media,
                caption
            }
        )

    }

    if (
        event.mediaType ===
        "video"
    ) {

        return conn.sendMessage(
            target,
            {
                video:
                    media,
                caption
            }
        )

    }

    if (
        event.mediaType ===
        "audio"
    ) {

        return conn.sendMessage(
            target,
            {
                audio:
                    media,
                mimetype:
                    "audio/mpeg"
            }
        )

    }

    if (
        event.mediaType ===
        "document"
    ) {

        return conn.sendMessage(
            target,
            {
                document:
                    media,
                mimetype:
                    "application/octet-stream",
                fileName:
                    "archivo"
            }
        )

    }

    return null
}


/*
============================================================
FORWARD RECONSTRUIDO
============================================================
*/

function buildForwardableMessage(
    event,
    m
) {

    const inner =
        event?.innerMessage

    if (!inner) {
        return null
    }

    const original =
        event?.webMessage ||
        event?.serialized ||
        {}

    const originalKey =
        original?.key ||
        {}

    const id =
        originalKey?.id ||
        event?.quotedId ||
        m?.quoted?.id ||
        m?.key?.id ||
        `VIEWONCE-${Date.now()}`

    const participant =
        originalKey?.participant ||
        original?.participant ||
        m?.quoted?.sender ||
        m?.sender

    const key = {

        remoteJid:
            originalKey?.remoteJid ||
            m?.chat,

        fromMe:
            Boolean(
                originalKey?.fromMe
            ),

        id

    }

    if (participant) {
        key.participant =
            participant
    }

    return {

        key,

        message: {

            viewOnceMessage: {

                message:
                    inner

            }

        }

    }

}


/*
============================================================
CAPTION
============================================================
*/

function getCaption(
    event
) {

    const message =
        event?.innerMessage

    return (

        message?.imageMessage?.caption ||

        message?.videoMessage?.caption ||

        message?.documentMessage?.caption ||

        ""

    )

}


/*
============================================================
TEXTO DE RESPUESTA
============================================================
*/

function getViewOnceReplyText(
    m
) {

    return (

        m?.text ||

        m?.body ||

        m?.message?.conversation ||

        m?.message?.extendedTextMessage?.text ||

        ""

    )
        .trim()

}


/*
============================================================
DUPLICADOS
============================================================
*/

function alreadySeen(
    conn,
    key
) {

    conn._viewOnceSeen ||=
        new Map()

    const now =
        Date.now()

    /*
    Limpiar expirados
    */

    for (
        const [
            id,
            timestamp
        ]
        of conn._viewOnceSeen
    ) {

        if (
            now -
            timestamp >
            SEEN_TTL
        ) {

            conn._viewOnceSeen.delete(
                id
            )

        }

    }

    if (
        conn._viewOnceSeen.has(
            key
        )
    ) {

        return true

    }

    conn._viewOnceSeen.set(
        key,
        now
    )

    /*
    Limitar tamaño
    */

    while (
        conn._viewOnceSeen.size >
        SEEN_LIMIT
    ) {

        const first =
            conn._viewOnceSeen
                .keys()
                .next()
                .value

        if (!first) {
            break
        }

        conn._viewOnceSeen.delete(
            first
        )

    }

    return false
}


/*
============================================================
DESTINATARIOS
============================================================
*/

function getNotifyTargets() {

    const configured =
        NOTIFY_JIDS
            .map(
                normalizeTargetJid
            )
            .filter(Boolean)

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
                        normalizeTargetJid(
                            Array.isArray(
                                entry
                            )
                                ? entry[0]
                                : entry
                        )
                )
                .filter(Boolean)
        )
    ]

}


function normalizeTargetJid(
    value
) {

    const raw =
        String(
            value || ""
        ).trim()

    if (!raw) {
        return ""
    }

    if (
        raw.includes("@")
    ) {
        return raw
    }

    const number =
        raw.replace(
            /[^0-9]/g,
            ""
        )

    return number
        ? `${number}@s.whatsapp.net`
        : ""

}


/*
============================================================
TRUNCAR
============================================================
*/

function truncate(
    text,
    max
) {

    const value =
        String(
            text || ""
        )

    if (
        value.length <= max
    ) {
        return value
    }

    return (
        value.slice(
            0,
            max - 3
        ) +
        "..."
    )

}
