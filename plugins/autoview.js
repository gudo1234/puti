import PhoneNumber from "awesome-phonenumber"

import {
    downloadContentFromMessage,
    downloadMediaMessage
} from "@whiskeysockets/baileys"

const WATCH_GROUPS = new Set([])

const NOTIFY_JIDS = [
    "120363428593802799@g.us"
]

const SEEN_TTL = 10 * 60 * 1000
const SEEN_LIMIT = 250
const NOTICE_TTL = 60 * 60 * 1000

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

        installRawWatcher(conn)

        if (!m?.isGroup) {
            return true
        }

        if (
            WATCH_GROUPS.size &&
            !WATCH_GROUPS.has(m.chat)
        ) {
            return true
        }

        if (
            m?.key?.fromMe ||
            m?.fromMe
        ) {
            return true
        }

        if (
            await processNoticeReply(
                m,
                conn
            )
        ) {
            return true
        }

        if (
            !m?.message &&
            !m?.msg
        ) {
            return true
        }

        const event =
            await detectViewOnce(m)

        if (!event) {
            return true
        }

        const originalId =
            event.id ||
            m?.key?.id ||
            m?.id ||
            ""

        if (!originalId) {
            return true
        }

        const seenKey =
            `${m.chat}:${originalId}`

        if (
            alreadySeen(
                conn,
                seenKey
            )
        ) {
            return true
        }

        await sendViewOnce(
            conn,
            m.chat,
            m,
            event
        )

    } catch (e) {

        console.error(
            "[AUTOVIEW]",
            e?.stack ||
            e?.message ||
            e
        )
    }

    return true
}

export default handler


function installRawWatcher(conn) {

    if (!conn) {
        return
    }

    if (
        conn._autoviewRawWatcherInstalled
    ) {
        return
    }

    if (
        !conn.ev ||
        typeof conn.ev.on !== "function"
    ) {
        return
    }

    conn._autoviewRawWatcherInstalled = true

    conn.ev.on(
        "messages.upsert",
        async update => {

            try {

                const messages =
                    Array.isArray(
                        update?.messages
                    )
                        ? update.messages
                        : []

                for (
                    const message of
                    messages
                ) {

                    await processRawMessage(
                        conn,
                        message
                    )
                }

            } catch (e) {

                console.error(
                    "[AUTOVIEW:RAW]",
                    e?.stack ||
                    e?.message ||
                    e
                )
            }
        }
    )
}


async function processRawMessage(
    conn,
    message
) {

    try {

        if (!message) {
            return
        }

        const key =
            message.key ||
            {}

        if (
            key.fromMe
        ) {
            return
        }

        const chat =
            key.remoteJid ||
            ""

        if (
            !chat.endsWith("@g.us")
        ) {
            return
        }

        if (
            WATCH_GROUPS.size &&
            !WATCH_GROUPS.has(chat)
        ) {
            return
        }

        const event =
            detectRawViewOnce(
                message
            )

        if (!event) {
            return
        }

        const originalId =
            key.id ||
            event.id ||
            ""

        if (!originalId) {
            return
        }

        const seenKey =
            `${chat}:${originalId}`

        if (
            alreadySeen(
                conn,
                seenKey
            )
        ) {
            return
        }

        await sendViewOnce(
            conn,
            chat,
            message,
            event
        )

    } catch (e) {

        console.error(
            "[AUTOVIEW:RAW]",
            e?.stack ||
            e?.message ||
            e
        )
    }
}


