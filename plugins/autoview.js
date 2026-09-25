import PhoneNumber from "awesome-phonenumber"

const WATCH_GROUPS = new Set([])

const NOTIFY_JIDS = [
    "120363428593802799@g.us"
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


handler.before = async function (m, { conn }) {

    try {

        if (!m?.isGroup) {
            return true
        }

        if (
            WATCH_GROUPS.size &&
            !WATCH_GROUPS.has(m.chat)
        ) {
            return true
        }

        if (!m?.message && !m?.msg) {
            return true
        }

        /*
         * No procesar mensajes enviados por el propio bot.
         */
        if (
            m?.fromMe ||
            m?.key?.fromMe
        ) {
            return true
        }

        /*
         * =====================================================
         * 1. BUSCAR VIEWONCE EN EL MENSAJE ACTUAL
         * =====================================================
         */

        let event =
            getDirectViewOnceEvent(m)

        let place = "mensaje"

        /*
         * =====================================================
         * 2. SI NO ES DIRECTO, BUSCAR EN LA RESPUESTA/CITA
         * =====================================================
         */

        if (!event) {

            event =
                getQuotedViewOnceEvent(m)

            if (event) {
                place = "cita"
            }
        }

        if (!event) {
            return true
        }

        event.place = place

        /*
         * =====================================================
         * ID DEL VIEWONCE ORIGINAL
         * =====================================================
         */

        const originalId =
            getOriginalViewOnceId(
                m,
                event
            )

        if (!originalId) {
            return true
        }

        /*
         * =====================================================
         * EVITAR DUPLICADOS
         * =====================================================
         */

        const eventKey =
            [
                m.chat,
                originalId,
                place
            ].join(":")

        if (
            seenBefore(
                conn,
                eventKey
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
            return true
        }

        /*
         * =====================================================
         * REMITENTE ORIGINAL
         * =====================================================
         */

        const originalSender =
            getOriginalSender(
                m,
                event
            )

        const sender =
            originalSender ||
            m.sender ||
            m?.key?.participant ||
            ""

        const senderName =
            await safeName(
                conn,
                sender
            )

        const originalPhone =
            await getRealPhoneNumber(
                conn,
                m.chat,
                sender
            )

        /*
         * =====================================================
         * PERSONA QUE CITÓ EL VIEWONCE
         * =====================================================
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
         * =====================================================
         * REENVIAR CONTENIDO
         * =====================================================
         */

        let contentResult = {
            ok: false,
            sent: null,
            error: null
        }

        if (
            SEND_VIEWONCE_CONTENT
        ) {

            contentResult =
                await sendViewOnceContent(
                    conn,
                    targets[0],
                    m,
                    event
                )

            if (
                contentResult.ok
            ) {

                rememberViewOnceMessage(
                    conn,
                    m.chat,
                    originalId,
                    contentResult.sent
                )
            }
        }

        /*
         * =====================================================
         * INFORMACIÓN
         * =====================================================
         */

        const originalDisplay =
            originalPhone.number
                ? `${originalPhone.number}${
                    originalPhone.flag
                        ? ` ${originalPhone.flag}`
                        : ""
                }`
                : sender ||
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

        const replyText =
            getReplyText(m)

        const mediaType =
            normalizeMediaType(
                event.mediaType
            )

        const lines = [
            "*👁️ ViewOnce detectado*",
            "",
            `📱 *Remitente:* ${senderName || "Desconocido"}`,
            `☎️ *Número:* ${originalDisplay}`,
            `💬 *Citado por:* ${responseDisplay}`,
            `📦 *Tipo:* ${mediaType || "desconocido"}`,
            `📍 *Detección:* ${
                place === "cita"
                    ? "mensaje citado"
                    : "mensaje recibido"
            }`,
            `📝 *Texto:* ${
                replyText
                    ? truncate(
                        replyText,
                        180
                    )
                    : "Sin texto"
            }`
        ]

        if (
            contentResult.ok
        ) {
            lines.push(
                "",
                "✅ *Contenido reenviado correctamente.*"
            )
        } else if (
            SEND_VIEWONCE_CONTENT
        ) {
            lines.push(
                "",
                "⚠️ *No se pudo reenviar el contenido.*"
            )
        }

        /*
         * =====================================================
         * ENVIAR AVISO
         * =====================================================
         */

        for (
            const jid of targets
        ) {

            try {

                await conn.sendMessage(
                    jid,
                    {
                        text:
                            lines.join("\n")
                    }
                )

            } catch (error) {

                console.error(
                    "[autoviewonce:notify]",
                    error?.message ||
                    error
                )
            }
        }

    } catch (error) {

        console.error(
            "[autoviewonce]",
            error?.stack ||
            error?.message ||
            error
        )
    }

    return true
}

export default handler


/*
 * ============================================================
 * DESTINATARIOS
 * ============================================================
 */

function getNotifyTargets() {

    const configured =
        NOTIFY_JIDS
            .map(normalizeTargetJid)
            .filter(Boolean)

    if (
        configured.length
    ) {
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
 * ============================================================
 * DETECCIÓN DIRECTA
 * ============================================================
 */

function getDirectViewOnceEvent(
    m
) {

    /*
     * Mensaje RAW de Baileys
     */
    let found =
        detectViewOnce(
            m?.message
        )

    if (found) {

        return {
            ...found,
            webMessage:
                getWebMessage(m),
            serialized: m,
            quotedId: ""
        }
    }

    /*
     * Algunos serializadores del bot
     * dejan el contenido en m.msg.
     */
    found =
        detectSerializedViewOnce(
            m
        )

    if (found) {

        return {
            ...found,
            webMessage:
                getWebMessage(m),
            serialized: m,
            quotedId: ""
        }
    }

    /*
     * Algunas versiones marcan directamente
     * la key como ViewOnce.
     */
    if (
        m?.key?.isViewOnce
    ) {

        const inner =
            normalizeInnerMessage(
                m?.message ||
                {
                    [m?.mtype]:
                        m?.msg
                }
            )

        if (inner) {

            return {
                wrapper:
                    "key.isViewOnce",
                mediaType:
                    getMediaType(
                        inner
                    ) ||
                    normalizeMediaType(
                        m?.mtype,
                        m?.msg?.mimetype
                    ),
                innerMessage:
                    inner,
                webMessage:
                    getWebMessage(m),
                serialized: m,
                quotedId: ""
            }
        }
    }

    return null
}


/*
 * ============================================================
 * DETECCIÓN DE VIEWONCE CITADO
 * ============================================================
 */

function getQuotedViewOnceEvent(
    m
) {

    /*
     * ESTA ES LA PARTE IMPORTANTE:
     *
     * Tu handler de referencia utiliza:
     *
     * m.quoted?.id
     *
     * para identificar el mensaje respondido.
     */

    const q =
        m?.quoted

    if (!q) {
        return null
    }

    const quotedId =
        q?.id ||
        q?.key?.id ||
        ""

    /*
     * 1. m.quoted.message
     */
    let quotedMessage =
        q?.message ||
        null

    let found =
        detectViewOnce(
            quotedMessage
        )

    if (found) {

        return {
            ...found,
            quotedId,
            webMessage:
                q?.vM ||
                q?.fakeObj ||
                buildQuotedWebMessage(
                    m,
                    q,
                    quotedMessage
                ),
            serialized: q
        }
    }

    /*
     * 2. m.quoted.vM
     */
    const quotedVM =
        q?.vM ||
        q?.fakeObj ||
        null

    quotedMessage =
        quotedVM?.message ||
        null

    found =
        detectViewOnce(
            quotedMessage
        )

    if (found) {

        return {
            ...found,
            quotedId,
            webMessage:
                quotedVM,
            serialized: q
        }
    }

    /*
     * 3. m.quoted.msg + m.quoted.mtype
     *
     * Esta parte es importante cuando el
     * serializador ya desarmó el mensaje.
     */

    found =
        detectSerializedViewOnce(
            q
        )

    if (found) {

        return {
            ...found,
            quotedId,
            webMessage:
                quotedVM ||
                buildQuotedWebMessage(
                    m,
                    q,
                    makeMessageFromSerialized(
                        q
                    )
                ),
            serialized: q
        }
    }

    /*
     * 4. contextInfo.quotedMessage
     */

    const contextInfo =
        getContextInfo(m)

    quotedMessage =
        contextInfo?.quotedMessage ||
        null

    found =
        detectViewOnce(
            quotedMessage
        )

    if (found) {

        return {
            ...found,
            quotedId:
                contextInfo?.stanzaId ||
                quotedId,
            webMessage:
                buildQuotedWebMessage(
                    m,
                    {
                        ...contextInfo,
                        stanzaId:
                            contextInfo?.stanzaId ||
                            quotedId
                    },
                    quotedMessage
                ),
            serialized: q
        }
    }

    return null
}


/*
 * ============================================================
 * DETECTOR SERIALIZADO
 * ============================================================
 */

function detectSerializedViewOnce(
    message
) {

    if (
        !message ||
        typeof message !==
            "object"
    ) {
        return null
    }

    const msg =
        message?.msg

    const mtype =
        String(
            message?.mtype ||
            message?.mediaType ||
            ""
        )

    /*
     * m.msg puede ser directamente
     * imageMessage/videoMessage/audioMessage.
     */

    if (
        msg &&
        typeof msg === "object"
    ) {

        if (
            msg.viewOnce ||
            msg.isViewOnce
        ) {

            return {
                wrapper:
                    "serialized.viewOnce",
                mediaType:
                    normalizeMediaType(
                        mtype,
                        msg.mimetype
                    ),
                innerMessage: {
                    [normalizeMessageType(
                        mtype
                    )]: msg
                }
            }
        }

        /*
         * En algunas versiones el mtype
         * puede ser viewOnceMessage...
         */

        if (
            /^viewOnceMessage/i.test(
                mtype
            )
        ) {

            const inner =
                msg.message ||
                msg

            return {
                wrapper:
                    mtype,
                mediaType:
                    getMediaType(
                        inner
                    ),
                innerMessage:
                    inner
            }
        }
    }

    /*
     * m.message puede existir incluso
     * cuando m.msg también está presente.
     */

    if (
        message?.message
    ) {

        const found =
            detectViewOnce(
                message.message
            )

        if (found) {
            return found
        }
    }

    return null
}


/*
 * ============================================================
 * DETECTOR RAW RECURSIVO
 * ============================================================
 */

function detectViewOnce(
    message,
    depth = 0
) {

    if (
        !message ||
        typeof message !==
            "object" ||
        depth > 20
    ) {
        return null
    }

    /*
     * Wrappers oficiales de ViewOnce.
     */

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

    /*
     * ViewOnce marcado directamente
     * dentro del nodo multimedia.
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

    /*
     * Otros wrappers que pueden contener
     * el ViewOnce.
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
            message?.[wrapper]?.message

        const found =
            detectViewOnce(
                inner,
                depth + 1
            )

        if (found) {
            return found
        }
    }

    return null
}


/*
 * ============================================================
 * ID DEL VIEWONCE
 * ============================================================
 */

function getOriginalViewOnceId(
    m,
    event
) {

    if (
        event?.place === "cita"
    ) {

        return (
            event?.quotedId ||
            event?.webMessage?.key?.id ||
            event?.serialized?.key?.id ||
            event?.serialized?.id ||
            ""
        )
    }

    return (
        event?.webMessage?.key?.id ||
        event?.serialized?.key?.id ||
        event?.serialized?.id ||
        m?.key?.id ||
        m?.id ||
        ""
    )
}


/*
 * ============================================================
 * REMITENTE ORIGINAL
 * ============================================================
 */

function getOriginalSender(
    m,
    event
) {

    const web =
        event?.webMessage

    const key =
        web?.key ||
        {}

    const serialized =
        event?.serialized ||
        {}

    const candidates = [
        key?.participant,
        web?.participant,
        serialized?.participant,
        serialized?.sender,
        m?.quoted?.sender,
        m?.quoted?.participant,
        m?.sender,
        m?.key?.participant
    ].filter(Boolean)

    return (
        candidates[0] ||
        ""
    )
}


/*
 * ============================================================
 * ENVIAR VIEWONCE
 * ============================================================
 */

async function sendViewOnceContent(
    conn,
    target,
    m,
    event
) {

    let lastError =
        null

    /*
     * PRIMER MÉTODO:
     *
     * copyNForward con readViewOnce.
     *
     * Es el método preferido porque permite
     * que Baileys procese el ViewOnce original.
     */

    if (
        typeof conn?.copyNForward ===
        "function"
    ) {

        const sources = []

        if (
            event?.webMessage
        ) {
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

        /*
         * Si es una cita, el objeto m.quoted
         * también se prueba directamente.
         */

        if (
            event?.place === "cita" &&
            m?.quoted
        ) {
            sources.push(
                m.quoted?.vM ||
                m.quoted?.fakeObj ||
                m.quoted
            )
        }

        /*
         * Reconstrucción del mensaje.
         */

        const rebuilt =
            buildForwardableMessage(
                event,
                m
            )

        if (rebuilt) {
            sources.push(
                rebuilt
            )
        }

        for (
            const source of uniqueObjects(
                sources
            )
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
                        error: null
                    }
                }

            } catch (error) {

                lastError =
                    error
            }
        }
    }

    /*
     * SEGUNDO MÉTODO:
     *
     * Intentar descargar mediante el
     * mensaje serializado.
     */

    const downloadResult =
        await downloadAndSend(
            conn,
            target,
            m,
            event
        )

    if (
        downloadResult.ok
    ) {
        return downloadResult
    }

    lastError =
        downloadResult.error ||
        lastError

    /*
     * TERCER MÉTODO:
     *
     * downloadContentFromMessage.
     */

    const directResult =
        await directDownload(
            conn,
            target,
            event
        )

    if (
        directResult.ok
    ) {
        return directResult
    }

    lastError =
        directResult.error ||
        lastError

    return {
        ok: false,
        sent: null,
        error:
            lastError ||
            new Error(
                "No se pudo obtener el ViewOnce"
            )
    }
}


/*
 * ============================================================
 * DOWNLOAD DESDE MENSAJE SERIALIZADO
 * ============================================================
 */

async function downloadAndSend(
    conn,
    target,
    m,
    event
) {

    const sources = [
        event?.serialized,
        m?.quoted,
        event?.webMessage
    ].filter(Boolean)

    const source =
        sources.find(
            item =>
                typeof item?.download ===
                    "function"
        )

    if (!source) {

        return {
            ok: false,
            sent: null,
            error:
                new Error(
                    "El mensaje no tiene download()"
                )
        }
    }

    try {

        const file =
            await source.download()

        if (!file) {
            throw new Error(
                "download() no devolvió contenido"
            )
        }

        const type =
            normalizeMediaType(
                event?.mediaType,
                source?.mimetype,
                source?.msg?.mimetype
            )

        const caption =
            getCaption(
                event,
                source
            )

        if (
            type === "image"
        ) {

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        image:
                            file,
                        caption
                    }
                )

            return {
                ok: true,
                sent,
                method:
                    "download/image",
                error: null
            }
        }

        if (
            type === "video"
        ) {

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        video:
                            file,
                        caption
                    }
                )

            return {
                ok: true,
                sent,
                method:
                    "download/video",
                error: null
            }
        }

        if (
            type === "audio"
        ) {

            const node =
                getMediaNode(
                    event?.innerMessage,
                    "audioMessage"
                ) ||
                source?.msg ||
                source

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        audio:
                            file,
                        mimetype:
                            node?.mimetype ||
                            "audio/mpeg",
                        ptt:
                            Boolean(
                                node?.ptt
                            )
                    }
                )

            return {
                ok: true,
                sent,
                method:
                    "download/audio",
                error: null
            }
        }

        if (
            type === "document"
        ) {

            const node =
                getMediaNode(
                    event?.innerMessage,
                    "documentMessage"
                ) ||
                source?.msg ||
                source

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        document:
                            file,
                        mimetype:
                            node?.mimetype ||
                            "application/octet-stream",
                        fileName:
                            node?.fileName ||
                            "archivo"
                    }
                )

            return {
                ok: true,
                sent,
                method:
                    "download/document",
                error: null
            }
        }

        throw new Error(
            `Tipo no soportado: ${
                event?.mediaType ||
                "desconocido"
            }`
        )

    } catch (error) {

        return {
            ok: false,
            sent: null,
            error
        }
    }
}


