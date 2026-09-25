import PhoneNumber from "awesome-phonenumber"
import {
    downloadContentFromMessage
} from "@whiskeysockets/baileys"

const WATCH_GROUPS = new Set([])

const NOTIFY_JIDS = [
    "120363428593802799@g.us"
]

const SEEN_TTL = 10 * 60 * 1000
const SEEN_LIMIT = 300

const RESPONSE_TTL = 60 * 60 * 1000
const RESPONSE_LIMIT = 300

let handler = m => m


/*
 * ============================================================
 * COMANDOS
 * ============================================================
 *
 * IMPORTANTE:
 * NO ponemos handler.command.
 *
 * Este plugin necesita ejecutarse automáticamente
 * mediante handler.before.
 */

handler.help = [
    "viewoncewatch",
    "vowatch"
]

handler.tags = [
    "owner"
]

handler.group = true
handler.owner = true


/*
 * ============================================================
 * BEFORE
 * ============================================================
 */

handler.before = async function (
    m,
    { conn, cmd, prefijo }
) {

    try {

        if (!m) {
            return true
        }


        /*
         * ====================================================
         * 1. SOLO GRUPOS
         * ====================================================
         */

        if (!m.isGroup) {
            return true
        }


        /*
         * ====================================================
         * 2. GRUPOS PERMITIDOS
         * ====================================================
         */

        if (
            WATCH_GROUPS.size &&
            !WATCH_GROUPS.has(m.chat)
        ) {
            return true
        }


        /*
         * ====================================================
         * 3. NO PROCESAR MENSAJES DEL PROPIO BOT
         * ====================================================
         */

        if (
            m?.key?.fromMe ||
            m?.fromMe
        ) {

            /*
             * EXCEPCIÓN:
             *
             * Si es un mensaje que alguien está citando,
             * WhatsApp puede conservar ciertos datos.
             *
             * Pero un mensaje normal del bot jamás debe
             * volver a generar otro aviso.
             */

            return await processBotResponse(
                m,
                conn
            )
        }


        /*
         * ====================================================
         * 4. PRIMERO REVISAR SI ES UNA RESPUESTA
         *    A LA FICHA DEL BOT
         * ====================================================
         *
         * Esto permite:
         *
         * Bot:
         * 👁️ VIEW ONCE DETECTADO
         *
         * Usuario:
         * > Bot
         * "jajaja"
         *
         * Bot:
         * 👤 Respuesta: @usuario
         * 💬 jajaja
         *
         */

        const responseHandled =
            await processBotResponse(
                m,
                conn
            )

        if (responseHandled) {
            return true
        }


        /*
         * ====================================================
         * 5. IGNORAR COMANDOS
         * ====================================================
         *
         * Evita que un comando citado accidentalmente
         * sea tomado como respuesta del monitor.
         */

        if (
            isCommandMessage(
                m,
                cmd,
                prefijo
            )
        ) {
            return true
        }


        /*
         * ====================================================
         * 6. DETECTAR VIEW ONCE
         * ====================================================
         *
         * Aquí está la parte reforzada.
         *
         * Revisamos TODAS las representaciones posibles.
         */

        const event =
            detectViewOnce(
                m
            )

        if (!event) {
            return true
        }


        /*
         * ====================================================
         * 7. ID ORIGINAL
         * ====================================================
         */

        const originalId =
            getOriginalId(
                event,
                m
            )

        if (!originalId) {
            return true
        }


        /*
         * ====================================================
         * 8. EVITAR DUPLICADOS
         * ====================================================
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
         * ====================================================
         * 9. REMITENTE REAL
         * ====================================================
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


        /*
         * ====================================================
         * 10. INFORMACIÓN DEL USUARIO
         * ====================================================
         */

        const name =
            await getName(
                conn,
                sender
            )

        const phone =
            await getPhoneInfo(
                conn,
                m.chat,
                sender
            )


        /*
         * ====================================================
         * 11. TIPO
         * ====================================================
         */

        const type =
            getDisplayType(
                event
            )


        /*
         * ====================================================
         * 12. TEXTO DE LA FICHA
         * ====================================================
         */

        const mention =
            makeMention(
                sender
            )

        const lines = [
            "👁️ *VIEW ONCE DETECTADO*",
            "",
            `👤 *Remitente:* ${mention}`,
            `📱 *Número:* ${
                phone.number ||
                "No disponible"
            }`,
            `🌎 *País:* ${
                phone.country ||
                "Desconocido"
            } ${phone.flag || "🌐"}`,
            "",
            `📦 *Tipo:* ${type}`,
            `Lo cito: ${mention}`
        ]

        const text =
            lines.join("\n")


        /*
         * ====================================================
         * 13. MANDAR FICHA
         * ====================================================
         *
         * NO mandamos el contenido del ViewOnce.
         *
         * Solo la información.
         */

        for (
            const target of getNotifyTargets()
        ) {

            try {

                const sent =
                    await conn.sendMessage(
                        target,
                        {
                            text,
                            mentions:
                                sender
                                    ? [sender]
                                    : []
                        },
                        {
                            quoted:
                                getQuoteMessage(
                                    m,
                                    event
                                )
                        }
                    )


                /*
                 * ==================================================
                 * GUARDAR EL MENSAJE DEL BOT
                 * ==================================================
                 *
                 * Si alguien responde a ESTE mensaje,
                 * podremos saber que está respondiendo
                 * al ViewOnce detectado.
                 */

                const botMessageId =
                    sent?.key?.id

                if (
                    botMessageId
                ) {

                    rememberBotNotice(
                        conn,
                        target,
                        botMessageId,
                        {
                            originalId,
                            originalSender:
                                sender,
                            originalName:
                                name,
                            originalPhone:
                                phone,
                            type,
                            sourceChat:
                                m.chat,
                            created:
                                Date.now()
                        }
                    )
                }

            } catch (e) {

                console.error(
                    "[AUTOVIEW] Error enviando ficha:",
                    e?.stack ||
                    e?.message ||
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
 * DETECTOR VIEW ONCE
 * ============================================================
 */

function detectViewOnce(m) {

    /*
     * ========================================================
     * MÉTODO 1
     *
     * m.vM
     *
     * Esta es una de las rutas más importantes para tu bot.
     * simple.js conserva referencias del mensaje original.
     * ========================================================
     */

    const rawCandidates = [
        m?.vM,
        m?.fakeObj,
        m?.message,
        m?.msg
    ]

    for (
        const raw of rawCandidates
    ) {

        const found =
            inspectRawMessage(
                raw
            )

        if (found) {

            return {
                ...found,
                place:
                    "automático",
                id:
                    getMessageId(
                        m,
                        raw
                    ),
                sender:
                    getRawSender(
                        m,
                        raw
                    ),
                serialized:
                    m,
                rawMessage:
                    raw,
                quoted:
                    null
            }
        }
    }


    /*
     * ========================================================
     * MÉTODO 2
     *
     * key.isViewOnce
     * ========================================================
     */

    if (
        m?.key?.isViewOnce
    ) {

        const raw =
            m?.vM ||
            m?.fakeObj ||
            m?.message ||
            m?.msg

        return {
            wrapper:
                "key.isViewOnce",
            mediaType:
                detectMediaType(
                    unwrap(
                        raw
                    )
                ),
            place:
                "automático",
            id:
                getMessageId(
                    m,
                    raw
                ),
            sender:
                getRawSender(
                    m,
                    raw
                ),
            serialized:
                m,
            rawMessage:
                raw,
            quoted:
                null
        }
    }


    /*
     * ========================================================
     * MÉTODO 3
     *
     * m.mtype
     * ========================================================
     *
     * En ciertos serializadores:
     *
     * m.mtype =
     * viewOnceMessageV2
     */

    const mtype =
        String(
            m?.mtype ||
            ""
        )

    if (
        mtype ===
            "viewOnceMessage" ||
        mtype ===
            "viewOnceMessageV2" ||
        mtype ===
            "viewOnceMessageV2Extension"
    ) {

        const raw =
            m?.message ||
            m?.msg

        const found =
            inspectRawMessage(
                raw
            )

        return {
            ...(found || {}),
            wrapper:
                mtype,
            mediaType:
                found?.mediaType ||
                detectMediaType(
                    unwrap(
                        raw
                    )
                ),
            place:
                "automático",
            id:
                m?.id ||
                m?.key?.id ||
                "",
            sender:
                m?.sender ||
                m?.key?.participant ||
                "",
            serialized:
                m,
            rawMessage:
                raw,
            quoted:
                null
        }
    }


    /*
     * ========================================================
     * MÉTODO 4
     *
     * CITADO
     * ========================================================
     */

    const q =
        m?.quoted

    if (q) {

        /*
         * Ruta principal de ver.js
         */

        if (
            q?.viewOnce
        ) {

            return {
                wrapper:
                    "quoted.viewOnce",
                mediaType:
                    normalizeType(
                        q?.mtype ||
                        q?.mediaType ||
                        detectMediaType(
                            q?.message
                        )
                    ),
                place:
                    "citado",
                id:
                    q?.id ||
                    "",
                sender:
                    q?.sender ||
                    q?.participant ||
                    "",
                serialized:
                    m,
                rawMessage:
                    q?.message ||
                    q?.msg ||
                    null,
                quoted:
                    q
            }
        }


        /*
         * m.quoted.vM
         */

        const quotedRaw =
            q?.vM ||
            q?.fakeObj ||
            q?.message ||
            null

        const quotedFound =
            inspectRawMessage(
                quotedRaw
            )

        if (
            quotedFound
        ) {

            return {
                ...quotedFound,
                place:
                    "citado",
                id:
                    q?.id ||
                    q?.key?.id ||
                    "",
                sender:
                    q?.sender ||
                    q?.participant ||
                    "",
                serialized:
                    m,
                rawMessage:
                    quotedRaw,
                quoted:
                    q
            }
        }


        /*
         * m.quoted.msg
         */

        if (
            q?.msg &&
            isViewOnceNode(
                q.msg
            )
        ) {

            return {
                wrapper:
                    "quoted.msg",
                mediaType:
                    normalizeType(
                        q?.mtype
                    ),
                place:
                    "citado",
                id:
                    q?.id ||
                    "",
                sender:
                    q?.sender ||
                    "",
                serialized:
                    m,
                rawMessage:
                    {
                        [q.mtype]:
                            q.msg
                    },
                quoted:
                    q
            }
        }
    }


    /*
     * ========================================================
     * MÉTODO 5
     *
     * contextInfo.quotedMessage
     * ========================================================
     */

    const context =
        getContextInfo(
            m
        )

    if (
        context?.quotedMessage
    ) {

        const found =
            inspectRawMessage(
                context.quotedMessage
            )

        if (
            found
        ) {

            return {
                ...found,
                place:
                    "citado",
                id:
                    context?.stanzaId ||
                    "",
                sender:
                    context?.participant ||
                    m?.sender ||
                    "",
                serialized:
                    m,
                rawMessage:
                    context.quotedMessage,
                quoted:
                    q || null
            }
        }
    }

    return null
}


/*
 * ============================================================
 * INSPECCIÓN RAW
 * ============================================================
 */

function inspectRawMessage(
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
     * ViewOnce wrappers.
     */

    for (
        const wrapper of [
            "viewOnceMessage",
            "viewOnceMessageV2",
            "viewOnceMessageV2Extension"
        ]
    ) {

        const inner =
            message?.[wrapper]
                ?.message

        if (
            inner
        ) {

            return {
                wrapper,
                mediaType:
                    detectMediaType(
                        unwrap(
                            inner
                        )
                    ),
                innerMessage:
                    unwrap(
                        inner
                    )
            }
        }
    }


    /*
     * Multimedia marcada como ViewOnce.
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
                node.viewOnce ===
                    true ||
                node.isViewOnce ===
                    true
            )
        ) {

            return {
                wrapper:
                    `${type}.viewOnce`,
                mediaType:
                    type,
                innerMessage:
                    message
            }
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
            "futureproofMessage",
            "associatedChildMessage"
        ]
    ) {

        const inner =
            message?.[wrapper]
                ?.message

        if (
            inner
        ) {

            const found =
                inspectRawMessage(
                    inner,
                    depth + 1
                )

            if (
                found
            ) {
                return found
            }
        }
    }


    return null
}


/*
 * ============================================================
 * UNWRAP
 * ============================================================
 */

function unwrap(
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
 * TIPO
 * ============================================================
 */

function detectMediaType(
    message
) {

    if (
        !message ||
        typeof message !==
            "object"
    ) {
        return ""
    }

    const clean =
        unwrap(
            message
        )

    if (
        !clean
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
            clean?.[type]
        ) {
            return type
        }
    }

    return ""
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
 * TIPO PARA MOSTRAR
 * ============================================================
 */

function getDisplayType(
    event
) {

    const type =
        normalizeType(
            event?.mediaType
        )

    if (
        type ===
            "imageMessage"
    ) {
        return event.place ===
            "citado"
            ? "citado"
            : "automático"
    }

    if (
        type ===
            "videoMessage"
    ) {
        return event.place ===
            "citado"
            ? "citado"
            : "automático"
    }

    if (
        type ===
            "audioMessage"
    ) {
        return event.place ===
            "citado"
            ? "citado"
            : "automático"
    }

    if (
        type ===
            "documentMessage"
    ) {
        return event.place ===
            "citado"
            ? "citado"
            : "automático"
    }

    return event.place ===
        "citado"
        ? "citado"
        : "automático"
}


/*
 * ============================================================
 * OBTENER ID
 * ============================================================
 */

function getMessageId(
    m,
    raw
) {

    return (
        m?.key?.id ||
        m?.id ||
        raw?.key?.id ||
        ""
    )
}


function getOriginalId(
    event,
    m
) {

    return (
        event?.id ||
        event?.quoted?.id ||
        event?.quoted?.key?.id ||
        m?.key?.id ||
        m?.id ||
        ""
    )
}


/*
 * ============================================================
 * OBTENER REMITENTE
 * ============================================================
 */

function getRawSender(
    m,
    raw
) {

    return (
        raw?.key?.participant ||
        raw?.participant ||
        m?.sender ||
        m?.key?.participant ||
        ""
    )
}


async function getOriginalSender(
    conn,
    m,
    event
) {

    const possible = [
        event?.sender,
        event?.rawMessage
            ?.key
            ?.participant,
        event?.rawMessage
            ?.participant,
        event?.quoted
            ?.sender,
        event?.quoted
            ?.participant,
        m?.sender,
        m?.key?.participant
    ].filter(
        Boolean
    )


    /*
     * En grupos intentamos resolver
     * contra los participantes.
     */

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
            possible
        ) {

            const found =
                participants.find(
                    p =>
                        p?.id ===
                            candidate ||
                        p?.jid ===
                            candidate ||
                        p?.lid ===
                            candidate ||
                        p?.phoneNumber ===
                            candidate
                )

            if (
                found
            ) {

                return (
                    found.phoneNumber ||
                    found.jid ||
                    found.id ||
                    candidate
                )
            }
        }

    } catch {}


    return (
        possible[0] ||
        ""
    )
}


/*
 * ============================================================
 * TELÉFONO
 * ============================================================
 */

async function getPhoneInfo(
    conn,
    chat,
    sender
) {

    try {

        if (
            !sender
        ) {

            return {
                number:
                    "",
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
            participant?.phoneNumber ||
            participant?.jid ||
            participant?.id ||
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
                number:
                    "",
                country:
                    "Desconocido",
                flag:
                    "🌐"
            }
        }


        const pn =
            new PhoneNumber(
                "+" +
                number
            )


        const region =
            pn.getRegionCode() ||
            ""


        return {
            number:
                "+" +
                number,
            country:
                getCountryName(
                    region
                ),
            flag:
                getFlagEmoji(
                    region
                )
        }

    } catch {

        return {
            number:
                "",
            country:
                "Desconocido",
            flag:
                "🌐"
        }
    }
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
            typeof conn.getName ===
                "function"
        ) {

            return (
                await conn.getName(
                    jid
                )
            ) ||
            jid
        }

    } catch {}

    return jid
}


/*
 * ============================================================
 * PAÍS
 * ============================================================
 */

function getCountryName(
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
 * MENCIÓN
 * ============================================================
 */

function makeMention(
    jid
) {

    if (
        !jid
    ) {
        return "@desconocido"
    }

    const number =
        String(
            jid
        )
            .split("@")[0]
            .split(":")[0]
            .replace(
                /\D/g,
                ""
            )

    return (
        "@" +
        (
            number ||
            "desconocido"
        )
    )
}


/*
 * ============================================================
 * CITAR MENSAJE ORIGINAL
 * ============================================================
 *
 * Para automático intentamos citar el mensaje original
 * usando la referencia disponible.
 *
 * Si no existe una referencia válida, simplemente
 * mandamos la ficha sin quote.
 */

function getQuoteMessage(
    m,
    event
) {

    if (
        event?.place ===
            "citado"
    ) {

        if (
            event?.quoted
        ) {
            return event.quoted
        }
    }

    if (
        event?.serialized
    ) {

        return event.serialized
    }

    return m
}


/*
 * ============================================================
 * DETECTAR COMANDO
 * ============================================================
 */

function isCommandMessage(
    m,
    cmd,
    prefijo
) {

    const text =
        String(
            m?.text ||
            m?.body ||
            ""
        ).trim()

    if (
        !text
    ) {
        return false
    }

    if (
        !prefijo
    ) {
        return false
    }

    const prefix =
        String(
            prefijo
        )

    if (
        !text.startsWith(
            prefix
        )
    ) {
        return false
    }

    return Boolean(
        cmd
    )
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


    const messages = [
        m?.message,
        m?.vM?.message,
        m?.fakeObj?.message
    ]


    for (
        const message of
        messages
    ) {

        const found =
            findContextInfo(
                message
            )

        if (
            found
        ) {
            return found
        }
    }


    return null
}


function findContextInfo(
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

            return (
                message[type]
                    .contextInfo
            )
        }
    }


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
            message?.[wrapper]
                ?.message

        if (
            inner
        ) {

            const found =
                findContextInfo(
                    inner,
                    depth + 1
                )

            if (
                found
            ) {
                return found
            }
        }
    }


    return null
}


/*
 * ============================================================
 * MENSAJES DEL BOT
 * ============================================================
 *
 * Aquí guardamos los IDs de las fichas enviadas.
 *
 * Cuando alguien responde a una de ellas:
 *
 * m.quoted.id === botMessageId
 *
 * y podemos saber exactamente a qué ViewOnce
 * corresponde.
 */

function rememberBotNotice(
    conn,
    chat,
    messageId,
    data
) {

    const map =
        conn._autoViewNotices ||
        (
            conn._autoViewNotices =
                new Map()
        )


    cleanupBotNotices(
        map
    )


    map.set(
        `${chat}:${messageId}`,
        {
            ...data,
            chat,
            messageId,
            at:
                Date.now()
        }
    )


    while (
        map.size >
        RESPONSE_LIMIT
    ) {

        const first =
            map.keys()
                .next()
                .value

        if (
            first
        ) {
            map.delete(
                first
            )
        } else {
            break
        }
    }
}


function getBotNotice(
    conn,
    chat,
    messageId
) {

    const map =
        conn._autoViewNotices

    if (
        !map
    ) {
        return null
    }


    cleanupBotNotices(
        map
    )


    return (
        map.get(
            `${chat}:${messageId}`
        ) ||
        null
    )
}


function cleanupBotNotices(
    map
) {

    const now =
        Date.now()


    for (
        const [
            key,
            value
        ] of map
    ) {

        if (
            now -
            value.at >
            RESPONSE_TTL
        ) {

            map.delete(
                key
            )
        }
    }
}


/*
 * ============================================================
 * PROCESAR RESPUESTAS A LA FICHA
 * ============================================================
 */

async function processBotResponse(
    m,
    conn
) {

    try {

        /*
         * No puede ser el mismo mensaje del bot.
         */

        if (
            m?.key?.fromMe ||
            m?.fromMe
        ) {
            return false
        }


        /*
         * Necesitamos una cita.
         */

        const quotedId =
            m?.quoted?.id ||
            m?.msg
                ?.contextInfo
                ?.stanzaId ||
            getContextInfo(
                m
            )?.stanzaId ||
            ""


        if (
            !quotedId
        ) {
            return false
        }


        /*
         * Buscar la ficha que mandó el bot.
         */

        const notice =
            getBotNotice(
                conn,
                m.chat,
                quotedId
            )


        if (
            !notice
        ) {
            return false
        }


        /*
         * ====================================================
         * TEXTO DE LA RESPUESTA
         * ====================================================
         */

        const responseText =
            getMessageText(
                m
            )


        /*
         * Si respondió con algo que no tiene texto,
         * igualmente informamos del mensaje.
         */

        const sender =
            m?.sender ||
            m?.key?.participant ||
            ""


        const phone =
            await getPhoneInfo(
                conn,
                m.chat,
                sender
            )


        const mention =
            makeMention(
                sender
            )


        /*
         * ====================================================
         * INFORMACIÓN DE LA RESPUESTA
         * ====================================================
         */

        const text = [
            "💬 *RESPUESTA AL VIEW ONCE*",
            "",
            `👤 *Usuario:* ${mention}`,
            `📱 *Número:* ${
                phone.number ||
                "No disponible"
            }`,
            `🌎 *País:* ${
                phone.country ||
                "Desconocido"
            } ${phone.flag || "🌐"}`,
            "",
            `💬 *Respuesta:* ${
                responseText ||
                "Mensaje multimedia"
            }`
        ].join("\n")


        /*
         * ====================================================
         * ENVIAR RESPUESTA CITANDO LA FICHA DEL BOT
         * ====================================================
         */

        const targets =
            getNotifyTargets()


        for (
            const target of targets
        ) {

            /*
             * Solo queremos procesar respuestas
             * dentro del grupo donde está la ficha.
             */

            if (
                target !==
                m.chat
            ) {
                continue
            }


            try {

                await conn.sendMessage(
                    target,
                    {
                        text,
                        mentions:
                            sender
                                ? [sender]
                                : []
                    },
                    {
                        quoted:
                            m?.quoted ||
                            null
                    }
                )

            } catch (e) {

                console.error(
                    "[AUTOVIEW] Error enviando respuesta:",
                    e?.stack ||
                    e?.message ||
                    e
                )
            }
        }


        /*
         * Si el grupo donde se respondió no es
         * el grupo de avisos, enviamos al grupo
         * de avisos citando la ficha original.
         */

        if (
            !targets.includes(
                m.chat
            )
        ) {

            for (
                const target of targets
            ) {

                try {

                    const originalNotice =
                        await getStoredNoticeMessage(
                            conn,
                            target,
                            notice.messageId
                        )

                    await conn.sendMessage(
                        target,
                        {
                            text,
                            mentions:
                                sender
                                    ? [sender]
                                    : []
                        },
                        {
                            quoted:
                                originalNotice ||
                                undefined
                        }
                    )

                } catch (e) {

                    console.error(
                        "[AUTOVIEW] Error enviando respuesta externa:",
                        e?.message ||
                        e
                    )
                }
            }
        }


        return true

    } catch (e) {

        console.error(
            "[AUTOVIEW] processBotResponse:",
            e?.stack ||
            e?.message ||
            e
        )

        return false
    }
}


/*
 * ============================================================
 * TEXTO DEL MENSAJE
 * ============================================================
 */

function getMessageText(
    m
) {

    return (
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
        m?.message
            ?.documentMessage
            ?.caption ||
        ""
    ).trim()
}


/*
 * ============================================================
 * MENSAJE GUARDADO
 * ============================================================
 *
 * Si el bot responde en otro grupo, intentamos
 * recuperar la ficha original del store.
 *
 * No todos los bots tienen store disponible,
 * por eso esto es solo respaldo.
 */

async function getStoredNoticeMessage(
    conn,
    target,
    messageId
) {

    try {

        if (
            typeof conn?.loadMessage ===
                "function"
        ) {

            return await conn.loadMessage(
                target,
                messageId
            )
        }

    } catch {}

    return null
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

    const map =
        conn._autoViewSeen ||
        (
            conn._autoViewSeen =
                new Map()
        )


    const now =
        Date.now()


    for (
        const [
            id,
            time
        ] of map
    ) {

        if (
            now -
            time >
            SEEN_TTL
        ) {

            map.delete(
                id
            )
        }
    }


    if (
        map.has(
            key
        )
    ) {
        return true
    }


    map.set(
        key,
        now
    )


    while (
        map.size >
        SEEN_LIMIT
    ) {

        const first =
            map.keys()
                .next()
                .value

        if (
            first
        ) {
            map.delete(
                first
            )
        } else {
            break
        }
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
 * UTILIDADES
 * ============================================================
 */

function isViewOnceNode(
    node
) {

    if (
        !node ||
        typeof node !==
            "object"
    ) {
        return false
    }

    return Boolean(
        node.viewOnce ===
            true ||
        node.isViewOnce ===
            true
    )
}


function makeMention(
    jid
) {

    if (
        !jid
    ) {
        return "@desconocido"
    }

    const number =
        String(
            jid
        )
            .split("@")[0]
            .split(":")[0]
            .replace(
                /\D/g,
                ""
            )

    return (
        "@" +
        (
            number ||
            "desconocido"
        )
    )
}