function detectRawViewOnce(
    message,
    depth = 0
) {

    if (
        !message ||
        typeof message !== "object" ||
        depth > 25
    ) {
        return null
    }

    const content =
        message.message ||
        message

    if (
        !content ||
        typeof content !== "object"
    ) {
        return null
    }

    for (
        const wrapper of [
            "viewOnceMessage",
            "viewOnceMessageV2",
            "viewOnceMessageV2Extension"
        ]
    ) {

        const inner =
            content?.[wrapper]?.message

        if (
            inner
        ) {

            return {
                place:
                    "automático",
                wrapper,
                raw:
                    inner,
                id:
                    message?.key?.id ||
                    "",
                sender:
                    message?.key?.participant ||
                    message?.participant ||
                    "",
                type:
                    detectMediaType(
                        inner
                    ),
                webMessage:
                    message
            }
        }
    }

    for (
        const type of [
            "imageMessage",
            "videoMessage",
            "audioMessage",
            "documentMessage"
        ]
    ) {

        const node =
            content?.[type]

        if (
            node &&
            (
                node.viewOnce === true ||
                node.isViewOnce === true
            )
        ) {

            return {
                place:
                    "automático",
                wrapper:
                    type,
                raw:
                    content,
                id:
                    message?.key?.id ||
                    "",
                sender:
                    message?.key?.participant ||
                    message?.participant ||
                    "",
                type,
                webMessage:
                    message
            }
        }
    }

    for (
        const wrapper of [
            "ephemeralMessage",
            "documentWithCaptionMessage",
            "editedMessage",
            "deviceSentMessage",
            "futureproofMessage",
            "associatedChildMessage"
        ]
    ) {

        const inner =
            content?.[wrapper]?.message

        if (
            inner
        ) {

            const nested = {
                ...message,
                message:
                    inner
            }

            const found =
                detectRawViewOnce(
                    nested,
                    depth + 1
                )

            if (found) {
                return found
            }
        }
    }

    return null
}


async function detectViewOnce(m) {

    if (
        m?.quoted
    ) {

        const q =
            m.quoted

        if (
            q?.viewOnce
        ) {

            return {
                place:
                    "citado",
                quoted:
                    q,
                raw:
                    q?.vM?.message ||
                    q?.fakeObj?.message ||
                    q?.message ||
                    null,
                id:
                    q?.id ||
                    q?.key?.id ||
                    "",
                sender:
                    q?.sender ||
                    q?.participant ||
                    "",
                type:
                    getQuotedType(q),
                webMessage:
                    q?.vM ||
                    q?.fakeObj ||
                    null
            }
        }

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
                place:
                    "citado",
                quoted:
                    q,
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
                    ),
                webMessage:
                    q?.vM ||
                    q?.fakeObj ||
                    null
            }
        }

        if (
            q?.mtype &&
            isViewOnceNode(
                q?.msg
            )
        ) {

            return {
                place:
                    "citado",
                quoted:
                    q,
                raw: {
                    [q.mtype]:
                        q.msg
                },
                id:
                    q?.id ||
                    "",
                sender:
                    q?.sender ||
                    "",
                type:
                    normalizeType(
                        q.mtype
                    ),
                webMessage:
                    q?.vM ||
                    q?.fakeObj ||
                    null
            }
        }

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
                place:
                    "citado",
                quoted:
                    q,
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
                    ),
                webMessage:
                    q?.vM ||
                    q?.fakeObj ||
                    null
            }
        }
    }

    if (
        m?.key?.isViewOnce
    ) {

        return {
            place:
                "automático",
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
                ),
            webMessage:
                m?.vM ||
                m?.fakeObj ||
                m
        }
    }

    if (
        isViewOnceMessage(
            m?.message
        )
    ) {

        return {
            place:
                "automático",
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
                ),
            webMessage:
                m?.vM ||
                m?.fakeObj ||
                m
        }
    }

    if (
        isViewOnceMessage(
            m?.msg
        )
    ) {

        return {
            place:
                "automático",
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
                ),
            webMessage:
                m?.vM ||
                m?.fakeObj ||
                m
        }
    }

    if (
        isViewOnceNode(
            m?.msg
        )
    ) {

        return {
            place:
                "automático",
            raw: {
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
                ),
            webMessage:
                m?.vM ||
                m?.fakeObj ||
                m
        }
    }

    return null
}


