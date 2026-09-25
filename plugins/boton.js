let handler = async (m, { conn }) => {
  const baileys = await import('@whiskeysockets/baileys')

  const participants = global.db?.data?.chats?.[m.chat]?.participants || []
  const subject = conn.chats?.[m.chat]?.subject || 'Grupo'

  const icon = typeof icono === 'function' ? icono() : icono

  const response = await fetch(icon)

  if (!response.ok) {
    throw new Error(`No se pudo descargar el icono: ${response.status}`)
  }

  const jpegThumbnail = Buffer.from(await response.arrayBuffer())

  const msg = baileys.generateWAMessageFromContent(m.chat, {
    buttonsMessage: {
      locationMessage: {
        degreesLatitude: 0,
        degreesLongitude: 0,
        name: 'Hola',
        address: global.botname || 'Bot',
        jpegThumbnail
      },
      contextInfo: {
        mentionedJid: participants.map(v => v.phoneNumber ?? v.id)
      },
      contentText: subject,
      footerText: 'Test',
      buttons: [
        {
          buttonId: '~',
          buttonText: {
            displayText: '≣ Menu'
          },
          type: 1,
          nativeFlowInfo: {
            name: 'single_select',
            paramsJson: JSON.stringify({
              title: 'test',
              sections: [
                {
                  title: 'Sections',
                  highlight_label: 'Top',
                  rows: [
                    {
                      title: 'Menu.',
                      id: '.menu'
                    }
                  ]
                }
              ]
            })
          }
        },
        {
          buttonId: '.i',
          buttonText: {
            displayText: '⊳ Infobot'
          },
          type: 1
        }
      ],
      headerType: 6
    }
  }, {})

  await conn.relayMessage(m.chat, msg.message, {
    additionalNodes: (await import('../lib/simple.js')).ButtonsType(msg)
  })
}

handler.help = ['testbutton']
handler.tags = ['owner']
handler.command = ['testbutton']
handler.group = true

export default handler
