import fs from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import fetch from 'node-fetch'
import {
getDevice,
generateWAMessageFromContent
} from '@whiskeysockets/baileys'

let handler = async (
m,
{
conn,
usedPrefix,
__dirname,
realUserNumber,
userInGroup
}
) => {
let groupName = ''

if (m.isGroup) {
const metadata = await conn.groupMetadata(m.chat)
groupName = metadata.subject
}

try {
const imgPath = join(
__dirname,
'../storage/catalogo.jpg'
)

const thumbLocal = fs.existsSync(imgPath)
  ? fs.readFileSync(imgPath)
  : null

const thumbResized = thumbLocal
  ? await sharp(thumbLocal)
      .resize(300, 100, { fit: 'cover' })
      .jpeg()
      .toBuffer()
  : null

const uptime = process.uptime() * 1000
const run = clockString(uptime)
const info = await global.mundo(m, conn)

let categorias = {}

for (const plugin of Object.values(global.plugins)) {
  const h = plugin.default || plugin

  if (!h || !h.help || !h.tags) continue

  const helps = Array.isArray(h.help) ? h.help : [h.help]
  const tags = Array.isArray(h.tags) ? h.tags : [h.tags]

  for (const tag of tags) {
    if (!categorias[tag]) categorias[tag] = []
    categorias[tag].push(...helps)
  }
}

m.react(e)

const { default: PhoneNumber } =
  await import('awesome-phonenumber')

const regionNames = new Intl.DisplayNames(
  ['es'],
  { type: 'region' }
)

const banderaEmoji = codigo => {
  if (
    !codigo ||
    codigo === '??' ||
    !/^[A-Z]{2}$/i.test(codigo)
  ) return '🌐'

  return [...codigo.toUpperCase()]
    .map(letra =>
      String.fromCodePoint(
        0x1F1E6 + letra.charCodeAt(0) - 65
      )
    )
    .join('')
}

let numeroReal = 'No disponible'
let codigoPais = '??'
let participante = userInGroup || null
let tagJid = m.sender

try {
  let participantes = []

  if (m.isGroup) {
    const metadata = await conn.groupMetadata(m.chat)
    participantes = metadata.participants || []

    participante = participantes.find(p =>
      p.id === m.sender ||
      p.jid === m.sender ||
      p.lid === m.sender ||
      p.phoneNumber === m.sender
    ) || participante
  }

  const candidatos = [
    realUserNumber,
    participante?.phoneNumber,
    participante?.jid,
    participante?.id,
    participante?.lid,
    m.sender
  ].filter(Boolean)

  let numeroEncontrado = ''

  for (const candidato of candidatos) {
    const valor = String(candidato)

    if (valor.endsWith('@lid')) {
      const resolver =
        conn.signalRepository?.lidMapping?.getPNForLID

      if (typeof resolver === 'function') {
        try {
          const pn = await resolver.call(
            conn.signalRepository.lidMapping,
            valor
          )

          if (pn && !String(pn).endsWith('@lid')) {
            numeroEncontrado = String(pn)
            break
          }
        } catch {}
      }

      continue
    }

    if (
      valor.endsWith('@g.us') ||
      valor.endsWith('@newsletter')
    ) continue

    const digitos = valor
      .split('@')[0]
      .replace(/\D/g, '')

    if (digitos.length >= 7) {
      numeroEncontrado = valor
      break
    }
  }

  if (!numeroEncontrado && m.isGroup) {
    const lid = [
      participante?.lid,
      participante?.id,
      m.sender
    ].find(v =>
      v && String(v).endsWith('@lid')
    )

    const resolver =
      conn.signalRepository?.lidMapping?.getPNForLID

    if (lid && typeof resolver === 'function') {
      try {
        const pn = await resolver.call(
          conn.signalRepository.lidMapping,
          lid
        )

        if (pn && !String(pn).endsWith('@lid')) {
          numeroEncontrado = String(pn)
        }
      } catch {}
    }
  }

  if (numeroEncontrado) {
    const digitos = numeroEncontrado
      .split('@')[0]
      .replace(/\D/g, '')

    if (digitos.length >= 7) {
      numeroReal = '+' + digitos

      const pn = new PhoneNumber('+' + digitos)
      codigoPais = pn.getRegionCode() || '??'

      tagJid = numeroEncontrado.includes('@')
        ? numeroEncontrado
        : `${digitos}@s.whatsapp.net`

      if (tagJid.endsWith('@lid')) {
        tagJid = `${digitos}@s.whatsapp.net`
      }
    }
  }
} catch (error) {
  console.error(
    'Error resolviendo LID:',
    error.message
  )
}

const nombrePais = codigoPais !== '??'
  ? regionNames.of(codigoPais) || 'Desconocido'
  : info?.country || 'Desconocido'

const banderaPais = codigoPais !== '??'
  ? banderaEmoji(codigoPais)
  : info?.flag || '🌐'

const paisUsuario =
  `${nombrePais} (${banderaPais})`

const rol =
  participante?.admin === 'superadmin'
    ? 'Creador'
    : participante?.admin === 'admin'
      ? 'Administrador'
      : 'Miembro'

const tagNumero = tagJid.split('@')[0]

let text = `${e} _Hola ${m.pushName}_ ¿Cómo estás?

\`❒ᴄᴏɴᴛᴇxᴛ-ɪɴғᴏ☔\`

┌────────────
│ 🌎 País: ${paisUsuario}
│ 📱 Sistema/Opr: ${getDevice(m.key.id)}
│ 📞 Número: ${numeroReal}
│ 👤 Rol: ${rol}
│ 🏷️ Tag: @${tagNumero}
└────────────

🤖 MENÚ DE COMANDOS
━━━━━━━━━━━━━━
`

for (const tag of Object.keys(categorias).sort()) {
  text += `\n╭─❏ *${tag.toUpperCase()}*\n`

  for (const cmd of [...new Set(categorias[tag])]) {
    text += `│ • ${usedPrefix}${cmd}\n`
  }

  text += `╰────────────\n`
}

const channelInfo = global.channelRD || {}

const newsletterInfo = channelInfo.id
  ? {
      forwardedNewsletterMessageInfo: {
        newsletterJid: channelInfo.id,
        newsletterName: channelInfo.name || '',
        serverMessageId: 1
      }
    }
  : {}

const createContextInfo = (extra = {}) => ({
  ...newsletterInfo,
  mentionedJid: [tagJid],
  remoteJid: '@broadcast',
  forwardingScore: 10,
  isForwarded: true,
  ...extra
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

      fileName: 'Bot- AI WhatsApp',

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
        ? { jpegThumbnail: thumbResized }
        : {})
    },

    hasMediaAttachment: true
  },

  body: { text },

  contextInfo: createContextInfo(),

  footer: {
    text: '🤨 xvidẹ𝆬os.er/k (๑ ิټ ิ)'
  },

  nativeFlowMessage: {
    buttons: [
      {
        name: 'single_select',
        buttonParamsJson:
          '{"has_multiple_buttons":true}'
      },
      {
        name: 'call_permission_request',
        buttonParamsJson:
          '{"has_multiple_buttons":true}'
      },
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'Más Opciones',
          sections: [
            {
              title: '⌏Seleccione una opción requerida⌎',
              highlight_label: 'Desarrollador',
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
        buttonParamsJson: JSON.stringify({
          display_text: 'Copiar Código',
          id: '123456789',
          copy_code: 'Soy bien puto alv :v'
        })
      },
      {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: 'Canal de WhatsApp',
          url: 'https://whatsapp.com/channel/0029VaXHNMZL7UVTeseuqw3H',
          merchant_url: 'https://whatsapp.com/channel/0029VaXHNMZL7UVTeseuqw3H'
        })
      },
      {
        name: 'galaxy_message',
        buttonParamsJson: JSON.stringify({
          mode: 'published',
          flow_message_version: '3',
          flow_token: '1:1307913409923914:293680f87029f5a13d1ec5e35e718af3',
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
      }
    ],

    messageParamsJson: JSON.stringify({
      limited_time_offer: {
        text: `🕒 Runtime ${run}`,
        url: 'https://github.com/edar',
        copy_code: groupName,
        expiration_time: 1754613436864329
      },
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1, 2, 3, 4, 5, 999],
        list_title: 'Select Menu',
        button_title: '▻ Lista menú 📘'
      },
      tap_target_configuration: {
        title: '▸ X ◂',
        description: 'Let’s go',
        canonical_url: 'https://github.com/edar',
        domain: 'https://xrljosedvapi.vercel.app',
        button_index: 0
      }
    })
  }
}