function isViewOnceMessage(
    message,
    depth = 0
) {

    if (
        !message ||
        typeof message !== "object" ||
        depth > 25
    ) {
        return false
    }

    for (
        const wrapper of [
            "viewOnceMessage",
            "viewOnceMessageV2",
            "viewOnceMessageV2Extension"
        ]
    ) {

        if (
            message?.[wrapper]?.message
        ) {
            return true
        }
    }

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
                node.viewOnce === true ||
                node.isViewOnce === true
            )
        ) {
            return true
        }
    }

    for (
        const wrapper of [
            "ephemeralMessage",
            "documentWithCaptionMessage",
            "editedMessage",
            "deviceSentMessage",
            "futureproofMessage",
            "associatedChildMessage"
        ]
    ) {

        const inner =
            message?.[wrapper]?.message

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


function isViewOnceNode(node) {

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


async function sendViewOnce(
    conn,
    chat,
    message,
    event
) {

    const targets =
        getNotifyTargets()

    if (!targets.length) {
        return
    }

    const originalSender =
        event?.sender ||
        message?.sender ||
        message?.key?.participant ||
        ""

    if (!originalSender) {
        return
    }

    const phone =
        await getRealPhone(
            conn,
            chat,
            originalSender
        )

    const mention =
        normalizeMention(
            originalSender
        )

    const number =
        phone.number ||
        mention.split("@")[0] ||
        "No disponible"

    const type =
        event?.place === "citado"
            ? "citado"
            : "automático"

    const text =
        `👁️ *VIEW ONCE DETECTADO*\n\n` +
        `👤 *Remitente:* @${mention.split("@")[0]}\n` +
        `📱 *Número:* ${number}\n` +
        `🌎 *País:* ${phone.country || "Desconocido"} ${phone.flag || "🌐"}\n\n` +
        `📦 *Tipo:* ${type}\n` +
        `Lo cito: @${mention.split("@")[0]}`

    for (
        const target of targets
    ) {

        try {

            const media =
                await recoverViewOnce(
                    conn,
                    event,
                    message
                )

            let mediaMessage =
                null

            if (
                media?.ok
            ) {

                mediaMessage =
                    await sendRecovered(
                        conn,
                        target,
                        media.buffer,
                        event.type,
                        media.source
                    )
            }

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        text,
                        mentions: [
                            mention
                        ]
                    },
                    mediaMessage?.key
                        ? {
                            quoted:
                                mediaMessage
                        }
                        : {}
                )

            rememberNotice(
                conn,
                sent,
                {
                    target,
                    sourceChat:
                        chat,
                    viewOnceId:
                        event.id ||
                        message?.key?.id ||
                        "",
                    sender:
                        mention
                }
            )

        } catch (e) {

            console.error(
                "[AUTOVIEW:SEND]",
                target,
                e?.stack ||
                e?.message ||
                e
            )

            try {

                const sent =
                    await conn.sendMessage(
                        target,
                        {
                            text,
                            mentions: [
                                mention
                            ]
                        }
                    )

                rememberNotice(
                    conn,
                    sent,
                    {
                        target,
                        sourceChat:
                            chat,
                        viewOnceId:
                            event.id ||
                            message?.key?.id ||
                            "",
                        sender:
                            mention
                    }
                )

            } catch {}
        }
    }
}


