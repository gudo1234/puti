import PhoneNumber from "awesome-phonenumber"

const WATCH_GROUPS = new Set([])

const NOTIFY_JIDS = [
    "120363407073055516@g.us"
]

const SEEN_TTL_MS = 10 * 60 * 1000
const SEEN_LIMIT = 250

let handler = async () => {}

handler.help = ["viewoncewatch"]
handler.tags = ["owner"]
handler.group = true
handler.owner = true

handler.before = async (m, { conn }) => {
    try {
        if (!m?.isGroup) return false
        if (m?.fromMe) return false

        if (
            WATCH_GROUPS.size &&
            !WATCH_GROUPS.has(m.chat)
        ) {
            return false
        }

        const targets = getNotifyTargets()

        if (!targets.length) {
            return false
        }

        if (
            await processNoticeReply(
                m,
                conn,
                targets
            )
        ) {
            return false
        }

        const event = getViewOnceEvent(m)

        if (!event) {
            return false
        }

        const originalId =
            getOriginalViewOnceId(
                event,
                m
            )

        if (!originalId) {
            return false
        }

        const seenKey =
            `${m.chat}:${originalId}:${event.place}`

        if (
            wasSeen(
                conn,
                seenKey
            )
        ) {
            return false
        }

        const originalSender =
            await getOriginalSender(
                conn,
                m,
                event
            )

        if (!originalSender) {
            return false
        }

        const phone =
            await getRealPhoneNumber(
                conn,
                m.chat,
                originalSender
            )

        const name =
            await safeName(
                conn,
                originalSender
            )

        const mention =
            cleanMentionJid(
                originalSender
            )

        const displayNumber =
            phone.number ||
            mention.split("@")[0] ||
            "No disponible"

        const country =
            phone.country ||
            "Desconocido"

        const flag =
            phone.flag ||
            "🌐"

        const type =
            event.place === "cita"
                ? "citado"
                : "automático"

        const text =
            `👁️ *VIEW ONCE DETECTADO*\n\n` +
            `👤 *Remitente:* @${mention.split("@")[0]}\n` +
            `📱 *Número:* ${displayNumber}\n` +
            `🌎 *País:* ${country} ${flag}\n\n` +
            `📦 *Tipo:* ${type}\n` +
            `Lo cito: @${mention.split("@")[0]}`

        for (const target of targets) {
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
                    target,
                    sent,
                    {
                        sourceChat:
                            m.chat,
                        viewOnceId:
                            originalId,
                        sender:
                            mention,
                        name
                    }
                )
            } catch (error) {
                console.error(
                    "[viewonce-monitor:send]",
                    target,
                    error?.message ||
                    error
                )
            }
        }
    } catch (error) {
        console.error(
            "[viewonce-monitor]",
            error?.message ||
            error
        )
    }

    return false
}

export default handler

function getNotifyTargets() {
    const configured =
        NOTIFY_JIDS
            .map(
                normalizeTargetJid
            )
            .filter(Boolean)

    if (configured.length) {
        return unique(
            configured
        )
    }

    const owners =
        Array.isArray(
            global.owner
        )
            ? global.owner
            : []

    return unique(
        owners
            .map(entry =>
                normalizeTargetJid(
                    Array.isArray(entry)
                        ? entry[0]
                        : entry
                )
            )
            .filter(Boolean)
    )
}

