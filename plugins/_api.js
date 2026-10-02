import fs from 'fs'
import { join } from 'path'
import sharp from 'sharp'

let handler = async (m, { conn, __dirname }) => {

  const channel = global.canal || global.redes || ''
  const channelInfo = global.channelRD || {}

  const imgPath = join(
    __dirname,
    '../storage/catalogo.jpg'
  )

  let thumbResized = null
  let profileThumb = null

  // catalogo.jpg: SE MANTIENE para el thumbnail principal
  try {
    if (fs.existsSync(imgPath)) {
      const thumbLocal = fs.readFileSync(imgPath)

      thumbResized = await sharp(thumbLocal)
        .resize(300, 100, {
          fit: 'cover'
        })
        .jpeg()
        .toBuffer()
    }
  } catch (err) {
    console.error(
      '[PI] Error preparando catalogo:',
      err?.message || err
    )
  }

  // Foto de perfil
  try {
    let profileUrl = null

    try {
      profileUrl = await conn.profilePictureUrl(
        m.sender,
        'image'
      )
    } catch {}

    // Si falla la foto de perfil, usar icono
    if (!profileUrl) {
      try {
        profileUrl =
          typeof global.icono === 'function'
            ? await global.icono()
            : global.icono
      } catch {}
    }

    if (profileUrl) {
      try {
        profileThumb = Buffer.from(
          await (
            await fetch(profileUrl)
          ).arrayBuffer()
        )

        profileThumb = await sharp(profileThumb)
          .resize(300, 300, {
            fit: 'cover'
          })
          .jpeg()
          .toBuffer()

      } catch (err) {
        profileThumb = null
      }
    }

  } catch (err) {
    console.error(
      '[PI] Error preparando foto de perfil:',
      err?.message || err
    )
  }

  const newsletterInfo =
    channelInfo?.id
      ? {
          forwardedNewsletterMessageInfo: {
            newsletterJid: channelInfo.id,
            newsletterName: channelInfo.name || '',
            serverMessageId: 1
          }
        }
      : {}

  const interactiveContext = {
    ...newsletterInfo,

    remoteJid: '@broadcast',

    forwardingScore: 10,

    isForwarded: true,

    // Foto de perfil por otra vía
    ...(profileThumb
      ? {
          externalAdReply: {
            title: 'Hola',
            body: 'Perfil',
            mediaType: 1,
            thumbnail: profileThumb,
            renderLargerThumbnail: false,
            showAdAttribution: false
          }
        }
      : {})
  }

  try {

    await conn.relayMessage(
      m.chat,
      {
        messageContextInfo: {
          messageSecret: Buffer.from(
            'ar4VUZVE4OIGvlS57BEfhdwTa5tFSfWA7MEZ+9ZsvNc=',
            'base64'
          )
        },

        interactiveMessage: {

          header: {
            documentMessage: {
              url: 'https://mmg.whatsapp.net/v/t62.7119-24/539012045_745537058346694_1512031191239726227_n.enc',

              mimetype:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

              fileSha256: Buffer.from(
                'fa09afbc207a724252bae1b764ecc7b13060440ba47a3bf59e77f01924924bfe',
                'hex'
              ),

              fileLength: {
                low: -727379969,
                high: 232,
                unsigned: true
              },

              pageCount: 0,

              mediaKey: Buffer.from(
                '3163ba7c8db6dd363c4f48bda2735cc0d0413e57567f0a758f514f282889173c',
                'hex'
              ),

              fileName: 'Hola',

              fileEncSha256: Buffer.from(
                '652f2ff6d8a8dae9f5c9654e386de5c01c623fe98d81a28f63dfb0979a44a22f',
                'hex'
              ),

              directPath:
                '/v/t62.7119-24/539012045_745537058346694_1512031191239726227_n.enc',

              mediaKeyTimestamp: {
                low: 1756370084,
                high: 0,
                unsigned: false
              },

              // SE MANTIENE catalogo.jpg
              ...(thumbResized
                ? {
                    jpegThumbnail: thumbResized
                  }
                : {}),

              contextInfo: interactiveContext
            },

            hasMediaAttachment: true
          },

          body: {
            text: 'Hola'
          },

          footer: {
            text: 'Hola'
          },

          nativeFlowMessage: {
            buttons: [

              {
                name: 'single_select',
                buttonParamsJson:
                  JSON.stringify({
                    has_multiple_buttons: true
                  })
              },

              {
                name: 'call_permission_request',
                buttonParamsJson:
                  JSON.stringify({
                    has_multiple_buttons: true
                  })
              },

              {
                name: 'single_select',
                buttonParamsJson:
                  JSON.stringify({
                    title: 'Más Opciones',
                    sections: [
                      {
                        title: '⌏Seleccione una opción requerida⌎',
                        highlight_label: 'Solo para negocios',
                        rows: [
                          {
                            title: 'Owner/Creador',
                            description: '',
                            id: 'Edar'
                          },
                          {
                            title: 'Información del Bot',
                            description: '',
                            id: '.info'
                          },
                          {
                            title: 'Reglas/Términos',
                            description: '',
                            id: '.reglas'
                          },
                          {
                            title: 'vcard/yo',
                            description: '',
                            id: '.vcar'
                          },
                          {
                            title: 'Ping',
                            description: 'Velocidad del bot',
                            id: '.ping'
                          }
                        ]
                      }
                    ],
                    has_multiple_buttons: true
                  })
              },

              {
                name: 'cta_copy',
                buttonParamsJson:
                  JSON.stringify({
                    display_text: 'Copiar Código',
                    id: '123456789',
                    copy_code: 'Hola'
                  })
              },

              {
                name: 'cta_url',
                buttonParamsJson:
                  JSON.stringify({
                    display_text: 'sᴇɢᴜɪʀ ᴄᴀɴᴀʟ/ᴡᴀ',
                    url: channel,
                    merchant_url: channel
                  })
              },

              {
                name: 'galaxy_message',
                buttonParamsJson:
                  JSON.stringify({
                    mode: 'published',
                    flow_message_version: '3',
                    flow_token:
                      '1:1307913409923914:293680f87029f5a13d1ec5e35e718af3',
                    flow_id: '1307913409923914',
                    flow_cta: '👨🏻‍💻 ᴀᴄᴄᴇᴅᴇ ᴀ ʙᴏᴛ ᴀɪ',
                    flow_action: 'navigate',
                    flow_action_payload: {
                      screen: 'QUESTION_ONE',
                      params: {
                        user_id: '123456789',
                        referral: 'campaign_xyz'
                      }
                    },
                    flow_metadata: {
                      flow_json_version: '201',
                      data_api_protocol: 'v2',
                      flow_name: 'Lead Qualification [en]',
                      data_api_version: 'v2',
                      categories: [
                        'Lead Generation',
                        'Sales'
                      ]
                    }
                  })
              },

              {
                name: 'quick_reply',
                buttonParamsJson:
                  JSON.stringify({
                    display_text: 'ʜᴏʟᴀ😔',
                    id: '😔'
                  })
              },

              {
                name: 'cta_url',
                buttonParamsJson:
                  JSON.stringify({
                    display_text: 'ᴅᴇsᴀʀʀᴏʟʟᴀᴅᴏʀ',
                    url:
                      'https://wa.me/50492280729?text=Hola+quiero+un+bot+para+mi+grupo,+cuáles+son+los+planes?',
                    merchant_url:
                      'https://wa.me/50492280729?text=Hola+quiero+un+bot+para+mi+grupo,+cuáles+son+los+planes?'
                  })
              }

            ],

            messageParamsJson:
              JSON.stringify({
                limited_time_offer: {
                  text: 'Hola',
                  url: 'https://github.com/edar',
                  copy_code: 'Hola',
                  expiration_time: 1754613436864329
                },

                bottom_sheet: {
                  in_thread_buttons_limit: 2,
                  divider_indices: [
                    1,
                    2,
                    3,
                    4,
                    5,
                    999
                  ],
                  list_title: 'Select Menu',
                  button_title: '▻ ᴠᴇʀ ᴍᴇɴᴜ ✨'
                },

                tap_target_configuration: {
                  title: '▸ X ◂',
                  description: 'Hola',
                  canonical_url: 'https://github.com/edar',
                  domain: 'https://xrljosedvapi.vercel.app',
                  button_index: 0
                }
              })
          },

          contextInfo: interactiveContext
        }
      },
      {
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
    )

  } catch (err) {
    console.error(
      '[PI] Error enviando interactivo:',
      err?.message || err
    )

    await m.reply(`${e}`)
  }
}

handler.command = ['pi']
handler.group = true

export default handler