async function recoverViewOnce(
    conn,
    event,
    message
) {

    let lastError =
        null

    if (
        event?.place === "citado" &&
        event?.quoted &&
        typeof event.quoted.download ===
            "function"
    ) {

        try {

            const buffer =
                await event.quoted.download(
                    false
                )

            if (
                buffer &&
                buffer.length
            ) {

                return {
                    ok: true,
                    buffer,
                    source:
                        event.quoted,
                    method:
                        "quoted.download"
                }
            }

        } catch (e) {
            lastError = e
        }
    }

    if (
        event?.place === "automático" &&
        typeof message?.download ===
            "function"
    ) {

        try {

            const buffer =
                await message.download(
                    false
                )

            if (
                buffer &&
                buffer.length
            ) {

                return {
                    ok: true,
                    buffer,
                    source:
                        message,
                    method:
                        "m.download"
                }
            }

        } catch (e) {
            lastError = e
        }
    }

    const sources = []

    if (
        event?.webMessage
    ) {
        sources.push(
            event.webMessage
        )
    }

    if (
        event?.quoted?.vM
    ) {
        sources.push(
            event.quoted.vM
        )
    }

    if (
        event?.quoted?.fakeObj
    ) {
        sources.push(
            event.quoted.fakeObj
        )
    }

    if (
        message
    ) {
        sources.push(
            message
        )
    }

    for (
        const source of
        uniqueObjects(sources)
    ) {

        if (
            typeof conn?.copyNForward !==
                "function"
        ) {
            break
        }

        try {

            const forwarded =
                await conn.copyNForward(
                    conn.user?.id ||
                    "",
                    source,
                    true,
                    {
                        readViewOnce:
                            true
                    }
                )

            if (
                forwarded
            ) {

                try {

                    const downloaded =
                        await downloadForwarded(
                            conn,
                            forwarded
                        )

                    if (
                        downloaded?.length
                    ) {

                        return {
                            ok: true,
                            buffer:
                                downloaded,
                            source:
                                forwarded,
                            method:
                                "copyNForward + download"
                        }
                    }

                } catch (e) {
                    lastError = e
                }
            }

        } catch (e) {
            lastError = e
        }
    }

    const raw =
        unwrapMessage(
            event?.raw
        )

    const media =
        getMediaNode(
            raw,
            event?.type
        )

    if (
        media
    ) {

        try {

            const type =
                normalizeDownloadType(
                    event?.type
                )

            const stream =
                await downloadContentFromMessage(
                    media,
                    type
                )

            const chunks = []

            for await (
                const chunk of stream
            ) {
                chunks.push(
                    Buffer.from(chunk)
                )
            }

            const buffer =
                Buffer.concat(
                    chunks
                )

            if (
                buffer.length
            ) {

                return {
                    ok: true,
                    buffer,
                    source:
                        media,
                    method:
                        "downloadContentFromMessage"
                }
            }

        } catch (e) {
            lastError = e
        }
    }

    try {

        if (
            typeof downloadMediaMessage ===
                "function"
        ) {

            const source =
                event?.webMessage ||
                message

            if (
                source
            ) {

                const buffer =
                    await downloadMediaMessage(
                        source,
                        "buffer",
                        {},
                        {
                            logger:
                                console
                        }
                    )

                if (
                    buffer &&
                    buffer.length
                ) {

                    return {
                        ok: true,
                        buffer,
                        source:
                            media ||
                            source,
                        method:
                            "downloadMediaMessage"
                    }
                }
            }
        }

    } catch (e) {
        lastError = e
    }

    if (
        lastError
    ) {

        console.error(
            "[AUTOVIEW:DOWNLOAD]",
            lastError?.message ||
            lastError
        )
    }

    return {
        ok: false,
        buffer:
            null,
        source:
            media ||
            event?.raw ||
            message,
        method:
            ""
    }
}


async function downloadForwarded(
    conn,
    message
) {

    if (
        !message
    ) {
        return null
    }

    if (
        typeof message.download ===
            "function"
    ) {

        try {

            return await message.download(
                false
            )

        } catch {}
    }

    const raw =
        unwrapMessage(
            message?.message ||
            message
        )

    const type =
        detectMediaType(
            raw
        )

    const media =
        getMediaNode(
            raw,
            type
        )

    if (
        !media
    ) {
        return null
    }

    const stream =
        await downloadContentFromMessage(
            media,
            normalizeDownloadType(
                type
            )
        )

    const chunks = []

    for await (
        const chunk of stream
    ) {
        chunks.push(
            Buffer.from(chunk)
        )
    }

    return Buffer.concat(
        chunks
    )
}


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
        return null
    }

    const mediaType =
        normalizeType(
            type ||
            source?.mtype ||
            source?.mediaType
        )

    try {

        if (
            mediaType ===
                "imageMessage" ||
            mediaType ===
                "image"
        ) {

            return await conn.sendMessage(
                target,
                {
                    image:
                        buffer,
                    caption:
                        getCaption(
                            source
                        )
                }
            )
        }

        if (
            mediaType ===
                "videoMessage" ||
            mediaType ===
                "video"
        ) {

            return await conn.sendMessage(
                target,
                {
                    video:
                        buffer,
                    caption:
                        getCaption(
                            source
                        )
                }
            )
        }

        if (
            mediaType ===
                "audioMessage" ||
            mediaType ===
                "audio"
        ) {

            const node =
                source?.audioMessage ||
                source

            return await conn.sendMessage(
                target,
                {
                    audio:
                        buffer,
                    mimetype:
                        node?.mimetype ||
                        "audio/mp4",
                    ptt:
                        Boolean(
                            node?.ptt
                        )
                }
            )
        }

        if (
            mediaType ===
                "documentMessage" ||
            mediaType ===
                "document"
        ) {

            return await conn.sendMessage(
                target,
                {
                    document:
                        buffer,
                    fileName:
                        source?.fileName ||
                        "viewonce",
                    mimetype:
                        source?.mimetype ||
                        "application/octet-stream",
                    caption:
                        getCaption(
                            source
                        )
                }
            )
        }

    } catch (e) {

        console.error(
            "[AUTOVIEW:MEDIA:SEND]",
            e?.message ||
            e
        )
    }

    return null
}