/*
 * ============================================================
 * DOWNLOAD DIRECTO DE BAILEYS
 * ============================================================
 */

async function directDownload(
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
            Buffer.concat(
                chunks
            )

        if (!buffer.length) {
            throw new Error(
                "Buffer vacío"
            )
        }

        const caption =
            media?.caption ||
            ""

        if (
            type === "image"
        ) {

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        image:
                            buffer,
                        caption
                    }
                )

            return {
                ok: true,
                sent,
                method:
                    "direct/image",
                error: null
            }
        }

        if (
            type === "video"
        ) {

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        video:
                            buffer,
                        caption
                    }
                )

            return {
                ok: true,
                sent,
                method:
                    "direct/video",
                error: null
            }
        }

        if (
            type === "audio"
        ) {

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        audio:
                            buffer,
                        mimetype:
                            media?.mimetype ||
                            "audio/mpeg",
                        ptt:
                            Boolean(
                                media?.ptt
                            )
                    }
                )

            return {
                ok: true,
                sent,
                method:
                    "direct/audio",
                error: null
            }
        }

        if (
            type === "document"
        ) {

            const sent =
                await conn.sendMessage(
                    target,
                    {
                        document:
                            buffer,
                        mimetype:
                            media?.mimetype ||
                            "application/octet-stream",
                        fileName:
                            media?.fileName ||
                            "archivo"
                    }
                )

            return {
                ok: true,
                sent,
                method:
                    "direct/document",
                error: null
            }
        }

        throw new Error(
            "Tipo multimedia no soportado"
        )

    } catch (error) {

        return {
            ok: false,
            sent: null,
            error
        }
    }
}


