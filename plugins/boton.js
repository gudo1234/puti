let handler = async (m, { conn }) => {
  const baileys = await import('@whiskeysockets/baileys')

  const participants = global.db?.data?.chats?.[m.chat]?.participants || []

  const subject = conn.chats?.[m.chat]?.subject || 'Grupo'

  const msg = baileys.generateWAMessageFromContent(m.chat, {
    buttonsMessage: {
      locationMessage: {
        degreesLatitude: 0,
        degreesLongitude: 0,
        name: 'Hola',
        address: global.botname || 'Bot',
        jpegThumbnail: await Func.createThumb(
          'https://i.ibb.co/hJ2gNRzP/IMG-20260630-WA0100.jpg'
        )
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