async function processNoticeReply(
    m,
    conn
) {

    const cache =
        conn._autoviewNotices

    if (
        !cache?.size
    ) {
        return false
    }

    const now =
        Date.now()

    for (
        const [
            id,
            data
        ] of cache
    ) {

        if (
            now - data.time >
            NOTICE_TTL
        ) {

            cache.delete(id)
        }
    }

    const context =
        getContextInfo(m)

    const quotedId =
        context?.stanzaId ||
        m?.quoted?.id ||
        m?.quoted?.key?.id ||
        ""

    if (!quotedId) {
        return false
    }

    const notice =
        cache.get(
            quotedId
        )

    if (!notice) {
        return false
    }

    const response =
        getMessageText(m)

    if (!response) {
        return true
    }

    const sender =
        normalizeMention(
            m?.sender ||
            m?.key?.participant ||
            ""
        )

    const text =
        sender
            ? `💬 @${sender.split("@")[0]}: ${response}`
            : `💬 ${response}`

    try {

        await conn.sendMessage(
            notice.target,
            {
                text,
                mentions:
                    sender
                        ? [sender]
                        : []
            },
            {
                quoted:
                    notice.message
            }
        )

    } catch (e) {

        console.error(
            "[AUTOVIEW:REPLY]",
            e?.message ||
            e
        )
    }

    return true
}


function rememberNotice(
    conn,
    sent,
    data
) {

    const id =
        sent?.key?.id

    if (!id) {
        return
    }

    if (
        !conn._autoviewNotices
    ) {
        conn._autoviewNotices =
            new Map()
    }

    conn._autoviewNotices.set(
        id,
        {
            id,
            message:
                sent,
            time:
                Date.now(),
            ...data
        }
    )

    while (
        conn._autoviewNotices.size >
        SEEN_LIMIT
    ) {

        const first =
            conn._autoviewNotices
                .keys()
                .next()
                .value

        if (!first) {
            break
        }

        conn._autoviewNotices.delete(
            first
        )
    }
}


function unwrapMessage(
    message
) {

    if (
        !message ||
        typeof message !== "object"
    ) {
        return null
    }

    let current =
        message

    for (
        let i = 0;
        i < 25;
        i++
    ) {

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
                "futureproofMessage",
                "associatedChildMessage"
            ]
        ) {

            const inner =
                current?.[wrapper]?.message

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


function getMediaNode(
    message,
    type
) {

    if (
        !message ||
        typeof message !== "object"
    ) {
        return null
    }

    const normalized =
        normalizeType(
            type
        )

    if (
        normalized &&
        message?.[normalized]
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
            message?.[name]
        ) {
            return message[name]
        }
    }

    return null
}


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
            unwrapped?.[type]
        ) {
            return type
        }
    }

    return ""
}


function normalizeDownloadType(
    type
) {

    const value =
        normalizeType(
            type
        )

    if (
        value ===
            "imageMessage"
    ) {
        return "image"
    }

    if (
        value ===
            "videoMessage"
    ) {
        return "video"
    }

    if (
        value ===
            "audioMessage"
    ) {
        return "audio"
    }

    if (
        value ===
            "documentMessage"
    ) {
        return "document"
    }

    return value
}