const random = Math.floor(Math.random() * 3)

const gif = [
  'https://raw.githubusercontent.com/edar123/im/main/media/gif.mp4',
  'https://raw.githubusercontent.com/edar123/im/main/media/giff.mp4',
  'https://raw.githubusercontent.com/edar123/im/main/media/gifff.mp4',
  'https://raw.githubusercontent.com/edar123/im/main/media/gif4.mp4'
][Math.floor(Math.random() * 4)]

if (random === 0) {
  const iconResponse = await fetch(icono)

  if (!iconResponse.ok) {
    throw new Error(
      'No se pudo obtener la imagen de icono'
    )
  }

  const iconBuffer = Buffer.from(
    await iconResponse.arrayBuffer()
  )

  const previewThumbnail = await sharp(iconBuffer)
    .resize(640, 640, {
      fit: 'cover',
      position: 'centre'
    })
    .jpeg({
      quality: 100,
      chromaSubsampling: '4:4:4'
    })
    .toBuffer()

  await conn.sendMessage(
    m.chat,
    {
      text: `${redes}\n${text}`,

      linkPreview: {
        'matched-text': redes,
        title: textbot,
        description: wm,
        jpegThumbnail: previewThumbnail,
        renderLargerThumbnail: false
      },

      mentions: [tagJid],

      contextInfo: createContextInfo()
    },
    { quoted: m }
  )

  return
}

