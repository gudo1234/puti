import fetch from 'node-fetch'
import sharp from 'sharp'
import { generateWAMessageFromContent } from '@whiskeysockets/baileys'

let handler = async (m, { conn }) => {

  let thumb = null

  try {
    const res = await fetch(icono)

    if (res.ok) {
      const buff = Buffer.from(await res.arrayBuffer())

      thumb = await sharp(buff)
        .resize(300, 300, {
          fit: 'cover'
        })
        .jpeg({
          quality: 80
        })
        .toBuffer()
    }
  } catch (e) {
    console.error('❌ Error preparando icono:', e)
  }

  const msg = generateWAMessageFromContent(
    m.chat,
    {
      buttonsMessage: {
        locationMessage: {
          degreesLatitude: 0,
          degreesLongitude: 0,
          name: 'Hola',
          address: global.botname || 'Bot',
          ...(thumb ? { jpegThumbnail: thumb } : {})
        },

        contextInfo: {
          mentionedJid: []
        },

        contentText:
          conn.chats?.[m.chat]?.subject ||
          'Grupo',

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
    },
    {
      userJid: conn.user.id,
      quoted: m
    }
  )

  /*
   * ENVIAR
   */

  await conn.relayMessage(
    m.chat,
    msg.message,
    {
      messageId: msg.key.id
    }
  )
}

handler.help = ['testbutton']
handler.tags = ['owner']
handler.command = ['testbutton']
handler.group = true

export default handler