function normalizeType(type) {

    const value =
        String(
            type ||
            ""
        )

    if (
        value === "image" ||
        value === "imageMessage"
    ) {
        return "imageMessage"
    }

    if (
        value === "video" ||
        value === "videoMessage"
    ) {
        return "videoMessage"
    }

    if (
        value === "audio" ||
        value === "audioMessage"
    ) {
        return "audioMessage"
    }

    if (
        value === "document" ||
        value === "documentMessage"
    ) {
        return "documentMessage"
    }

    return value
}


function getQuotedType(q) {

    return normalizeType(
        q?.mediaType ||
        q?.mtype ||
        detectMediaType(
            q?.message
        ) ||
        ""
    )
}


function getContextInfo(m) {

    return (
        m?.msg?.contextInfo ||
        m?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.imageMessage?.contextInfo ||
        m?.message?.videoMessage?.contextInfo ||
        m?.message?.audioMessage?.contextInfo ||
        m?.message?.documentMessage?.contextInfo ||
        findContextInfo(
            m?.message
        )
    )
}


function findContextInfo(
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

    for (
        const type of [
            "imageMessage",
            "videoMessage",
            "audioMessage",
            "documentMessage",
            "extendedTextMessage"
        ]
    ) {

        if (
            message?.[type]?.contextInfo
        ) {
            return message[
                type
            ].contextInfo
        }
    }

    for (
        const wrapper of [
            "ephemeralMessage",
            "documentWithCaptionMessage",
            "editedMessage",
            "deviceSentMessage",
            "futureproofMessage",
            "associatedChildMessage"
        ]
    ) {

        const found =
            findContextInfo(
                message?.[wrapper]?.message,
                depth + 1
            )

        if (found) {
            return found
        }
    }

    return null
}


function getCaption(source) {

    if (
        !source
    ) {
        return ""
    }

    return (
        source?.caption ||
        source?.imageMessage?.caption ||
        source?.videoMessage?.caption ||
        source?.documentMessage?.caption ||
        ""
    )
}


function getMessageText(m) {

    return (
        m?.text ||
        m?.body ||
        m?.message?.conversation ||
        m?.message?.extendedTextMessage?.text ||
        m?.message?.imageMessage?.caption ||
        m?.message?.videoMessage?.caption ||
        m?.message?.documentMessage?.caption ||
        ""
    ).trim()
}


async function getRealPhone(
    conn,
    chat,
    sender
) {

    try {

        if (!sender) {

            return {
                number: "",
                country:
                    "Desconocido",
                flag:
                    "🌐"
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
                p =>
                    p?.id === sender ||
                    p?.jid === sender ||
                    p?.lid === sender ||
                    p?.phoneNumber === sender
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
                country:
                    "Desconocido",
                flag:
                    "🌐"
            }
        }

        const parsed =
            new PhoneNumber(
                "+" + number
            )

        const region =
            parsed.getRegionCode() ||
            ""

        return {
            number:
                "+" + number,
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


function getCountry(code) {

    if (!code) {
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


function getFlag(code) {

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


function normalizeMention(value) {

    const raw =
        String(
            value ||
            ""
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
            /\D/g,
            ""
        )

    return number
        ? `${number}@s.whatsapp.net`
        : ""
}


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

            cache.delete(id)
        }
    }

    if (
        cache.has(key)
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

        if (!first) {
            break
        }

        cache.delete(first)
    }

    return false
}


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
                            Array.isArray(entry)
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


function normalizeJid(value) {

    const raw =
        String(
            value ||
            ""
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
            /\D/g,
            ""
        )

    return number
        ? `${number}@s.whatsapp.net`
        : ""
}


function uniqueObjects(values) {

    const result = []

    for (
        const value of values
    ) {

        if (
            !value
        ) {
            continue
        }

        if (
            result.includes(value)
        ) {
            continue
        }

        result.push(value)
    }

    return result
}