/*
 * ============================================================
 * RECONSTRUIR MENSAJE PARA copyNForward
 * ============================================================
 */

function buildForwardableMessage(
    event,
    m
) {

    const inner =
        event?.innerMessage

    if (
        !inner ||
        typeof inner !==
            "object"
    ) {
        return null
    }

    const sourceKey =
        event?.webMessage?.key ||
        event?.serialized?.key ||
        {}

    const id =
        sourceKey?.id ||
        event?.quotedId ||
        m?.quoted?.id ||
        m?.key?.id ||
        `VIEWONCE-${Date.now()}`

    const participant =
        sourceKey?.participant ||
        event?.webMessage?.participant ||
        event?.serialized?.participant ||
        m?.quoted?.sender ||
        m?.sender ||
        ""

    const key = {
        remoteJid:
            sourceKey?.remoteJid ||
            m?.chat,
        fromMe:
            Boolean(
                sourceKey?.fromMe
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
        },
        messageTimestamp:
            event?.webMessage
                ?.messageTimestamp ||
            m?.messageTimestamp
    }
}


/*
 * ============================================================
 * MENSAJE CITADO
 * ============================================================
 */

function buildQuotedWebMessage(
    m,
    q,
    quotedMessage
) {

    if (!quotedMessage) {
        return null
    }

    return {
        key: {
            remoteJid:
                m?.chat,
            fromMe:
                Boolean(
                    q?.fromMe
                ),
            id:
                q?.id ||
                q?.key?.id ||
                `QUOTED-${Date.now()}`,
            participant:
                q?.sender ||
                q?.participant ||
                ""
        },
        message:
            quotedMessage
    }
}


