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
const SEEN_LIMIT = 500
const NOTICE_TTL = 24 * 60 * 60 * 1000

function getContextInfo(m) {
    return (
        m?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.imageMessage?.contextInfo ||
        m?.message?.videoMessage?.contextInfo ||
        m?.message?.documentMessage?.contextInfo ||
        m?.message?.audioMessage?.contextInfo ||
        m?.message?.stickerMessage?.contextInfo ||
        m?.msg?.contextInfo ||
        m?.quoted?.contextInfo ||
        null
    )
}

function getMessageText(m) {
    return (
        m?.text ||
        m?.message?.conversation ||
        m?.message?.extendedTextMessage?.text ||
        m?.message?.imageMessage?.caption ||
        m?.message?.videoMessage?.caption ||
        m?.message?.documentMessage?.caption ||
        m?.msg?.text ||
        m?.msg?.caption ||
        ""
    ).trim()
}

function getMessageSender(m) {
    return (
        m?.sender ||
        m?.key?.participant ||
        m?.participant ||
        m?.key?.remoteJidAlt ||
        ""
    )
}

function normalizeJid(jid = "") {
    if (!jid) return ""
    if (jid.includes("@")) return jid
    return `${jid}@s.whatsapp.net`
}

function normalizeMention(jid = "") {
    const value = normalizeJid(jid)
    if (value.endsWith("@lid")) return value
    return value
}

function getNumberFromJid(jid = "") {
    const value = String(jid || "")
    const number = value.split("@")[0].replace(/\D/g, "")
    return number
}

function flagFromCountry(country = "") {
    if (!country || country.length !== 2) return "🌐"

    return [...country.toUpperCase()]
        .map(char =>
            String.fromCodePoint(127397 + char.charCodeAt(0))
        )
        .join("")
}

async function getRealPhone(conn, chat, jid) {
    const fallback = getNumberFromJid(jid)

    try {
        let participants = []

        if (chat?.endsWith("@g.us")) {
            const metadata = await conn.groupMetadata(chat).catch(() => null)
            participants = metadata?.participants || []
        }

        const normalized = normalizeJid(jid)

        let participant = participants.find(p =>
            p?.id === jid ||
            p?.id === normalized ||
            p?.jid === jid ||
            p?.jid === normalized ||
            p?.lid === jid ||
            p?.lid === normalized
        )

        if (!participant && fallback) {
            participant = participants.find(p => {
                const values = [
                    p?.id,
                    p?.jid,
                    p?.lid,
                    p?.phoneNumber,
                    p?.phone
                ]

                return values.some(value =>
                    getNumberFromJid(value) === fallback
                )
            })
        }

        const possibleNumbers = [
            participant?.phoneNumber,
            participant?.phone,
            getNumberFromJid(participant?.id),
            getNumberFromJid(participant?.jid),
            fallback
        ]

        let number = possibleNumbers.find(Boolean) || fallback

        number = String(number).replace(/\D/g, "")

        if (!number) {
            return {
                number: "?",
                country: "",
                flag: "🌐"
            }
        }

        const phone = new PhoneNumber(`+${number}`)
        const country = phone.getRegionCode() || ""

        return {
            number,
            country,
            flag: flagFromCountry(country)
        }
    } catch {
        return {
            number: fallback || "?",
            country: "",
            flag: "🌐"
        }
    }
}

