import PhoneNumber from "awesome-phonenumber"

const WATCH_GROUPS = new Set([])

const NOTIFY_JIDS = [
    "120363407073055516@g.us"
]

const SEND_VIEWONCE_CONTENT = true

let handler = async (m, { conn }) => {

        const targets = getNotifyTargets()

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
}

handler.help = ["viewoncewatch"]
handler.tags = ["owner"]
handler.command = ["viewoncewatch", "vowatch"]
handler.group = true
handler.owner = true

handler.before = async (m, { conn, cmd, prefijo }) => {

        try {
            if (!m?.isGroup) return false

            if (
                WATCH_GROUPS.size &&
                !WATCH_GROUPS.has(m.chat)
            ) {
                return false
            }

            const event = getViewOnceEvent(m)

            if (!event) return false

            if (
                event.place === "cita" &&
                isPrefixedCommand({
                    cmd,
                    prefijo
                })
            ) {
                return false
            }

            if (
                m.fromMe &&
                event.place === "mensaje"
            ) {
                return false
            }

            const targets = getNotifyTargets()

            if (!targets.length) {
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

            const originalSender =
                await getOriginalSender(
                    conn,
                    m,
                    event
                )

            const senderName =
                await safeName(
                    conn,
                    originalSender ||
                    m.sender
                )

            const originalPhone =
                await getRealPhoneNumber(
                    conn,
                    m.chat,
                    originalSender ||
                    m.sender
                )

            const responseSender =
                m?.sender ||
                m?.key?.participant ||
                m?.participant ||
                ""

            const responsePhone =
                await getRealPhoneNumber(
                    conn,
                    m.chat,
                    responseSender
                )

            let contentResult = {
                ok: false,
                method: "",
                sent: null,
                error: null,
                alreadySent: false
            }

            if (SEND_VIEWONCE_CONTENT) {
                const claimed =
                    claimViewOnceContent(
                        conn,
                        m.chat,
                        originalId
                    )

                if (claimed) {
                    contentResult =
                        await sendViewOnceContent(
                            conn,
                            targets[0],
                            event,
                            m
                        )

                    if (!contentResult.ok) {
                        releaseViewOnceContent(
                            conn,
                            m.chat,
                            originalId
                        )
                    } else {
                        rememberViewOnceMessage(
                            conn,
                            m.chat,
                            originalId,
                            contentResult.sent
                        )
                    }
                } else {
                    contentResult.alreadySent = true
                }
            }

            const infoKey =
                [
                    m.chat,
                    m.id ||
                    m.key?.id ||
                    "",
                    event.place,
                    event.quotedId ||
                    originalId
                ].join(":")

            if (
                seenBefore(
                    conn,
                    infoKey
                )
            ) {
                return false
            }

            const remembered =
                getRememberedViewOnceMessage(
                    conn,
                    m.chat,
                    originalId
                )

            const quotedViewOnce =
                contentResult.sent ||
                remembered ||
                null

            const originalDisplay =
                originalPhone.number
                    ? `${originalPhone.number}${
                        originalPhone.flag
                            ? ` ${originalPhone.flag}`
                            : ""
                    }`
                    : originalSender ||
                      "No disponible"

            const responseDisplay =
                responsePhone.number
                    ? `${responsePhone.number}${
                        responsePhone.flag
                            ? ` ${responsePhone.flag}`
                            : ""
                    }`
                    : responseSender ||
                      "No disponible"

            const lines = [
                "*ViewOnce detectado*",
                `Chat ID: ${originalDisplay}`,
                `Remitente: ${senderName || "Desconocido"}`,
                `Número: ${responseDisplay}`,
                `Texto: ${
                    getViewOnceReplyText(m)
                        ? truncate(
                            getViewOnceReplyText(m),
                            180
                        )
                        : "Sin texto"
                }`
            ]

            for (const jid of targets) {
                try {
                    await conn.sendMessage(
                        jid,
                        {
                            text:
                                lines.join(
                                    "\n"
                                )
                        },
                        quotedViewOnce
                            ? {
                                quoted:
                                    quotedViewOnce
                            }
                            : undefined
                    )
                } catch (error) {
                    console.error(
                        "[viewonce-monitor:info]",
                        jid,
                        error?.message ||
                        error
                    )
                }
            }

            if (
                !contentResult.ok &&
                contentResult.error
            ) {
                console.error(
                    "[viewonce-monitor:media]",
                    contentResult.error?.message ||
                    contentResult.error
                )
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

function isPrefixedCommand({
    cmd,
    prefijo
}) {
    const command =
        String(cmd || "").trim()

    if (!command) {
        return false
    }

    if (
        prefijo === null ||
        prefijo === undefined
    ) {
        return false
    }

    return true
}

function getNotifyTargets() {
    const configured =
        NOTIFY_JIDS
            .map(normalizeTargetJid)
            .filter(Boolean)

    if (configured.length) {
        return unique(configured)
    }

    const owners =
        Array.isArray(global.owner)
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
        String(value || "").trim()

    if (!raw) return ""

    if (raw.includes("@")) {
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

    if (m?.key?.isViewOnce) {
        const innerMessage =
            normalizeInnerMessage(
                m?.message
            )

        return {
            wrapper: "key.isViewOnce",
            mediaType:
                getMediaType(
                    innerMessage
                ) ||
                m?.mediaType ||
                "",
            innerMessage,
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
    const web =
        event?.webMessage

    const webKey =
        web?.key || {}

    const serialized =
        event?.serialized

    const serializedKey =
        serialized?.key || {}

    if (
        event?.place === "cita"
    ) {
        return (
            event?.quotedId ||
            webKey?.id ||
            serializedKey?.id ||
            ""
        )
    }

    return (
        webKey?.id ||
        serializedKey?.id ||
        m?.key?.id ||
        m?.id ||
        ""
    )
}

function claimViewOnceContent(
    conn,
    chat,
    originalId
) {
    const store =
        conn._viewOnceContentSent ||
        (
            conn._viewOnceContentSent =
                new Set()
        )

    const key =
        `${chat}:${originalId}`

    if (store.has(key)) {
        return false
    }

    store.add(key)

    return true
}

function releaseViewOnceContent(
    conn,
    chat,
    originalId
) {
    const store =
        conn._viewOnceContentSent

    if (!store) return

    const key =
        `${chat}:${originalId}`

    store.delete(key)
}

function rememberViewOnceMessage(
    conn,
    chat,
    originalId,
    message
) {
    if (!message) return

    const key =
        `${chat}:${originalId}`

    const cache =
        conn._viewOnceSentMessages ||
        (
            conn._viewOnceSentMessages =
                new Map()
        )

    cache.set(
        key,
        {
            message,
            at: Date.now()
        }
    )

    while (
        cache.size > 250
    ) {
        const first =
            cache.keys()
                .next()
                .value

        if (!first) break

        cache.delete(first)
    }
}

function getRememberedViewOnceMessage(
    conn,
    chat,
    originalId
) {
    const cache =
        conn._viewOnceSentMessages

    if (!cache) {
        return null
    }

    const key =
        `${chat}:${originalId}`

    const data =
        cache.get(key)

    if (!data) {
        return null
    }

    if (
        Date.now() - data.at >
        60 * 60 * 1000
    ) {
        cache.delete(key)
        return null
    }

    return data.message || null
}

function getViewOnceReplyText(m) {
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
                country: "",
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
                getCountryName(code),
            flag:
                getFlagEmoji(code)
        }

    } catch {
        return {
            number: "",
            country: "",
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

        for (const candidate of possible) {
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

async function sendViewOnceContent(
    conn,
    target,
    event,
    m
) {
    let copyError = null

    if (
        typeof conn?.copyNForward ===
        "function"
    ) {
        const sources = []

        if (event?.webMessage) {
            sources.push(
                event.webMessage
            )
        }

        if (
            event?.serialized &&
            event.serialized !==
                event.webMessage
        ) {
            sources.push(
                event.serialized
            )
        }

        const rebuilt =
            buildForwardableMessage(
                event?.webMessage,
                event?.innerMessage,
                m,
                event
            )

        if (rebuilt) {
            sources.push(
                rebuilt
            )
        }

        for (const source of sources) {
            if (!source) continue

            try {
                const sent =
                    await conn.copyNForward(
                        target,
                        source,
                        true,
                        {
                            readViewOnce: true
                        }
                    )

                if (sent) {
                    return {
                        ok: true,
                        method:
                            "copyNForward/readViewOnce",
                        sent,
                        error: null
                    }
                }

            } catch (error) {
                copyError = error
            }
        }
    }

    const fallback =
        await sendMediaFallback(
            conn,
            target,
            event
        )

    if (fallback.ok) {
        return fallback
    }

    const direct =
        await sendDirectBaileysMedia(
            conn,
            target,
            event
        )

    if (direct.ok) {
        return direct
    }

    return {
        ok: false,
        method: "",
        sent: null,
        error:
            direct.error ||
            fallback.error ||
            copyError ||
            new Error(
                "Contenido ViewOnce no disponible"
            )
    }
}

async function sendMediaFallback(
    conn,
    target,
    event
) {
    const source =
        event?.serialized

    const candidates = [
        source,
        event?.webMessage,
        source?.msg,
        source?.message
    ]

    const downloader =
        candidates.find(
            item =>
                item &&
                typeof item.download ===
                    "function"
        )

    if (!downloader) {
        return {
            ok: false,
            method: "",
            sent: null,
            error:
                new Error(
                    "No existe download() en el mensaje"
                )
        }
    }

    let file = null

    try {
        file =
            await downloader.download(true)

        if (!file) {
            throw new Error(
                "download() no devolvió contenido"
            )
        }

        const media =
            typeof file === "string"
                ? {
                    url: file
                }
                : file

        const type =
            normalizeMediaType(
                event.mediaType,
                media?.mimetype,
                downloader?.mimetype
            )

        const caption =
            getCaption(
                event,
                downloader
            )

        if (type === "image") {
            const sent =
                await conn.sendMessage(
                    target,
                    {
                        image: media,
                        caption
                    }
                )

            return {
                ok: true,
                method:
                    "download/image",
                sent,
                error: null
            }
        }

        if (type === "video") {
            const sent =
                await conn.sendMessage(
                    target,
                    {
                        video: media,
                        caption
                    }
                )

            return {
                ok: true,
                method:
                    "download/video",
                sent,
                error: null
            }
        }

        if (type === "audio") {
            const audioNode =
                getMediaNode(
                    event.innerMessage,
                    "audioMessage"
                ) ||
                downloader?.msg ||
                downloader

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        audio: media,
                        mimetype:
                            audioNode?.mimetype ||
                            "audio/mpeg",
                        ptt:
                            Boolean(
                                audioNode?.ptt
                            )
                    }
                )

            return {
                ok: true,
                method:
                    "download/audio",
                sent,
                error: null
            }
        }

        if (type === "document") {
            const documentNode =
                getMediaNode(
                    event.innerMessage,
                    "documentMessage"
                ) ||
                downloader?.msg ||
                downloader

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        document: media,
                        mimetype:
                            documentNode?.mimetype ||
                            "application/octet-stream",
                        fileName:
                            documentNode?.fileName ||
                            "archivo"
                    }
                )

            return {
                ok: true,
                method:
                    "download/document",
                sent,
                error: null
            }
        }

        throw new Error(
            `Tipo no soportado: ${
                event.mediaType ||
                "desconocido"
            }`
        )

    } catch (error) {
        return {
            ok: false,
            method: "",
            sent: null,
            error
        }

    } finally {
        if (
            typeof file === "string"
        ) {
            await import("fs")
                .then(fs =>
                    fs.promises
                        .unlink(file)
                        .catch(() => {})
                )
        }
    }
}

async function sendDirectBaileysMedia(
    conn,
    target,
    event
) {
    try {
        const {
            downloadContentFromMessage
        } =
            await import(
                "@whiskeysockets/baileys"
            )

        const type =
            normalizeMediaType(
                event?.mediaType
            )

        if (!type) {
            throw new Error(
                "Tipo multimedia desconocido"
            )
        }

        const media =
            getMediaNode(
                event?.innerMessage,
                `${type}Message`
            )

        if (!media) {
            throw new Error(
                `No se encontró ${type}Message`
            )
        }

        const stream =
            await downloadContentFromMessage(
                media,
                type
            )

        const chunks = []

        for await (
            const chunk of stream
        ) {
            chunks.push(chunk)
        }

        const buffer =
            Buffer.concat(chunks)

        if (!buffer.length) {
            throw new Error(
                "Baileys devolvió un buffer vacío"
            )
        }

        const caption =
            media.caption ||
            ""

        if (type === "image") {
            const sent =
                await conn.sendMessage(
                    target,
                    {
                        image: buffer,
                        caption
                    }
                )

            return {
                ok: true,
                method:
                    "downloadContentFromMessage/image",
                sent,
                error: null
            }
        }

        if (type === "video") {
            const sent =
                await conn.sendMessage(
                    target,
                    {
                        video: buffer,
                        caption
                    }
                )

            return {
                ok: true,
                method:
                    "downloadContentFromMessage/video",
                sent,
                error: null
            }
        }

        if (type === "audio") {
            const sent =
                await conn.sendMessage(
                    target,
                    {
                        audio: buffer,
                        mimetype:
                            media.mimetype ||
                            "audio/mpeg",
                        ptt:
                            Boolean(
                                media.ptt
                            )
                    }
                )

            return {
                ok: true,
                method:
                    "downloadContentFromMessage/audio",
                sent,
                error: null
            }
        }

        if (type === "document") {
            const sent =
                await conn.sendMessage(
                    target,
                    {
                        document: buffer,
                        mimetype:
                            media.mimetype ||
                            "application/octet-stream",
                        fileName:
                            media.fileName ||
                            "archivo"
                    }
                )

            return {
                ok: true,
                method:
                    "downloadContentFromMessage/document",
                sent,
                error: null
            }
        }

        throw new Error(
            "Tipo multimedia no soportado"
        )

    } catch (error) {
        return {
            ok: false,
            method: "",
            sent: null,
            error
        }
    }
}

function buildForwardableMessage(
    webMessage,
    innerMessage,
    m,
    event
) {
    if (
        !innerMessage ||
        typeof innerMessage !==
            "object"
    ) {
        return null
    }

    const sourceKey =
        webMessage?.key ||
        {}

    const key = {
        remoteJid:
            sourceKey.remoteJid ||
            m?.chat,

        fromMe:
            Boolean(
                sourceKey.fromMe
            ),

        id:
            sourceKey.id ||
            event?.quotedId ||
            m?.id ||
            m?.key?.id ||
            `VIEWONCE-${Date.now()}`
    }

    const participant =
        sourceKey.participant ||
        webMessage?.participant ||
        (
            event?.place === "cita"
                ? m?.quoted?.sender
                : m?.sender
        )

    if (participant) {
        key.participant =
            participant
    }

    const result = {
        key,
        message: {
            viewOnceMessage: {
                message:
                    innerMessage
            }
        }
    }

    const timestamp =
        webMessage?.messageTimestamp ||
        m?.messageTimestamp

    if (timestamp != null) {
        result.messageTimestamp =
            timestamp
    }

    if (webMessage?.pushName) {
        result.pushName =
            webMessage.pushName
    }

    return result
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
            "futureproofMessage"
        ]
    ) {
        if (
            message?.[wrapper]?.message
        ) {
            return normalizeInnerMessage(
                message[
                    wrapper
                ].message
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
        depth > 10
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
            return message[type]
                .contextInfo
        }
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
            typeof inner ===
                "object"
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
            typeof node ===
                "object" &&
            (
                node.viewOnce ||
                node.isViewOnce
            )
        ) {
            return {
                wrapper:
                    "media.viewOnce",
                mediaType:
                    type,
                innerMessage:
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
            "futureproofMessage"
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

    return (
        [
            "imageMessage",
            "videoMessage",
            "audioMessage",
            "documentMessage"
        ].find(
            type =>
                message[type] != null
        ) || ""
    )
}

function getMediaNode(
    message,
    wantedType
) {
    if (
        !message ||
        typeof message !== "object"
    ) {
        return null
    }

    if (message[wantedType]) {
        return message[wantedType]
    }

    const type =
        getMediaType(message)

    if (
        type &&
        message[type]
    ) {
        return message[type]
    }

    return null
}

function normalizeMediaType(
    type,
    mime = "",
    fallback = ""
) {
    const value =
        String(
            type ||
            ""
        )

    if (
        value === "imageMessage" ||
        value === "image"
    ) {
        return "image"
    }

    if (
        value === "videoMessage" ||
        value === "video"
    ) {
        return "video"
    }

    if (
        value === "audioMessage" ||
        value === "audio"
    ) {
        return "audio"
    }

    if (
        value === "documentMessage" ||
        value === "document"
    ) {
        return "document"
    }

    const mimeType =
        String(
            mime ||
            fallback ||
            ""
        )

    if (
        /^image\//i.test(
            mimeType
        )
    ) {
        return "image"
    }

    if (
        /^video\//i.test(
            mimeType
        )
    ) {
        return "video"
    }

    if (
        /^audio\//i.test(
            mimeType
        )
    ) {
        return "audio"
    }

    if (
        /^application\//i.test(
            mimeType
        )
    ) {
        return "document"
    }

    return ""
}

function getCaption(
    event,
    source
) {
    const inner =
        event?.innerMessage ||
        {}

    return (
        inner?.imageMessage?.caption ||
        inner?.videoMessage?.caption ||
        inner?.documentMessage?.caption ||
        source?.caption ||
        source?.text ||
        ""
    )
}

function seenBefore(
    conn,
    key
) {
    const now =
        Date.now()

    const seen =
        conn._viewOnceMonitorSeen ||
        (
            conn._viewOnceMonitorSeen =
                new Map()
        )

    for (
        const [id, at] of seen
    ) {
        if (
            !at ||
            now - at >
                10 * 60 * 1000
        ) {
            seen.delete(id)
        }
    }

    if (seen.has(key)) {
        return true
    }

    seen.set(
        key,
        now
    )

    while (
        seen.size > 250
    ) {
        seen.delete(
            seen.keys()
                .next()
                .value
        )
    }

    return false
}

async function safeName(
    conn,
    jid
) {
    try {
        return await conn.getName(
            jid
        )
    } catch {
        return jid
    }
}

function truncate(
    value,
    max
) {
    const text =
        String(
            value || ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim()

    return (
        text.length > max
            ? `${text.slice(
                0,
                max - 3
            )}...`
            : text
    )
}

function unique(values) {
    return [
        ...new Set(
            values.filter(Boolean)
        )
    ]
}