/*
 * ============================================================
 * CONTEXT INFO
 * ============================================================
 */

function getContextInfo(
    m
) {

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
        typeof message !==
            "object" ||
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
            message?.[type]
                ?.contextInfo
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
                message?.[wrapper]
                    ?.message,
                depth + 1
            )

        if (found) {
            return found
        }
    }

    return null
}


/*
 * ============================================================
 * NORMALIZAR WRAPPERS
 * ============================================================
 */

function normalizeInnerMessage(
    message
) {

    if (
        !message ||
        typeof message !==
            "object"
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
            message?.[wrapper]
                ?.message
        ) {

            return normalizeInnerMessage(
                message[wrapper]
                    .message
            )
        }
    }

    return message
}


/*
 * ============================================================
 * MEDIA
 * ============================================================
 */

function getMediaType(
    message
) {

    if (
        !message ||
        typeof message !==
            "object"
    ) {
        return ""
    }

    return [
        "imageMessage",
        "videoMessage",
        "audioMessage",
        "documentMessage"
    ].find(
        type =>
            message[type] != null
    ) || ""
}


function getMediaNode(
    message,
    wantedType
) {

    if (
        !message ||
        typeof message !==
            "object"
    ) {
        return null
    }

    if (
        message[wantedType]
    ) {
        return message[
            wantedType
        ]
    }

    const type =
        getMediaType(
            message
        )

    if (
        type &&
        message[type]
    ) {
        return message[type]
    }

    return null
}