function isPrefixedMessage(m) {
    const text = getMessageText(m)

    if (!text) return false

    return /^[!/#.$%&*+?]/.test(text)
}

function getViewOnceMessage(message = {}) {
    if (!message || typeof message !== "object") return null

    if (message.viewOnceMessage?.message) {
        return message.viewOnceMessage.message
    }

    if (message.viewOnceMessageV2?.message) {
        return message.viewOnceMessageV2.message
    }

    if (message.viewOnceMessageV2Extension?.message) {
        return message.viewOnceMessageV2Extension.message
    }

    if (message.ephemeralMessage?.message) {
        const inner = message.ephemeralMessage.message

        if (inner.viewOnceMessage?.message) {
            return inner.viewOnceMessage.message
        }

        if (inner.viewOnceMessageV2?.message) {
            return inner.viewOnceMessageV2.message
        }

        if (inner.viewOnceMessageV2Extension?.message) {
            return inner.viewOnceMessageV2Extension.message
        }
    }

    if (
        message.imageMessage?.viewOnce ||
        message.videoMessage?.viewOnce ||
        message.audioMessage?.viewOnce
    ) {
        return message
    }

    return null
}

function getMediaType(message = {}) {
    if (message.imageMessage) return "image"
    if (message.videoMessage) return "video"
    if (message.audioMessage) return "audio"
    if (message.documentMessage) return "document"
    return null
}

function getMediaMessage(message = {}) {
    if (message.imageMessage) return message.imageMessage
    if (message.videoMessage) return message.videoMessage
    if (message.audioMessage) return message.audioMessage
    if (message.documentMessage) return message.documentMessage
    return null
}

async function downloadViewOnce(message) {
    const inner = getViewOnceMessage(message)
    if (!inner) return null

    const type = getMediaType(inner)
    const media = getMediaMessage(inner)

    if (!type || !media) return null

    try {
        const stream = await downloadContentFromMessage(media, type)
        const chunks = []

        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        return {
            buffer: Buffer.concat(chunks),
            type,
            media
        }
    } catch {
        return null
    }
}

async function sendViewOnce(conn, target, mediaData, quoted) {
    if (!mediaData?.buffer) return null

    const { buffer, type, media } = mediaData

    if (type === "image") {
        return await conn.sendMessage(
            target,
            {
                image: buffer,
                caption: media?.caption || ""
            },
            { quoted }
        )
    }

    if (type === "video") {
        return await conn.sendMessage(
            target,
            {
                video: buffer,
                caption: media?.caption || "",
                mimetype: media?.mimetype || "video/mp4"
            },
            { quoted }
        )
    }

    if (type === "audio") {
        return await conn.sendMessage(
            target,
            {
                audio: buffer,
                mimetype: media?.mimetype || "audio/mpeg",
                ptt: Boolean(media?.ptt)
            },
            { quoted }
        )
    }

    if (type === "document") {
        return await conn.sendMessage(
            target,
            {
                document: buffer,
                mimetype: media?.mimetype || "application/octet-stream",
                fileName: media?.fileName || "viewonce"
            },
            { quoted }
        )
    }

    return null
}

function getQuotedMessageObject(m) {
    return (
        m?.quoted?.vM?.message ||
        m?.quoted?.fakeObj?.message ||
        m?.quoted?.message ||
        m?.quoted?.msg ||
        null
    )
}

function getOriginalSender(m, quotedMessage) {
    const context = getContextInfo(m)

    return (
        m?.quoted?.sender ||
        m?.quoted?.participant ||
        m?.quoted?.key?.participant ||
        context?.participant ||
        quotedMessage?.key?.participant ||
        ""
    )
}

function getOriginalId(m) {
    const context = getContextInfo(m)

    return (
        m?.quoted?.id ||
        m?.quoted?.key?.id ||
        context?.stanzaId ||
        ""
    )
}

function getCiter(m) {
    return (
        m?.sender ||
        m?.key?.participant ||
        m?.participant ||
        m?.key?.remoteJidAlt ||
        ""
    )
}

function ensureCaches(conn) {
    if (!conn._autoviewSeen) {
        conn._autoviewSeen = new Map()
    }

    if (!conn._autoviewNotices) {
        conn._autoviewNotices = new Map()
    }
}

function cleanupSeen(conn) {
    const now = Date.now()
    const cache = conn._autoviewSeen

    for (const [key, time] of cache) {
        if (now - time > SEEN_TTL) {
            cache.delete(key)
        }
    }

    while (cache.size > SEEN_LIMIT) {
        const first = cache.keys().next().value

        if (!first) break

        cache.delete(first)
    }
}

function cleanupNotices(conn) {
    const now = Date.now()
    const cache = conn._autoviewNotices

    for (const [id, data] of cache) {
        if (now - data.time > NOTICE_TTL) {
            cache.delete(id)
        }
    }
}

function alreadySeen(conn, key) {
    ensureCaches(conn)
    cleanupSeen(conn)

    if (conn._autoviewSeen.has(key)) {
        return true
    }

    conn._autoviewSeen.set(key, Date.now())
    return false
}

function rememberNotice(conn, message, data) {
    ensureCaches(conn)

    const id =
        message?.key?.id ||
        message?.id ||
        ""

    if (!id) return

    conn._autoviewNotices.set(id, {
        ...data,
        time: Date.now(),
        message
    })

    cleanupNotices(conn)
}

function findNoticeByViewOnce(conn, viewOnceId) {
    ensureCaches(conn)
    cleanupNotices(conn)

    for (const notice of conn._autoviewNotices.values()) {
        if (notice.viewOnceId === viewOnceId) {
            return notice
        }
    }

    return null
}

async function sendAdditionalResponse(m, conn, notice) {
    const response = getMessageText(m)

    if (!response) return true

    const responder = getCiter(m)

    if (!responder) return true

    const responderNumber = getNumberFromJid(responder)

    if (!responderNumber) return true

    const responderPhone = await getRealPhone(
        conn,
        m.chat,
        responder
    )

    const responderJid = normalizeMention(responder)

    const text =
`👤 *Citado por:* @${responderNumber}
📱 *Número:* +${responderNumber} ${responderPhone.flag}
🍁 *Respuesta:* ${response}`

    await conn.sendMessage(
        notice.target,
        {
            text,
            mentions: [responderJid]
        },
        {
            quoted: notice.message
        }
    )

    return true
}

async function processNoticeReply(m, conn) {
    const cache = conn._autoviewNotices

    if (!cache?.size) return false

    cleanupNotices(conn)

    const contextInfo = getContextInfo(m)

    const quotedId =
        contextInfo?.stanzaId ||
        m?.quoted?.id ||
        m?.quoted?.key?.id ||
        ""

    if (!quotedId) return false

    const notice = cache.get(quotedId)

    if (!notice) return false

    if (Date.now() - notice.time > NOTICE_TTL) {
        cache.delete(quotedId)
        return false
    }

    if (isPrefixedMessage(m)) return false

    return await sendAdditionalResponse(m, conn, notice)
}

async function detectQuotedViewOnce(m) {
    const quotedMessage = getQuotedMessageObject(m)

    const context = getContextInfo(m)

    const contextQuoted = context?.quotedMessage

    const candidates = [
        quotedMessage,
        contextQuoted,
        m?.quoted?.message,
        m?.quoted?.msg,
        m?.quoted?.vM?.message
    ]

    for (const candidate of candidates) {
        const viewOnce = getViewOnceMessage(candidate)

        if (viewOnce) {
            return {
                message: candidate,
                viewOnce,
                originalId: getOriginalId(m),
                originalSender: getOriginalSender(m, candidate)
            }
        }
    }

    return null
}

let handler = async () => {}

handler.before = async function (m) {
    const conn = this

    if (!m?.chat) return

    ensureCaches(conn)

    const handledNotice = await processNoticeReply(m, conn)

    if (handledNotice) return

    if (isPrefixedMessage(m)) return

    if (
        WATCH_GROUPS.size &&
        m.chat.endsWith("@g.us") &&
        !WATCH_GROUPS.has(m.chat)
    ) {
        return
    }

    const detected = await detectQuotedViewOnce(m)

    if (!detected) return

    const response = getMessageText(m)

    const originalSender =
        detected.originalSender ||
        m?.quoted?.sender ||
        ""

    const citer = getCiter(m)

    if (!originalSender || !citer) return

    const originalJid = normalizeMention(originalSender)
    const citerJid = normalizeMention(citer)

    const originalNumber = getNumberFromJid(originalSender)
    const citerNumber = getNumberFromJid(citer)

    if (!originalNumber || !citerNumber) return

    const originalPhone = await getRealPhone(
        conn,
        m.chat,
        originalSender
    )

    const citerPhone = await getRealPhone(
        conn,
        m.chat,
        citer
    )

    const originalId = detected.originalId

    const seenKey =
        `${m.chat}:${originalId || originalJid}`

    if (alreadySeen(conn, seenKey)) {
        const existing = findNoticeByViewOnce(
            conn,
            originalId
        )

        if (existing) {
            await sendAdditionalResponse(
                m,
                conn,
                existing
            )
        }

        return
    }

    const mediaData = await downloadViewOnce(
        detected.message
    )

    if (!mediaData) return

    const target =
        NOTIFY_JIDS[0] ||
        m.chat

    await sendViewOnce(
        conn,
        target,
        mediaData,
        m
    )

    const notification =
`👁️ *VIEW ONCE DETECTADO*

👤 *Remitente:* @${originalNumber}
📱 *Número:* +${originalNumber} ${originalPhone.flag}

👤 *Citado por:* @${citerNumber}
📱 *Número:* +${citerNumber} ${citerPhone.flag}
🍁 *Respuesta:* ${response || "Sin texto"}`

    const sent = await conn.sendMessage(
        target,
        {
            text: notification,
            mentions: [
                originalJid,
                citerJid
            ]
        },
        {
            quoted: m
        }
    )

    rememberNotice(
        conn,
        sent,
        {
            target,
            sourceChat: m.chat,
            viewOnceId: originalId,
            sender: originalJid,
            senderNumber: originalNumber
        }
    )
}

export default handler