if (random === 1) {
  await conn.sendMessage(
    m.chat,
    {
      video: { url: gif },
      gifPlayback: true,
      caption: text,
      mentions: [tagJid],
      contextInfo: createContextInfo()
    },
    { quoted: m }
  )

  return
}

if (random === 2) {
  const message = generateWAMessageFromContent(
    m.chat,
    {
      viewOnceMessage: {
        message: {
          interactiveMessage: nativeFlowPayload
        }
      }
    },
    {
      userJid: conn.user.id,
      quoted: m
    }
  )

  await conn.relayMessage(
    m.chat,
    message.message,
    { messageId: message.key.id }
  )
}

} catch (e) {
console.error(
'Error al generar mensaje interactivo:',
e
)

await conn.reply(
  m.chat,
  `❌ Error al generar mensaje:\n${e.message}`,
  m
)

}
}

function clockString(ms) {
if (!Number.isFinite(ms) || ms < 0) return '--'

const totalSeconds = Math.floor(ms / 1000)
const days = Math.floor(totalSeconds / 86400)
const hours = Math.floor((totalSeconds % 86400) / 3600)
const minutes = Math.floor((totalSeconds % 3600) / 60)
const seconds = totalSeconds % 60

const hh = String(hours).padStart(2, '0')
const mm = String(minutes).padStart(2, '0')
const ss = String(seconds).padStart(2, '0')

if (days > 0) {
return `${days}d:${hh}:${mm}:${ss}`
}

return "${hh}:${mm}:${ss}"
}

handler.help = ['menu']
handler.tags = ['main']
handler.group = true

handler.command = [
'menu',
'help',
'comandos',
'menú',
'm',
'memu'
]

export default handler