function normalizeTargetJid(value) {
    const raw =
        String(
            value || ""
        ).trim()

    if (!raw) return ""

    if (raw.includes("@")) {
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

function cleanMentionJid(value) {
    const raw =
        String(
            value || ""
        ).trim()

    if (!raw) return ""

    if (raw.includes("@")) {
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

function unique(list) {
    return [
        ...new Set(list)
    ]
}

function getViewOnceEvent(m) {
    const direct =
        detectViewOnceMessage(
            m?.message
        )

    if (direct) {
        return {
            ...direct,
            place: "mensaje",
            quotedId: "",
            webMessage:
                getWebMessage(m),
            serialized: m
        }
    }

    if (
        m?.key?.isViewOnce
    ) {
        return {
            wrapper:
                "key.isViewOnce",
            mediaType:
                getMediaType(
                    normalizeInnerMessage(
                        m?.message
                    )
                ),
            innerMessage:
                normalizeInnerMessage(
                    m?.message
                ),
            place: "mensaje",
            quotedId: "",
            webMessage:
                getWebMessage(m),
            serialized: m
        }
    }

    const contextInfo =
        getContextInfo(m)

    const q =
        m?.quoted

    const quotedWebMessage =
        q?.vM ||
        q?.fakeObj ||
        null

    const quotedMessage =
        contextInfo?.quotedMessage ||
        quotedWebMessage?.message ||
        q?.message ||
        makeMessageFromSerialized(q)

    const quotedInfo =
        detectViewOnceMessage(
            quotedMessage
        )

    if (!quotedInfo) {
        return null
    }

    return {
        ...quotedInfo,
        place: "cita",
        quotedId:
            contextInfo?.stanzaId ||
            q?.id ||
            q?.key?.id ||
            "",
        webMessage:
            quotedWebMessage ||
            buildQuotedWebMessage(
                m,
                contextInfo,
                quotedMessage,
                q
            ),
        serialized:
            q || null
    }
}

function getOriginalViewOnceId(
    event,
    m
) {
    const webKey =
        event?.webMessage?.key ||
        {}

    const serializedKey =
        event?.serialized?.key ||
        {}

    if (
        event?.place === "cita"
    ) {
        return (
            event?.quotedId ||
            webKey.id ||
            serializedKey.id ||
            ""
        )
    }

    return (
        webKey.id ||
        serializedKey.id ||
        m?.key?.id ||
        m?.id ||
        ""
    )
}

function detectViewOnceMessage(
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
        const wrapper of [
            "viewOnceMessage",
            "viewOnceMessageV2",
            "viewOnceMessageV2Extension"
        ]
    ) {
        const inner =
            message?.[wrapper]?.message

        if (
            inner &&
            typeof inner === "object"
        ) {
            return {
                wrapper,
                mediaType:
                    getMediaType(
                        inner
                    ),
                innerMessage:
                    inner
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
            message?.[wrapper]?.message

        const found =
            detectViewOnceMessage(
                inner,
                depth + 1
            )

        if (found) {
            return found
        }
    }

    return null
}

function getMediaType(message) {
    if (
        !message ||
        typeof message !== "object"
    ) {
        return ""
    }

    if (message.imageMessage) {
        return "image"
    }

    if (message.videoMessage) {
        return "video"
    }

    if (message.audioMessage) {
        return "audio"
    }

    if (message.documentMessage) {
        return "document"
    }

    return ""
}

function normalizeInnerMessage(
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
            "futureproofMessage",
            "associatedChildMessage"
        ]
    ) {
        if (
            message?.[wrapper]?.message
        ) {
            return normalizeInnerMessage(
                message[wrapper].message
            )
        }
    }

    return message
}

function getContextInfo(m) {
    if (
        m?.msg?.contextInfo
    ) {
        return m.msg.contextInfo
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

    const participant =
        contextInfo?.participant ||
        q?.sender ||
        ""

    const key = {
        remoteJid:
            m?.chat,
        fromMe:
            Boolean(
                q?.fromMe
            ),
        id:
            contextInfo?.stanzaId ||
            q?.id ||
            q?.key?.id ||
            `QUOTED-${Date.now()}`
    }

    if (participant) {
        key.participant =
            participant
    }

    return {
        key,
        message:
            quotedMessage,
        ...(participant
            ? {
                participant
            }
            : {})
    }
}

function makeMessageFromSerialized(q) {
    if (
        !q ||
        typeof q !== "object"
    ) {
        return null
    }

    if (
        q.mtype &&
        q.msg
    ) {
        return {
            [q.mtype]:
                q.msg
        }
    }

    if (
        q.mediaType &&
        q.msg
    ) {
        return {
            [q.mediaType]:
                q.msg
        }
    }

    return null
}

async function getOriginalSender(
    conn,
    m,
    event
) {
    const web =
        event?.webMessage

    const key =
        web?.key || {}

    const possible = [
        key.participant,
        web?.participant,
        event?.serialized?.participant,
        event?.serialized?.sender,
        m?.quoted?.sender,
        m?.quoted?.participant,
        m?.sender
    ].filter(Boolean)

    if (!possible.length) {
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
            const candidate of possible
        ) {
            const found =
                participants.find(
                    user =>
                        user?.id === candidate ||
                        user?.jid === candidate ||
                        user?.lid === candidate ||
                        user?.phoneNumber === candidate
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

    return possible[0]
}

async function getRealPhoneNumber(
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
            sender ||
            ""

        const id =
            String(raw)
                .split("@")[0]
                .split(":")[0]
                .replace(
                    /\D/g,
                    ""
                )

        if (!id) {
            return {
                number: "",
                country:
                    "Desconocido",
                flag: "🌐"
            }
        }

        const pn =
            new PhoneNumber(
                "+" + id
            )

        const code =
            pn.getRegionCode() ||
            "??"

        return {
            number:
                "+" + id,
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
            country:
                "Desconocido",
            flag: "🌐"
        }
    }
}

function getCountryName(code) {
    if (
        !code ||
        code === "??"
    ) {
        return "Desconocido"
    }

    try {
        const regionNames =
            new Intl.DisplayNames(
                ["es"],
                {
                    type: "region"
                }
            )

        return (
            regionNames.of(code) ||
            "Desconocido"
        )
    } catch {
        return "Desconocido"
    }
}

function getFlagEmoji(code) {
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

function wasSeen(
    conn,
    key
) {
    const cache =
        getSeenCache(conn)

    const now =
        Date.now()

    for (
        const [
            item,
            time
        ] of cache
    ) {
        if (
            now - time >
            SEEN_TTL_MS
        ) {
            cache.delete(
                item
            )
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

        cache.delete(
            first
        )
    }

    return false
}

function getSeenCache(conn) {
    if (
        !conn._viewOnceSeen
    ) {
        conn._viewOnceSeen =
            new Map()
    }

    return conn._viewOnceSeen
}

function rememberNotice(
    conn,
    target,
    sent,
    meta = {}
) {
    const id =
        sent?.key?.id

    if (!id) {
        return
    }

    if (
        !conn._viewOnceNotices
    ) {
        conn._viewOnceNotices =
            new Map()
    }

    conn._viewOnceNotices.set(
        id,
        {
            id,
            target,
            message: sent,
            at: Date.now(),
            ...meta
        }
    )

    while (
        conn._viewOnceNotices.size >
        SEEN_LIMIT
    ) {
        const first =
            conn._viewOnceNotices
                .keys()
                .next()
                .value

        if (!first) {
            break
        }

        conn._viewOnceNotices.delete(
            first
        )
    }
}

async function processNoticeReply(
    m,
    conn,
    targets
) {
    const cache =
        conn._viewOnceNotices

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
            now - data.at >
            60 * 60 * 1000
        ) {
            cache.delete(id)
        }
    }

    const contextInfo =
        getContextInfo(m)

    const quotedId =
        contextInfo?.stanzaId ||
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

    const responseText =
        getMessageText(m)

    if (!responseText) {
        return true
    }

    const sender =
        cleanMentionJid(
            m?.sender ||
            m?.key?.participant ||
            m?.participant ||
            ""
        )

    const mentions =
        sender
            ? [sender]
            : []

    const response =
        sender
            ? `💬 @${sender.split("@")[0]}: ${responseText}`
            : `💬 ${responseText}`

    for (
        const target of targets
    ) {
        try {
            await conn.sendMessage(
                target,
                {
                    text:
                        response,
                    mentions
                },
                {
                    quoted:
                        notice.message
                }
            )
        } catch (error) {
            console.error(
                "[viewonce-monitor:reply]",
                target,
                error?.message ||
                error
            )
        }
    }

    return true
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

async function safeName(
    conn,
    jid
) {
    try {
        if (
            typeof conn?.getName ===
            "function"
        ) {
            return await conn.getName(
                jid
            )
        }
    } catch {}

    return (
        jid?.split("@")[0] ||
        "Desconocido"
    )
}
