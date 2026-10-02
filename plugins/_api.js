let handler = async (m, { conn, command }) => {
  if (command !== 'pi') return

  const connected = () => {
    try {
      if (!conn) return false

      if (
        conn.ws &&
        typeof conn.ws.readyState === 'number'
      ) {
        return conn.ws.readyState === 1
      }

      return true
    } catch {
      return false
    }
  }

  const waitForConnection = async (
    tries = 8,
    delay = 1000
  ) => {
    for (let i = 0; i < tries; i++) {
      if (connected()) return true

      await new Promise(resolve =>
        setTimeout(resolve, delay)
      )
    }

    return false
  }

  const channelInfo = global.channelRD || {}
  const channel = global.canal || global.redes || ''
  const textbot = global.textbot || ''
  const wm = global.wm || ''

  const newsletterInfo =
    channelInfo?.id
      ? {
          forwardedNewsletterMessageInfo: {
            newsletterJid: channelInfo.id,
            newsletterName:
              channelInfo.name || '',
            serverMessageId: 1
          }
        }
      : {}

  const createContextInfo = () => {
    return {
      ...newsletterInfo,
      remoteJid: '@broadcast',
      forwardingScore: 10,
      isForwarded: true
    }
  }

  try {
    const isReady =
      await waitForConnection()

    if (!isReady) {
      return m.reply(
        `${e} Conexión no disponible.`
      )
    }

    const run = clockString(
      process.uptime() * 1000
    )

    const interactiveContext =
      createContextInfo()

    const nativeFlowPayload = {
      body: {
        text:
          `${e} Interactive Message\n\n` +
          `${textbot || 'Interactive'}`
      },

      footer: {
        text:
          wm || `Runtime ${run}`
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
                title:
                  'Más Opciones',

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
                        title:
                          'Ping',

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

                id:
                  '123456789',

                copy_code:
                  'Código interactivo'
              })
          },

          {
            name: 'cta_url',

            buttonParamsJson:
              JSON.stringify({
                display_text:
                  'sᴇɢᴜɪʀ ᴄᴀɴᴀʟ/ᴡᴀ',

                url: channel,

                merchant_url:
                  channel
              })
          },

          {
            name:
              'galaxy_message',

            buttonParamsJson:
              JSON.stringify({
                mode:
                  'published',

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

                id:
                  '😔'
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
                'Interactive',

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
              title:
                '▸ X ◂',

              description:
                'Let’s go',

              canonical_url:
                'https://github.com/edar',

              domain:
                'https://xrljosedvapi.vercel.app',

              button_index:
                0
            }
          })
      },

      contextInfo:
        interactiveContext
    }

    let enviado = false

    for (
      let intento = 1;
      intento <= 3;
      intento++
    ) {
      try {
        const ready =
          await waitForConnection(
            4,
            1000
          )

        if (!ready) continue

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

      } catch (err) {
        console.error(
          `[PI] Error interactivo (${intento}/3):`,
          err?.message || err
        )

        await new Promise(resolve =>
          setTimeout(resolve, 2000)
        )
      }
    }

    if (!enviado) {
      return m.reply(
        `${e} No se pudo enviar el Interactive Message.`
      )
    }

  } catch (err) {
    console.error(
      '[PI] Error:',
      err?.message || err
    )

    return m.reply(
      `${e} Ocurrió un error al enviar el Interactive Message.`
    )
  }
}

function clockString(ms) {
  let h = isNaN(ms)
    ? '--'
    : Math.floor(
        ms / 3600000
      )

  let m = isNaN(ms)
    ? '--'
    : Math.floor(
        ms / 60000
      ) % 60

  let s = isNaN(ms)
    ? '--'
    : Math.floor(
        ms / 1000
      ) % 60

  return [h, m, s]
    .map(v =>
      v.toString().padStart(2, '0')
    )
    .join(':')
}

handler.command = ['pi']

export default handler