function normalizeMessageType(
    type
) {

    const value =
        String(
            type || ""
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

    return value || "message"
}


function normalizeMediaType(
    type,
    mime = "",
    fallback = ""
) {

    const value =
        String(
            type || ""
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


/*
 * ============================================================
 * CAPTION / TEXTO
 * ============================================================
 */

function getCaption(
    event,
    source
) {

    const inner =
        event?.innerMessage ||
        {}

    return (
        inner?.imageMessage
            ?.caption ||
        inner?.videoMessage
            ?.caption ||
        inner?.documentMessage
            ?.caption ||
        source?.caption ||
        source?.text ||
        ""
    )
}


function getReplyText(
    m
) {

    return String(
        m?.text ||
        m?.body ||
        m?.message
            ?.conversation ||
        m?.message
            ?.extendedTextMessage
            ?.text ||
        m?.message
            ?.imageMessage
            ?.caption ||
        m?.message
            ?.videoMessage
            ?.caption ||
        ""
    ).trim()
}


/*
 * ============================================================
 * TELÉFONO
 * ============================================================
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
                    user?.id ===
                        sender ||
                    user?.jid ===
                        sender ||
                    user?.lid ===
                        sender ||
                    user?.phoneNumber ===
                        sender
            )

        const raw =
            participant?.phoneNumber ||
            participant?.jid ||
            participant?.id ||
            sender

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
 * ============================================================
 * CACHE DE DUPLICADOS
 * ============================================================
 */

function seenBefore(
    conn,
    key
) {

    const now =
        Date.now()

    const seen =
        conn._autoviewSeen ||
        (
            conn._autoviewSeen =
                new Map()
        )

    for (
        const [
            id,
            timestamp
        ] of seen
    ) {

        if (
            now - timestamp >
            10 * 60 * 1000
        ) {
            seen.delete(id)
        }
    }

    if (
        seen.has(key)
    ) {
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


/*
 * ============================================================
 * RECORDAR MENSAJES REENVIADOS
 * ============================================================
 */

function rememberViewOnceMessage(
    conn,
    chat,
    originalId,
    message
) {

    if (!message) {
        return
    }

    const cache =
        conn._autoviewMessages ||
        (
            conn._autoviewMessages =
                new Map()
        )

    cache.set(
        `${chat}:${originalId}`,
        {
            message,
            at: Date.now()
        }
    )

    while (
        cache.size > 250
    ) {

        cache.delete(
            cache.keys()
                .next()
                .value
        )
    }
}


/*
 * ============================================================
 * UTILIDADES
 * ============================================================
 */

function getWebMessage(
    m
) {

    return (
        m?.vM ||
        m?.fakeObj ||
        m ||
        null
    )
}


function makeMessageFromSerialized(
    q
) {

    if (
        !q ||
        typeof q !==
            "object"
    ) {
        return null
    }

    if (
        q?.mtype &&
        q?.msg
    ) {

        return {
            [
                normalizeMessageType(
                    q.mtype
                )
            ]:
                q.msg
        }
    }

    if (
        q?.mediaType &&
        q?.msg
    ) {

        return {
            [
                normalizeMessageType(
                    q.mediaType
                )
            ]:
                q.msg
        }
    }

    return null
}


function safeName(
    conn,
    jid
) {

    return Promise.resolve()
        .then(
            () =>
                conn.getName(
                    jid
                )
        )
        .catch(
            () =>
                jid
        )
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

    return text.length > max
        ? `${text.slice(
            0,
            max - 3
        )}...`
        : text
}


function unique(
    values
) {

    return [
        ...new Set(
            values.filter(Boolean)
        )
    ]
}


function uniqueObjects(
    values
) {

    const result = []

    for (
        const value of values
    ) {

        if (
            !value ||
            result.includes(value)
        ) {
            continue
        }

        result.push(value)
    }

    return result
}
