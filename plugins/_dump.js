let handler = async (m, { conn }) => {

    function unwrapMessage(msg) {
        let current = msg || {}

        while (
            current.ephemeralMessage ||
            current.viewOnceMessage ||
            current.viewOnceMessageV2 ||
            current.viewOnceMessageV2Extension ||
            current.documentWithCaptionMessage ||
            current.editedMessage ||
            (current.pollCreationMessageV4 && current.pollCreationMessageV4.message) ||
            (current.pollCreationMessageV5 && current.pollCreationMessageV5.message)
        ) {
            if (current.ephemeralMessage) {
                current = current.ephemeralMessage.message || {}
            } else if (current.viewOnceMessage) {
                current = current.viewOnceMessage.message || {}
            } else if (current.viewOnceMessageV2) {
                current = current.viewOnceMessageV2.message || {}
            } else if (current.viewOnceMessageV2Extension) {
                current = current.viewOnceMessageV2Extension.message || {}
            } else if (current.documentWithCaptionMessage) {
                current = current.documentWithCaptionMessage.message || {}
            } else if (current.editedMessage) {
                current =
                    current.editedMessage.message?.protocolMessage?.editedMessage || {}
            } else if (current.pollCreationMessageV4?.message) {
                current = current.pollCreationMessageV4.message
            } else if (current.pollCreationMessageV5?.message) {
                current = current.pollCreationMessageV5.message
            }
        }

        return current
    }

    function getMessageAssociation(rawMsg) {
        const msg = rawMsg?.message || rawMsg || {}
        const unwrapped = unwrapMessage(msg)

        return (
            msg.messageContextInfo?.messageAssociation ||
            msg.ephemeralMessage?.message?.messageContextInfo?.messageAssociation ||
            unwrapped.messageContextInfo?.messageAssociation ||
            unwrapped.imageMessage?.contextInfo?.messageAssociation ||
            unwrapped.videoMessage?.contextInfo?.messageAssociation ||
            unwrapped.pollCreationOptionImageMessage?.messageContextInfo?.messageAssociation ||
            null
        )
    }

    function detectAdditionalNodes(obj) {
        const rawJson =
            typeof obj === 'string'
                ? obj
                : JSON.stringify(obj)

        const has = (s) => rawJson.includes(s)

        if (
            has('"pollCreationOptionImageMessage"') ||
            has('"media_poll"')
        ) {
            return {
                additionalNodes: [
                    {
                        tag: 'meta',
                        attrs: {
                            message_association_type: 'media_poll'
                        }
                    }
                ]
            }
        }

        if (
            has('"pollCreationMessage"') ||
            has('"pollCreationMessageV3"') ||
            has('"pollCreationMessageV4"') ||
            has('"pollCreationMessageV5"')
        ) {
            const isImagePoll =
                has('"pollContentType": 2') ||
                has('"pollContentType":2')

            return {
                additionalNodes: [
                    {
                        tag: 'meta',
                        attrs: {
                            polltype: 'creation',
                            ...(isImagePoll
                                ? { contenttype: 'image' }
                                : {})
                        }
                    }
                ]
            }
        }

        if (
            has('"botAIMessage"') ||
            has('"aiChatMessage"') ||
            has('"forwardedAiBotMessageInfo"')
        ) {
            return {
                additionalNodes: [
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
                ]
            }
        }

        if (
            has('"interactiveMessage"') ||
            has('"buttonsMessage"') ||
            has('"nativeFlowMessage"')
        ) {
            if (has('"catalog_message"')) {
                return {
                    additionalNodes: [
                        {
                            tag: 'biz',
                            attrs: {
                                native_flow_name: 'catalog_message'
                            }
                        }
                    ]
                }
            }

            if (has('"order_details"')) {
                return {
                    additionalNodes: [
                        {
                            tag: 'biz',
                            attrs: {
                                native_flow_name: 'order_details'
                            }
                        }
                    ]
                }
            }

            if (has('"payment_key_info"')) {
                return {
                    additionalNodes: [
                        {
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
                                                name: 'payment_key_info'
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }

            return {
                additionalNodes: [
                    {
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
                    }
                ]
            }
        }

        return {}
    }

    function cleanPOJO(obj) {
        if (obj === null || obj === undefined) {
            return obj
        }

        if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
            return `__BUFFER_START__${Buffer.from(obj).toString('base64')}__BUFFER_END__`
        }

        if (
            obj.type === 'Buffer' &&
            Array.isArray(obj.data)
        ) {
            return `__BUFFER_START__${Buffer.from(obj.data).toString('base64')}__BUFFER_END__`
        }

        if (Array.isArray(obj)) {
            return obj.map(cleanPOJO)
        }

        if (typeof obj === 'object') {

            if (
                typeof obj.toNumber === 'function' ||
                (
                    obj.low !== undefined &&
                    obj.high !== undefined
                )
            ) {
                return obj.toString()
            }

            const res = {}

            for (const key of Object.keys(obj)) {

                if (
                    typeof obj[key] === 'function' ||
                    key === 'toJSON' ||
                    key === 'constructor'
                ) {
                    continue
                }

                res[key] = cleanPOJO(obj[key])
            }

            return res
        }

        return obj
    }

    function formatJsonCode(obj) {
        let str = JSON.stringify(
            cleanPOJO(obj),
            null,
            2
        )

        str = str.replace(
            /"__BUFFER_START__(.*?)__BUFFER_END__"/g,
            'Buffer.from("$1", "base64")'
        )

        return str
    }

    if (!m.quoted) {
        return m.reply(
            'ⓘ Cita el mensaje que deseas destripar.'
        )
    }

    await m.react('wait')

    try {

        /*
         * Obtener directamente el mensaje citado.
         * Ya no se utiliza global.db.open()
         */

        const quotedRaw =
            m.quoted.raw ||
            m.quoted

        const quotedId =
            m.quoted.id ||
            quotedRaw?.key?.id ||
            'unknown'

        const association =
            getMessageAssociation(quotedRaw)

        const rootParentId =
            association?.parentMessageKey?.id ||
            quotedId

        let rawParentContent =
            quotedRaw?.message ||
            m.quoted.message ||
            {}

        let parentPayload =
            unwrapMessage(rawParentContent)

        /*
         * Mantener messageContextInfo para polls
         */

        if (parentPayload.pollCreationMessageV3) {

            parentPayload = {
                ...(rawParentContent.messageContextInfo
                    ? {
                        messageContextInfo:
                            rawParentContent.messageContextInfo
                    }
                    : {}),

                pollCreationMessageV3:
                    parentPayload.pollCreationMessageV3
            }
        }

        /*
         * Detectar el tipo principal
         */

        const typeName =
            Object.keys(parentPayload || {})
                .find(key =>
                    ![
                        'messageContextInfo',
                        'senderKeyDistributionMessage'
                    ].includes(key)
                ) ||
            m.quoted.type ||
            'unknown'

        const senderName =
            m.quoted.sender?.name ||
            m.quoted.sender?.number ||
            m.sender ||
            'Desconocido'

        /*
         * Detectar nodos especiales
         */

        const additionalNodes =
            detectAdditionalNodes(parentPayload)

        /*
         * Convertir paquete a código JS
         */

        const packetJson =
            formatJsonCode(parentPayload)

        const jsContent =
`// Aethero Engine - Packet Dump
// Tipo      : ${typeName}
// Emisor    : ${senderName}
// ID        : ${quotedId}
// Parent ID : ${rootParentId}
// Timestamp : ${new Date().toLocaleString('es-ES', {
    timeZone: 'America/Tegucigalpa'
})}

await conn.relayMessage(
  m.chat,
  ${packetJson},
  ${JSON.stringify(additionalNodes, null, 2)}
)
`

        const fileBuffer =
            Buffer.from(
                jsContent,
                'utf-8'
            )

        const fileName =
            `dump_${typeName}_${Date.now()}.js`

        await conn.sendMessage(
            m.chat,
            {
                document: fileBuffer,
                fileName,
                mimetype: 'application/javascript',

                caption:
                    `- *Tipo:* ${typeName}\n` +
                    `- *Emisor:* ${senderName}\n` +
                    `- *ID:* \`${quotedId}\`\n` +
                    `- *Archivo:* \`${fileName}\``
            },
            {
                quoted: m
            }
        )

        await m.react('done')

    } catch (e) {

        console.error(
            'Dump Error:',
            e
        )

        await m.react('error')

        await m.reply(
            `ⓘ Error al extraer paquete: ${e.message}`
        )
    }
}

handler.command = [
    'dump',
    'json',
    'crm'
]

export default handler
