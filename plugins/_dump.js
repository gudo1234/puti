let handler = async (m, { conn }) => {

    const {
        getContentType,
        normalizeMessageContent,
        extractMessageContent
    } = await import('@whiskeysockets/baileys')

    function getRawQuoted(q) {
        if (!q) return null

        const candidates = [
            q.raw,
            q.message,
            q.msg,
            q
        ]

        for (const candidate of candidates) {
            if (!candidate || typeof candidate !== 'object') continue

            if (
                candidate.key ||
                candidate.message ||
                candidate.messageTimestamp ||
                candidate.pushName ||
                candidate.participant ||
                candidate.status
            ) {
                return candidate
            }
        }

        return q
    }

    function unwrapMessage(message) {
        if (!message) return {}

        let current = message

        for (let i = 0; i < 15; i++) {

            if (!current || typeof current !== 'object') {
                return {}
            }

            const type = getContentType(current)

            if (!type) {
                const extracted = extractMessageContent(current)

                if (
                    extracted &&
                    extracted !== current
                ) {
                    current = extracted
                    continue
                }

                break
            }

            if (
                type === 'ephemeralMessage' ||
                type === 'viewOnceMessage' ||
                type === 'viewOnceMessageV2' ||
                type === 'viewOnceMessageV2Extension' ||
                type === 'documentWithCaptionMessage'
            ) {
                const inner =
                    current[type]?.message

                if (inner) {
                    current = inner
                    continue
                }
            }

            break
        }

        return current || {}
    }

    function getAssociation(message) {
        const content =
            unwrapMessage(
                message?.message || message
            )

        return (
            content?.messageContextInfo?.messageAssociation ||
            content?.imageMessage?.contextInfo?.messageAssociation ||
            content?.videoMessage?.contextInfo?.messageAssociation ||
            content?.pollCreationOptionImageMessage?.messageContextInfo?.messageAssociation ||
            null
        )
    }

    function cleanPOJO(obj, seen = new WeakSet()) {

        if (
            obj === null ||
            obj === undefined
        ) {
            return obj
        }

        if (
            Buffer.isBuffer(obj) ||
            obj instanceof Uint8Array
        ) {
            return `__BUFFER_START__${Buffer.from(obj).toString('base64')}__BUFFER_END__`
        }

        if (
            obj?.type === 'Buffer' &&
            Array.isArray(obj?.data)
        ) {
            return `__BUFFER_START__${Buffer.from(obj.data).toString('base64')}__BUFFER_END__`
        }

        if (typeof obj === 'bigint') {
            return obj.toString()
        }

        if (Array.isArray(obj)) {
            return obj.map(x =>
                cleanPOJO(x, seen)
            )
        }

        if (typeof obj === 'object') {

            if (seen.has(obj)) {
                return '[Circular]'
            }

            seen.add(obj)

            if (
                typeof obj.toNumber === 'function' ||
                (
                    obj.low !== undefined &&
                    obj.high !== undefined
                )
            ) {
                return obj.toString()
            }

            const result = {}

            for (const key of Object.keys(obj)) {

                if (
                    key === 'toJSON' ||
                    key === 'constructor' ||
                    typeof obj[key] === 'function'
                ) {
                    continue
                }

                try {
                    result[key] =
                        cleanPOJO(
                            obj[key],
                            seen
                        )
                } catch {}
            }

            return result
        }

        return obj
    }

    function formatCode(obj) {

        let json =
            JSON.stringify(
                cleanPOJO(obj),
                null,
                2
            )

        json =
            json.replace(
                /"__BUFFER_START__(.*?)__BUFFER_END__"/g,
                'Buffer.from("$1", "base64")'
            )

        return json
    }

    function detectNodes(content) {

        const raw =
            JSON.stringify(content)

        const nodes = []

        if (
            raw.includes('"pollCreationOptionImageMessage"')
        ) {
            nodes.push({
                tag: 'meta',
                attrs: {
                    message_association_type:
                        'media_poll'
                }
            })
        }

        if (
            raw.includes('"pollCreationMessage"') ||
            raw.includes('"pollCreationMessageV3"') ||
            raw.includes('"pollCreationMessageV4"') ||
            raw.includes('"pollCreationMessageV5"')
        ) {

            const imagePoll =
                raw.includes('"pollContentType":2') ||
                raw.includes('"pollContentType": 2')

            nodes.push({
                tag: 'meta',
                attrs: {
                    polltype: 'creation',
                    ...(imagePoll
                        ? {
                            contenttype: 'image'
                        }
                        : {})
                }
            })
        }

        if (
            raw.includes('"botAIMessage"') ||
            raw.includes('"aiChatMessage"') ||
            raw.includes('"forwardedAiBotMessageInfo"')
        ) {
            nodes.push(
                {
                    tag: 'bot',
                    attrs: {
                        biz_bot: '1'
                    }
                },
                {
                    tag: 'biz',
                    attrs: {}
                }
            )
        }

        if (
            raw.includes('"interactiveMessage"') ||
            raw.includes('"buttonsMessage"') ||
            raw.includes('"nativeFlowMessage"')
        ) {

            if (raw.includes('"catalog_message"')) {

                nodes.push({
                    tag: 'biz',
                    attrs: {
                        native_flow_name:
                            'catalog_message'
                    }
                })

            } else if (raw.includes('"order_details"')) {

                nodes.push({
                    tag: 'biz',
                    attrs: {
                        native_flow_name:
                            'order_details'
                    }
                })

            } else if (raw.includes('"payment_key_info"')) {

                nodes.push({
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: {
                                type: 'native_flow',
                                v: '1'
                            },
                            content: [
                                {
                                    tag: 'native_flow',
                                    attrs: {
                                        name:
                                            'payment_key_info'
                                    }
                                }
                            ]
                        }
                    ]
                })

            } else {

                nodes.push({
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: {
                                type: 'native_flow',
                                v: '1'
                            },
                            content: [
                                {
                                    tag: 'native_flow',
                                    attrs: {
                                        v: '9',
                                        name: 'mixed'
                                    }
                                }
                            ]
                        }
                    ]
                })
            }
        }

        return nodes.length
            ? {
                additionalNodes: nodes
            }
            : {}
    }

    if (!m.quoted) {
        return m.reply(
            'ⓘ Responde al mensaje que deseas destripar.'
        )
    }

    await m.react('wait')

    try {

        /*
         * ============================================================
         * OBTENER EL MENSAJE REAL
         * ============================================================
         */

        let rawQuoted =
            getRawQuoted(m.quoted)

        /*
         * Si el wrapper del bot no entregó el mensaje completo,
         * intentamos localizarlo mediante el store de Baileys.
         */

        if (
            !rawQuoted?.message &&
            m.quoted?.id &&
            conn.store?.loadMessages
        ) {

            try {

                const loaded =
                    await conn.store.loadMessages(
                        m.chat,
                        20,
                        m.quoted.id
                    )

                if (Array.isArray(loaded)) {

                    const found =
                        loaded.find(
                            x =>
                                x?.key?.id ===
                                m.quoted.id
                        )

                    if (found) {
                        rawQuoted = found
                    }
                }

            } catch (e) {

                console.log(
                    '[DUMP] store.loadMessages:',
                    e.message
                )
            }
        }

        /*
         * ============================================================
         * DEBUG
         * ============================================================
         */

        console.log(
            '[DUMP] quoted keys:',
            Object.keys(m.quoted || {})
        )

        console.log(
            '[DUMP] raw keys:',
            Object.keys(rawQuoted || {})
        )

        console.log(
            '[DUMP] message keys:',
            Object.keys(
                rawQuoted?.message || {}
            )
        )

        /*
         * ============================================================
         * VALIDAR
         * ============================================================
         */

        if (
            !rawQuoted?.message ||
            !Object.keys(rawQuoted.message).length
        ) {

            throw new Error(
                'Baileys no entregó el contenido raw del mensaje citado. ' +
                'El wrapper de m.quoted está ocultando el mensaje original.'
            )
        }

        /*
         * ============================================================
         * NORMALIZAR CON BAILEYS
         * ============================================================
         */

        const originalMessage =
            rawQuoted.message

        let normalized

        try {

            normalized =
                normalizeMessageContent(
                    originalMessage
                )

        } catch {

            normalized =
                originalMessage
        }

        /*
         * ============================================================
         * EXTRAER CONTENIDO
         * ============================================================
         */

        let content =
            extractMessageContent(
                normalized
            ) || normalized

        /*
         * ============================================================
         * TIPO
         * ============================================================
         */

        const type =
            getContentType(
                normalized
            ) ||
            Object.keys(content || {})[0] ||
            'unknown'

        /*
         * ============================================================
         * ASSOCIATION
         * ============================================================
         */

        const association =
            getAssociation(
                rawQuoted
            )

        const parentId =
            association?.parentMessageKey?.id ||
            rawQuoted?.key?.id ||
            m.quoted.id ||
            'unknown'

        /*
         * ============================================================
         * NODOS
         * ============================================================
         */

        const additionalNodes =
            detectNodes(
                content
            )

        /*
         * ============================================================
         * GENERAR CÓDIGO
         * ============================================================
         */

        const payload =
            formatCode(
                content
            )

        const js =
`// Aethero Engine - Packet Dump
// Tipo      : ${type}
// Emisor    : ${rawQuoted?.key?.participant || rawQuoted?.key?.remoteJid || m.quoted.sender || 'Desconocido'}
// ID        : ${rawQuoted?.key?.id || m.quoted.id || 'unknown'}
// Parent ID : ${parentId}
// Timestamp : ${new Date().toLocaleString('es-ES', {
    timeZone: 'America/Tegucigalpa'
})}

// Contenido extraído mediante @whiskeysockets/baileys

await conn.relayMessage(
  m.chat,
  ${payload},
  ${JSON.stringify(additionalNodes, null, 2)}
)
`

        /*
         * ============================================================
         * ENVIAR ARCHIVO
         * ============================================================
         */

        const file =
            Buffer.from(
                js,
                'utf8'
            )

        const fileName =
            `dump_${type}_${Date.now()}.js`

        await conn.sendMessage(
            m.chat,
            {
                document: file,
                mimetype:
                    'application/javascript',
                fileName,

                caption:
                    `╭─〔 DUMP 〕\n` +
                    `│ Tipo: ${type}\n` +
                    `│ ID: ${rawQuoted?.key?.id || m.quoted.id}\n` +
                    `│ Parent: ${parentId}\n` +
                    `│ Archivo: ${fileName}\n` +
                    `╰────────────`
            },
            {
                quoted: m
            }
        )

        await m.react('done')

    } catch (e) {

        console.error(
            '[DUMP ERROR]',
            e
        )

        await m.react('error')

        await m.reply(
            `ⓘ Error al extraer paquete:\n\n${e.message}`
        )
    }
}

handler.command = [
    'dump',
    'json',
    'crm'
]

export default handler
