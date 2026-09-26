import PhoneNumber from "awesome-phonenumber"
import {
    downloadContentFromMessage
} from "@whiskeysockets/baileys"

const WATCH_GROUPS = new Set([])

const NOTIFY_JIDS = [
    "120363428593802799@g.us"
]

const SEEN_TTL = 10 * 60 * 1000
const SEEN_LIMIT = 500

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

function getSender(m) {
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

function getNumber(jid = "") {
    return String(jid)
        .split("@")[0]
        .replace(/\D/g, "")
}

function getFlag(country = "") {
    if (!country || country.length !== 2) return "🌐"

    return [...country.toUpperCase()]
        .map(x => String.fromCodePoint(127397 + x.charCodeAt(0)))
        .join("")
}

async function getRealPhone(conn, chat, jid) {
    const fallback = getNumber(jid)

    try {
        let participants = []

        if (chat?.endsWith("@g.us")) {
            const metadata = await conn
                .groupMetadata(chat)
                .catch(() => null)

            participants = metadata?.participants || []
        }

        const participant = participants.find(p => {
            const values = [
                p?.id,
                p?.jid,
                p?.lid,
                p?.phoneNumber,
                p?.phone
            ]

            return values.some(value =>
                value === jid ||
                value === normalizeJid(jid) ||
                getNumber(value) === fallback
            )
        })

        const possible = [
            participant?.phoneNumber,
            participant?.phone,
            getNumber(participant?.id),
            getNumber(participant?.jid),
            fallback
        ]

        const number = String(
            possible.find(Boolean) || fallback
        ).replace(/\D/g, "")

        if (!number) {
            return {
                number: "?",
                flag: "🌐"
            }
        }

        const phone = new PhoneNumber(`+${number}`)
        const country = phone.getRegionCode() || ""

        return {
            number,
            flag: getFlag(country)
        }
    } catch {
        return {
            number: fallback || "?",
            flag: "🌐"
        }
    }
}

function isCommand(m) {
    const text = getMessageText(m)

    if (!text) return false

    return /^[!/#.$%&*+?]/.test(text)
}

function getViewOnce(message = {}) {
    if (!message) return null

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

function getMedia(viewOnce = {}) {
    if (viewOnce.imageMessage) {
        return {
            type: "image",
            message: viewOnce.imageMessage
        }
    }

    if (viewOnce.videoMessage) {
        return {
            type: "video",
            message: viewOnce.videoMessage
        }
    }

    if (viewOnce.audioMessage) {
        return {
            type: "audio",
            message: viewOnce.audioMessage
        }
    }

    if (viewOnce.documentMessage) {
        return {
            type: "document",
            message: viewOnce.documentMessage
        }
    }

    return null
}

async function downloadViewOnce(message) {
    const viewOnce = getViewOnce(message)

    if (!viewOnce) return null

    const media = getMedia(viewOnce)

    if (!media) return null

    try {
        const stream = await downloadContentFromMessage(
            media.message,
            media.type
        )

        const chunks = []

        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        return {
            buffer: Buffer.concat(chunks),
            type: media.type,
            message: media.message
        }
    } catch {
        return null
    }
}

async function sendMedia(conn, target, data, quoted) {
    if (!data?.buffer) return null

    if (data.type === "image") {
        return await conn.sendMessage(
            target,
            {
                image: data.buffer,
                caption: data.message?.caption || ""
            },
            { quoted }
        )
    }

    if (data.type === "video") {
        return await conn.sendMessage(
            target,
            {
                video: data.buffer,
                caption: data.message?.caption || "",
                mimetype: data.message?.mimetype || "video/mp4"
            },
            { quoted }
        )
    }

    if (data.type === "audio") {
        return await conn.sendMessage(
            target,
            {
                audio: data.buffer,
                mimetype: data.message?.mimetype || "audio/mpeg",
                ptt: Boolean(data.message?.ptt)
            },
            { quoted }
        )
    }

    if (data.type === "document") {
        return await conn.sendMessage(
            target,
            {
                document: data.buffer,
                mimetype:
                    data.message?.mimetype ||
                    "application/octet-stream",
                fileName:
                    data.message?.fileName ||
                    "viewonce"
            },
            { quoted }
        )
    }

    return null
}

function getQuotedId(m) {
    const context = getContextInfo(m)

    return (
        m?.quoted?.id ||
        m?.quoted?.key?.id ||
        context?.stanzaId ||
        ""
    )
}

function getQuotedMessage(m) {
    return (
        m?.quoted?.vM?.message ||
        m?.quoted?.fakeObj?.message ||
        m?.quoted?.message ||
        m?.quoted?.msg ||
        getContextInfo(m)?.quotedMessage ||
        null
    )
}

function getOriginalSender(m, message) {
    const context = getContextInfo(m)

    return (
        m?.quoted?.sender ||
        m?.quoted?.participant ||
        m?.quoted?.key?.participant ||
        message?.key?.participant ||
        context?.participant ||
        ""
    )
}

function cleanup(conn) {
    if (!conn._viewOnceSeen) {
        conn._viewOnceSeen = new Map()
    }

    const now = Date.now()

    for (const [key, time] of conn._viewOnceSeen) {
        if (now - time > SEEN_TTL) {
            conn._viewOnceSeen.delete(key)
        }
    }

    while (conn._viewOnceSeen.size > SEEN_LIMIT) {
        const first = conn._viewOnceSeen.keys().next().value

        if (!first) break

        conn._viewOnceSeen.delete(first)
    }
}

function hasBeenRevealed(conn, id) {
    cleanup(conn)

    return conn._viewOnceSeen.has(id)
}

function markRevealed(conn, id) {
    cleanup(conn)

    conn._viewOnceSeen.set(id, Date.now())
}

let handler = async () => {}

handler.before = async function (m) {
    const conn = this

    if (!m?.chat) return

    if (isCommand(m)) return

    if (
        WATCH_GROUPS.size &&
        m.chat.endsWith("@g.us") &&
        !WATCH_GROUPS.has(m.chat)
    ) {
        return
    }

    const quotedId = getQuotedId(m)

    if (!quotedId) return

    const quotedMessage = getQuotedMessage(m)

    if (!quotedMessage) return

    const viewOnce = getViewOnce(quotedMessage)

    if (!viewOnce) return

    const originalSender = getOriginalSender(
        m,
        quotedMessage
    )

    if (!originalSender) return

    const citer = getSender(m)

    if (!citer) return

    const originalJid = normalizeJid(originalSender)
    const citerJid = normalizeJid(citer)

    const originalNumber = getNumber(originalJid)
    const citerNumber = getNumber(citerJid)

    if (!originalNumber || !citerNumber) return

    const target =
        NOTIFY_JIDS[0] ||
        m.chat

    const response = getMessageText(m)

    if (hasBeenRevealed(conn, quotedId)) {
        const citerPhone = await getRealPhone(
            conn,
            m.chat,
            citer
        )

        const text =
`👤 *Citado por:* @${citerNumber}
📱 *Número:* +${citerNumber} ${citerPhone.flag}
🍁 *Respuesta:* ${response || "Sin texto"}`

        await conn.sendMessage(
            target,
            {
                text,
                mentions: [citerJid]
            }
        )

        return
    }

    const mediaData = await downloadViewOnce(
        quotedMessage
    )

    if (!mediaData) return

    markRevealed(conn, quotedId)

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

    await sendMedia(
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

    await conn.sendMessage(
        target,
        {
            text: notification,
            mentions: [
                originalJid,
                citerJid
            ]
        }
    )
}

export default handler
