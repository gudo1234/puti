import fs from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import fetch from 'node-fetch'
import path from 'path'
import { sticker } from '../lib/sticker.js'

let handler = async (m, { conn, __dirname }) => {
  const chat = global.db?.data?.chats?.[m.chat] || {}
  const welcomeEnabled = chat.welcome ?? chat.bienvenida

  if (!m.isGroup || !welcomeEnabled) return true
  if (!m.messageStubType || ![27, 28, 32].includes(m.messageStubType)) return

  const isWelcome = m.messageStubType === 27
  const isBye = m.messageStubType === 28 || m.messageStubType === 32

  let userData = m.messageStubParameters?.[0]

  if (!userData) return

  let user = null

  try {
    if (typeof userData === 'string') {
      const value = userData.trim()

      if (value.startsWith('{') && value.endsWith('}')) {
        const parsed = JSON.parse(value)

        user =
          parsed?.phoneNumber ||
          parsed?.jid ||
          parsed?.id ||
          null
      } else {
        user = value
      }
    } else if (typeof userData === 'object') {
      user =
        userData?.phoneNumber ||
        userData?.jid ||
        userData?.id ||
        null
    }
  } catch (e) {
    console.error('[WELCOME] Error leyendo participante:', e)

    if (typeof userData === 'string') {
      user = userData
    }
  }

  if (!user || typeof user !== 'string') {
    console.log('[WELCOME] No se pudo obtener el JID del participante:', userData)
    return
  }

  if (user.endsWith('@lid') && m.isGroup) {
    try {
      const metadata = await conn.groupMetadata(m.chat).catch(() => null)

      const match = metadata?.participants?.find(p =>
        p?.id === user ||
        p?.lid === user ||
        p?.jid === user
      )

      if (match?.jid) {
        user = match.jid
      } else if (match?.phoneNumber) {
        user = match.phoneNumber
      }
    } catch (e) {
      console.log(
        '[WELCOME] No se pudo resolver el LID:',
        e?.message || e
      )
    }
  }

  const channelInfo = global.channelRD || {}
  const channel = global.canal || global.redes || ''
  const wm = global.wm || ''
  const textbot = global.textbot || ''
  const redes = global.redes || ''
  const icono = global.icono || ''

  let name = 'Usuario'

  try {
    const result = await conn.getName(user)

    if (result) {
      name = result
    }
  } catch {
    name = 'Usuario'
  }

  let groupName = ''
  let tantos = 0

  try {
    if (m.isGroup) {
      const metadata = await conn.groupMetadata(m.chat)

      groupName = metadata?.subject || ''
      tantos = metadata?.participants?.length || 0
    }
  } catch {
    groupName = ''
    tantos = 0
  }

  const isConnected = () => {
    try {
      if (!conn) return false

      if (conn.ws && typeof conn.ws.readyState === 'number') {
        return conn.ws.readyState === 1
      }

      return true
    } catch {
      return false
    }
  }

  const waitForConnection = async (tries = 8, delay = 1500) => {
    for (let i = 0; i < tries; i++) {
      if (isConnected()) {
        return true
      }

      console.log(
        `[WELCOME] Esperando conexión... ${i + 1}/${tries}`
      )

      await new Promise(resolve => setTimeout(resolve, delay))
    }

    return false
  }

  const safeSendMessage = async (
    chatId,
    content,
    options = {},
    retries = 3
  ) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const connected = await waitForConnection(4, 1000)

      if (!connected) {
        console.log(
          '[WELCOME] WhatsApp continúa desconectado.'
        )

        continue
      }

      try {
        return await conn.sendMessage(
          chatId,
          content,
          options
        )
      } catch (e) {
        const errorText = String(
          e?.message || e || ''
        )

        console.error(
          `[WELCOME] Error de envío (${attempt + 1}/${retries}):`,
          errorText
        )

        if (
          /Connection Closed/i.test(errorText) ||
          /Connection closed/i.test(errorText) ||
          /428/i.test(errorText) ||
          /500/i.test(errorText)
        ) {
          await new Promise(resolve =>
            setTimeout(resolve, 2000)
          )

          continue
        }

        throw e
      }
    }

    console.log(
      '[WELCOME] No se pudo enviar el mensaje después de varios intentos.'
    )

    return null
  }

  const uptime = process.uptime() * 1000
  const run = clockString(uptime)

  const imgPath = join(
    __dirname,
    '../storage/catalogo.jpg'
  )

  let thumbResized = null

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
  } catch (e) {
    console.error(
      '[WELCOME] Error preparando thumbnail:',
      e?.message || e
    )
  }

  let previewThumbnail = null

  try {
    if (icono) {
      const response = await fetch(icono)

      if (response.ok) {
        const original = Buffer.from(
          await response.arrayBuffer()
        )

        previewThumbnail = await sharp(original)
          .resize(640, 640, {
            fit: 'cover',
            position: 'centre'
          })
          .jpeg({
            quality: 100,
            chromaSubsampling: '4:4:4'
          })
          .toBuffer()
      }
    }
  } catch (e) {
    console.error(
      '[WELCOME] Error preparando preview:',
      e?.message || e
    )

    previewThumbnail = null
  }

  const audiosWelcome = [
    'https://raw.githubusercontent.com/edar123/im/main/media/a.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/bien.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/prueba3.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/prueba4.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/bloody.mp3'
  ]

  const audiosBye = [
    'https://raw.githubusercontent.com/edar123/im/main/media/adios.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/prueba.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/sad.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/cardigansad.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/iwas.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/juntos.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/space.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/stellar.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/theb.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/alanspectre.mp3'
  ]

  const audioPick = arr =>
    arr[Math.floor(Math.random() * arr.length)]

  const gifsBienvenida = [
    'https://raw.githubusercontent.com/edar123/im/main/media/gif.mp4',
    'https://raw.githubusercontent.com/edar123/im/main/media/giff.mp4',
    'https://raw.githubusercontent.com/edar123/im/main/media/gifff.mp4',
    'https://raw.githubusercontent.com/edar123/im/main/media/gif4.mp4'
  ]

  const gifDespedida =
    'https://qu.ax/xOtQJ.mp4'

  const formatos = [
    'stiker',
    'audio',
    'texto',
    'gifPlayback',
    'interactivo'
  ]

  const formatoElegido =
    formatos[
      Math.floor(
        Math.random() * formatos.length
      )
    ]

  const actividad = isWelcome
    ? `${global.e || ''} Bienvenid@, @${user.split('@')[0]}`
    : `👋🏻 Adiós, @${user.split('@')[0]}`

  const ac = isWelcome
    ? `${global.e || ''} Bienvenid@, ${name}`
    : `👋🏻 Adiós, ${name}`

  const newsletterInfo = channelInfo?.id
    ? {
        forwardedNewsletterMessageInfo: {
          newsletterJid: channelInfo.id,
          newsletterName:
            channelInfo.name || '',
          serverMessageId: 0
        }
      }
    : {}

  const createContextInfo = ({
    mentioned = true,
    forwardingScore = 10,
    isForwarded = true
  } = {}) => {
    return {
      ...newsletterInfo,

      ...(mentioned
        ? {
            mentionedJid: [user]
          }
        : {}),

      forwardingScore,
      isForwarded
    }
  }

  const createLinkPreview = ({
    title = textbot,
    description = wm
  } = {}) => {
    if (!redes || !previewThumbnail) {
      return null
    }

    return {
      'matched-text': redes,
      title,
      description,
      jpegThumbnail: previewThumbnail,
      renderLargerThumbnail: false
    }
  }

  let stickerBuffer = null

  try {
    switch (formatoElegido) {

      case 'stiker': {
        try {
          const imagenSticker = isWelcome
            ? global.imagen8
            : global.imagen7

          if (!imagenSticker) {
            throw new Error(
              `No existe global.${
                isWelcome
                  ? 'imagen8'
                  : 'imagen7'
              }`
            )
          }

          stickerBuffer = await sticker(
            imagenSticker,
            false,
            global.packname,
            global.author
          )

          if (
            !Buffer.isBuffer(stickerBuffer) ||
            !stickerBuffer.length
          ) {
            throw new Error(
              'El sticker no devolvió un Buffer válido.'
            )
          }

          await safeSendMessage(
            m.chat,
            {
              sticker: stickerBuffer,

              contextInfo: createContextInfo({
                forwardingScore: 200,
                isForwarded: false
              })
            }
          )

        } catch (e) {
          console.error(
            '[WELCOME] Error generando/enviando sticker:',
            e?.message || e
          )

          await safeSendMessage(
            m.chat,
            {
              text: actividad,

              linkPreview: createLinkPreview({
                title: `| Runtime ${run}`,
                description: isWelcome
                  ? 'IzuBot te da la bienvenida'
                  : 'Esperemos que no vuelva -_-'
              }),

              contextInfo: createContextInfo()
            }
          )
        }

        break
      }

      case 'audio': {
        const audioUrl = isWelcome
          ? audioPick(audiosWelcome)
          : audioPick(audiosBye)

        await safeSendMessage(
          m.chat,
          {
            audio: {
              url: audioUrl
            },

            ptt: false,

            mimetype: 'audio/mpeg',

            fileName: 'noti.mp3',

            contextInfo: createContextInfo({
              forwardingScore: 10,
              isForwarded: true
            })
          }
        )

        break
      }

      case 'texto': {
        const linkPreview =
          createLinkPreview({
            title: `| Runtime ${run}`,
            description: isWelcome
              ? 'IzuBot te da la bienvenida'
              : 'Esperemos que no vuelva -_-'
          })

        await safeSendMessage(
          m.chat,
          {
            text: redes
              ? `${redes}\n${actividad}`
              : actividad,

            ...(linkPreview
              ? {
                  linkPreview
                }
              : {}),

            contextInfo: createContextInfo({
              forwardingScore: 10,
              isForwarded: true
            })
          }
        )

        break
      }

      case 'gifPlayback': {
        const videoUrl = isWelcome
          ? gifsBienvenida[
              Math.floor(
                Math.random() *
                gifsBienvenida.length
              )
            ]
          : gifDespedida

        const linkPreview =
          createLinkPreview({
            title: `| Runtime ${run}`,
            description: isWelcome
              ? 'IzuBot te da la bienvenida'
              : 'Esperemos que no vuelva -_-'
          })

        await safeSendMessage(
          m.chat,
          {
            video: {
              url: videoUrl
            },

            gifPlayback: true,

            caption: redes
              ? `${redes}\n${actividad}`
              : actividad,

            ...(linkPreview
              ? {
                  linkPreview
                }
              : {}),

            contextInfo: createContextInfo({
              forwardingScore: 10,
              isForwarded: true
            })
          }
        )

        break
      }

      case 'interactivo': {
        const connected =
          await waitForConnection(
            8,
            1000
          )

        if (!connected) {
          console.log(
            '[WELCOME] Conexión no disponible. Se omitió el interactivo.'
          )

          break
        }

        const interactiveContext =
          createContextInfo({
            forwardingScore: 10,
            isForwarded: true
          })

        const nativeFlowPayload = {
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

              fileName:
                `${global.e || ''} Somos ${tantos} en el grupo`,

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

              ...(thumbResized
                ? {
                    jpegThumbnail:
                      thumbResized
                  }
                : {}),

              contextInfo:
                interactiveContext
            },

            hasMediaAttachment: true
          },

          body: {
            text: actividad
          },

          footer: {
            text: isWelcome
              ? 'welcome'
              : 'Usuario ha salido del grupo'
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
                name:
                  'call_permission_request',

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
                        title:
                          '⌏Seleccione una opción requerida⌎',

                        highlight_label:
                          'Solo para negocios',

                        rows: [
                          {
                            title:
                              'Owner/Creador',

                            description: '',

                            id: 'Edar'
                          },

                          {
                            title:
                              'Información del Bot',

                            description: '',

                            id: '.info'
                          },

                          {
                            title:
                              'Reglas/Términos',

                            description: '',

                            id: '.reglas'
                          },

                          {
                            title:
                              'vcard/yo',

                            description: '',

                            id: '.vcar'
                          },

                          {
                            title: 'Ping',

                            description:
                              'Velocidad del bot',

                            id: '.ping'
                          }
                        ]
                      }
                    ],

                    has_multiple_buttons:
                      true
                  })
              },

              {
                name: 'cta_copy',

                buttonParamsJson:
                  JSON.stringify({
                    display_text:
                      'Copiar Código',

                    id: '123456789',

                    copy_code:
                      'Código de bienvenida'
                  })
              },

              {
                name: 'cta_url',

                buttonParamsJson:
                  JSON.stringify({
                    display_text:
                      'sᴇɢᴜɪʀ ᴄᴀɴᴀʟ/ᴡᴀ',

                    url: channel,

                    merchant_url: channel
                  })
              },

              {
                name:
                  'galaxy_message',

                buttonParamsJson:
                  JSON.stringify({
                    mode: 'published',

                    flow_message_version:
                      '3',

                    flow_token:
                      '1:1307913409923914:293680f87029f5a13d1ec5e35e718af3',

                    flow_id:
                      '1307913409923914',

                    flow_cta:
                      '👨🏻‍💻 ᴀᴄᴄᴇᴅᴇ ᴀ ʙᴏᴛ ᴀɪ',

                    flow_action:
                      'navigate',

                    flow_action_payload: {
                      screen:
                        'QUESTION_ONE',

                      params: {
                        user_id:
                          '123456789',

                        referral:
                          'campaign_xyz'
                      }
                    },

                    flow_metadata: {
                      flow_json_version:
                        '201',

                      data_api_protocol:
                        'v2',

                      flow_name:
                        'Lead Qualification [en]',

                      data_api_version:
                        'v2',

                      categories: [
                        'Lead Generation',
                        'Sales'
                      ]
                    }
                  })
              },

              {
                name:
                  'quick_reply',

                buttonParamsJson:
                  JSON.stringify({
                    display_text:
                      'ʜᴏʟᴀ😔',

                    id: '😔'
                  })
              },

              {
                name: 'cta_url',

                buttonParamsJson:
                  JSON.stringify({
                    display_text:
                      'ᴅᴇsᴀʀʀᴏʟʟᴀᴅᴏʀ',

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
                  text:
                    `| Runtime ${run}`,

                  url:
                    'https://github.com/edar',

                  copy_code:
                    groupName,

                  expiration_time:
                    1754613436864329
                },

                bottom_sheet: {
                  in_thread_buttons_limit:
                    2,

                  divider_indices: [
                    1,
                    2,
                    3,
                    4,
                    5,
                    999
                  ],

                  list_title:
                    'Select Menu',

                  button_title:
                    '▻ ᴠᴇʀ ᴍᴇɴᴜ ✨'
                },

                tap_target_configuration: {
                  title: '▸ X ◂',

                  description:
                    'Let’s go',

                  canonical_url:
                    'https://github.com/edar',

                  domain:
                    'https://xrljosedvapi.vercel.app',

                  button_index: 0
                }
              })
          },

          contextInfo:
            interactiveContext
        }

        let enviado = false

        for (let intento = 1; intento <= 3; intento++) {
          try {
            const connected =
              await waitForConnection(
                4,
                1000
              )

            if (!connected) continue

            await conn.relayMessage(
              m.chat,
              {
                viewOnceMessage: {
                  message: {
                    interactiveMessage:
                      nativeFlowPayload
                  }
                }
              },
              {}
            )

            enviado = true
            break

          } catch (e) {
            console.error(
              `[WELCOME] Error interactivo (${intento}/3):`,
              e?.message || e
            )

            await new Promise(
              resolve =>
                setTimeout(resolve, 2000)
            )
          }
        }

        if (!enviado) {
          console.log(
            '[WELCOME] No se pudo enviar el interactivo.'
          )
        }

        break
      }
    }

  } catch (e) {
    console.error(
      '[WELCOME] Error:',
      e?.message || e
    )
  }
}

function clockString(ms) {
  let h = isNaN(ms)
    ? '--'
    : Math.floor(ms / 3600000)

  let m = isNaN(ms)
    ? '--'
    : Math.floor(ms / 60000) % 60

  let s = isNaN(ms)
    ? '--'
    : Math.floor(ms / 1000) % 60

  return [h, m, s]
    .map(v =>
      v.toString().padStart(2, '0')
    )
    .join(':')
}

handler.before = handler

export default handler
