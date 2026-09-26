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

const banderaEmoji = c =>
    !c || c.length !== 2
        ? "🌐"
        : [...c.toUpperCase()]
            .map(x =>
                String.fromCodePoint(
                    0x1F1E6 - 65 + x.charCodeAt(0)
                )
            )
            .join("")

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

    if (jid.includes("@")) {
        return jid
    }

    return `${jid}@s.whatsapp.net`
}

function getNumber(jid = "") {
    return String(jid)
        .split("@")[0]
        .replace(/\D/g, "")
}

async function getRealParticipant(conn, chat, jid) {
    const input = String(jid || "")
    const inputNumber = getNumber(input)

    try {
        const metadata = await conn
            .groupMetadata(chat)
            .catch(() => null)

        const participants = metadata?.participants || []

        const participant = participants.find(v => {
            const values = [
                v?.phoneNumber,
                v?.jid,
                v?.id,
                v?.lid
            ].filter(Boolean)

            return values.some(value => {
                const valueString = String(value)

                return (
                    valueString === input ||
                    valueString === normalizeJid(input) ||
                    getNumber(valueString) === inputNumber
                )
            })
        })

        if (!participant) {
            let code = "??"

            try {
                if (inputNumber) {
                    const pn = new PhoneNumber(
                        "+" + inputNumber
                    )

                    code =
                        pn.getRegionCode() ||
                        "??"
                }
            } catch {
                code = "??"
            }

            return {
                jid: normalizeJid(jid),
                number: inputNumber || "?",
                country: code,
                flag: banderaEmoji(code),
                name: "",
                lid: input.includes("@lid")
                    ? input
                    : ""
            }
        }

        const phoneNumber =
            participant.phoneNumber ||
            ""

        const realJid =
            phoneNumber ||
            participant.jid ||
            participant.id ||
            input

        const realLid =
            participant.lid ||
            (
                String(participant.id || "")
                    .includes("@lid")
                    ? participant.id
                    : ""
            )

        const number =
            getNumber(phoneNumber) ||
            getNumber(participant.jid) ||
            getNumber(participant.id) ||
            getNumber(realJid)

        let code = "??"

        try {
            if (number) {
                const pn = new PhoneNumber(
                    "+" + number
                )

                code =
                    pn.getRegionCode() ||
                    "??"
            }
        } catch {
            code = "??"
        }

        return {
            jid: normalizeJid(realJid),
            number: number || "?",
            country: code,
            flag: banderaEmoji(code),
            name:
                participant.notify ||
                participant.name ||
                participant.pushName ||
                "",
            lid: realLid
        }
    } catch {
        let code = "??"

        try {
            if (inputNumber) {
                const pn = new PhoneNumber(
                    "+" + inputNumber
                )

                code =
                    pn.getRegionCode() ||
                    "??"
            }
        } catch {
            code = "??"
        }

        return {
            jid: normalizeJid(jid),
            number: inputNumber || "?",
            country: code,
            flag: banderaEmoji(code),
            name: "",
            lid: input.includes("@lid")
                ? input
                : ""
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
        const inner =
            message.ephemeralMessage.message

        if (inner.viewOnceMessage?.message) {
            return inner.viewOnceMessage.message
        }

        if (inner.viewOnceMessageV2?.message) {
            return inner.viewOnceMessageV2.message
        }

        if (
            inner.viewOnceMessageV2Extension
                ?.message
        ) {
            return inner
                .viewOnceMessageV2Extension
                .message
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
        const stream =
            await downloadContentFromMessage(
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

function getOriginalQuoted(m) {
    return (
        m?.quoted?.fakeObj ||
        m?.quoted?.vM ||
        null
    )
}

function createViewOnceQuote(
    m,
    originalInfo,
    quotedMessage
) {
    const originalQuote =
        getOriginalQuoted(m)

    const originalKey =
        originalQuote?.key ||
        m?.quoted?.key ||
        {}

    const sourceChat =
        originalKey.remoteJid ||
        m?.chat ||
        ""

    const messageId =
        originalKey.id ||
        m?.quoted?.id ||
        ""

    const originalLid =
        originalInfo?.lid ||
        originalKey.participantAlt ||
        m?.quoted?.participant ||
        ""

    const originalJid =
        originalInfo?.jid ||
        ""

    const quote = {
        key: {
            remoteJid: sourceChat,
            fromMe: false,
            id: messageId,
            participant: originalJid
        },
        message: quotedMessage,
        participant: originalJid
    }

    if (originalLid) {
        quote.key.participantAlt =
            originalLid

        quote.participantAlt =
            originalLid
    }

    if (originalInfo?.number) {
        quote.pushName =
            originalInfo.number
    }

    return quote
}

async function sendMedia(
    conn,
    target,
    data,
    quoted
) {
    if (!data?.buffer) return null

    if (data.type === "image") {
        return await conn.sendMessage(
            target,
            {
                image: data.buffer,
                caption:
                    data.message?.caption || ""
            },
            {
                quoted
            }
        )
    }

    if (data.type === "video") {
        return await conn.sendMessage(
            target,
            {
                video: data.buffer,
                caption:
                    data.message?.caption || "",
                mimetype:
                    data.message?.mimetype ||
                    "video/mp4"
            },
            {
                quoted
            }
        )
    }

    if (data.type === "audio") {
        return await conn.sendMessage(
            target,
            {
                audio: data.buffer,
                mimetype:
                    data.message?.mimetype ||
                    "audio/mpeg",
                ptt: Boolean(
                    data.message?.ptt
                )
            },
            {
                quoted
            }
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
            {
                quoted
            }
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
        m?.quoted?.key?.participantAlt ||
        message?.key?.participant ||
        message?.key?.participantAlt ||
        context?.participant ||
        context?.participantAlt ||
        ""
    )
}

function cleanup(conn) {
    if (!conn._viewOnceSeen) {
        conn._viewOnceSeen = new Map()
    }

    const now = Date.now()

    for (
        const [key, value]
        of conn._viewOnceSeen
    ) {
        if (
            now - value.time >
            SEEN_TTL
        ) {
            conn._viewOnceSeen.delete(key)
        }
    }

    while (
        conn._viewOnceSeen.size >
        SEEN_LIMIT
    ) {
        const first =
            conn._viewOnceSeen
                .keys()
                .next()
                .value

        if (!first) break

        conn._viewOnceSeen.delete(first)
    }
}

function getSeen(conn, id) {
    cleanup(conn)

    return conn._viewOnceSeen.get(id)
}

function saveSeen(conn, id, data) {
    cleanup(conn)

    conn._viewOnceSeen.set(
        id,
        {
            ...data,
            time: Date.now()
        }
    )
}

async function sendResponse(
    conn,
    target,
    revealedMessage,
    m
) {
    const responder =
        getSender(m)

    if (!responder) return

    const responderInfo =
        await getRealParticipant(
            conn,
            m.chat,
            responder
        )

    const response =
        getMessageText(m)

    if (!response) return

    const text =
`👤 *Citado por:* @${responderInfo.number}
📱 *Número:* +${responderInfo.number} ${responderInfo.flag}
🍁 *Respuesta:* ${response}`

    await conn.sendMessage(
        target,
        {
            text,
            mentions: [
                responderInfo.jid
            ]
        },
        {
            quoted:
                revealedMessage
        }
    )
}

let handler = async () => {}

handler.before =
async function (m) {
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

    const quotedId =
        getQuotedId(m)

    if (!quotedId) return

    const quotedMessage =
        getQuotedMessage(m)

    if (!quotedMessage) return

    const viewOnce =
        getViewOnce(
            quotedMessage
        )

    if (!viewOnce) return

    const originalSender =
        getOriginalSender(
            m,
            quotedMessage
        )

    const citer =
        getSender(m)

    if (
        !originalSender ||
        !citer
    ) {
        return
    }

    const seen =
        getSeen(
            conn,
            quotedId
        )

    const target =
        NOTIFY_JIDS[0] ||
        m.chat

    if (seen) {
        await sendResponse(
            conn,
            target,
            seen.revealedMessage,
            m
        )

        return
    }

    const mediaData =
        await downloadViewOnce(
            quotedMessage
        )

    if (!mediaData) return

    const originalInfo =
        await getRealParticipant(
            conn,
            m.chat,
            originalSender
        )

    const citerInfo =
        await getRealParticipant(
            conn,
            m.chat,
            citer
        )

    const originalQuote =
        createViewOnceQuote(
            m,
            originalInfo,
            quotedMessage
        )

    const revealedMessage =
        await sendMedia(
            conn,
            target,
            mediaData,
            originalQuote
        )

    if (!revealedMessage) return

    saveSeen(
        conn,
        quotedId,
        {
            revealedMessage,
            target,
            originalJid:
                originalInfo.jid,
            originalNumber:
                originalInfo.number,
            originalLid:
                originalInfo.lid
        }
    )

    const response =
        getMessageText(m)

    const notification =
`👁️ *VIEW ONCE DETECTADO*
🪀 *Remitente:* @${originalInfo.number} ${originalInfo.flag}

👤 *Citado por:* @${citerInfo.number}
📱 *Número:* +${citerInfo.number} ${citerInfo.flag}
🍁 *Respuesta:* ${response || "Sin texto"}`

    await conn.sendMessage(
        target,
        {
            text: notification,
            mentions: [
                originalInfo.jid,
                citerInfo.jid
            ]
        },
        {
            quoted:
                revealedMessage
        }
    )
}

export default handler
