import PhoneNumber from 'awesome-phonenumber'
import { downloadContentFromMessage } from '@whiskeysockets/baileys'

const NOTIFY_GROUP = '120363428593802799@g.us'

const notices = new Map()

const VIEW_ONCE_TYPES = [
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension'
]

const MEDIA_TYPES = [
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage'
]

function getInnerMessage(message = {}) {
  let current = message

  for (let i = 0; i < 8 && current; i++) {
    if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message
      continue
    }

    if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message
      continue
    }

    if (current.viewOnceMessageV2Extension?.message) {
      current = current.viewOnceMessageV2Extension.message
      continue
    }

    break
  }

  return current || {}
}

function getViewOnce(m) {
  const message = m?.message

  if (!message) return null

  const isViewOnce = VIEW_ONCE_TYPES.some(
    type => message[type]
  )

  if (!isViewOnce) return null

  const inner = getInnerMessage(message)

  for (const type of MEDIA_TYPES) {
    if (inner?.[type]) {
      return {
        type,
        message: inner[type]
      }
    }
  }

  return null
}

function getSender(m) {
  return (
    m?.sender ||
    m?.participant ||
    m?.key?.participant ||
    ''
  )
}

function getCountry(jid) {
  try {
    const number = jid
      .split('@')[0]
      .replace(/\D/g, '')

    const phone = new PhoneNumber('+' + number)

    const region =
      phone.getRegionCode?.() || ''

    const regionNames = new Intl.DisplayNames(
      ['es'],
      { type: 'region' }
    )

    const country =
      region
        ? regionNames.of(region) || 'Desconocido'
        : 'Desconocido'

    const flag =
      region && region.length === 2
        ? [...region.toUpperCase()]
            .map(c =>
              String.fromCodePoint(
                127397 + c.charCodeAt(0)
              )
            )
            .join('')
        : '🌎'

    return {
      number: '+' + number,
      country,
      flag
    }
  } catch {
    const number = jid
      .split('@')[0]
      .replace(/\D/g, '')

    return {
      number: '+' + number,
      country: 'Desconocido',
      flag: '🌎'
    }
  }
}

async function downloadViewOnce(m, view) {
  try {
    if (typeof m.quoted?.download === 'function') {
      return await m.quoted.download()
    }
  } catch {}

  try {
    const stream = await downloadContentFromMessage(
      view.message,
      view.type.replace('Message', '')
    )

    const chunks = []

    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
  } catch {}

  return null
}

async function sendMedia(conn, buffer, view) {
  if (!buffer) return false

  try {
    if (view.type === 'imageMessage') {
      await conn.sendMessage(
        NOTIFY_GROUP,
        {
          image: buffer
        }
      )

      return true
    }

    if (view.type === 'videoMessage') {
      await conn.sendMessage(
        NOTIFY_GROUP,
        {
          video: buffer
        }
      )

      return true
    }

    if (view.type === 'audioMessage') {
      await conn.sendMessage(
        NOTIFY_GROUP,
        {
          audio: buffer,
          mimetype:
            view.message.mimetype ||
            'audio/mpeg'
        }
      )

      return true
    }

    if (view.type === 'documentMessage') {
      await conn.sendMessage(
        NOTIFY_GROUP,
        {
          document: buffer,
          mimetype:
            view.message.mimetype ||
            'application/octet-stream',
          fileName:
            view.message.fileName ||
            'view-once'
        }
      )

      return true
    }
  } catch (err) {
    console.error('[VIEWONCE]', err)
  }

  return false
}

let handler = async (m, { conn }) => {

  /*
   * Este before se ejecuta para todos los mensajes,
   * pero solamente continúa si hay una cita.
   */

  if (!m.isGroup) return

  /*
   * IMPORTANTE:
   * Si empieza con cualquier prefijo,
   * dejamos que el comando correspondiente
   * siga su funcionamiento normal.
   */

  const body =
    m.text ||
    m.body ||
    ''

  if (
    typeof global.prefix !== 'undefined' &&
    global.prefix instanceof RegExp &&
    global.prefix.test(body.trim())
  ) {
    return
  }

  /*
   * Si el mensaje cita uno de nuestros avisos,
   * solamente registramos la respuesta.
   */

  if (
    m.chat === NOTIFY_GROUP &&
    m.quoted?.id &&
    notices.has(m.quoted.id)
  ) {
    const response = body.trim()

    if (!response) return

    const sender = getSender(m)

    if (!sender) return

    const info = getCountry(sender)

    const mention = `@${sender.split('@')[0]}`

    const text =
`👤 *Remitente:* ${mention}
📱 *Número:* ${info.number}
🌎 *País:* ${info.country} ${info.flag}
🍁 *Respuesta:* ${response}`

    await conn.sendMessage(
      NOTIFY_GROUP,
      {
        text,
        mentions: [sender]
      },
      {
        quoted: m
      }
    )

    return
  }

  /*
   * A partir de aquí solamente interesan
   * mensajes que estén CITANDO algo.
   */

  if (!m.quoted) return

  /*
   * Comprobar si lo citado es View Once.
   */

  const quoted = {
    message: m.quoted.message
  }

  const view = getViewOnce(quoted)

  if (!view) return

  const sender =
    m.quoted.sender ||
    m.quoted.participant ||
    m.quoted.key?.participant ||
    ''

  if (!sender) return

  const info = getCountry(sender)

  const mention = `@${sender.split('@')[0]}`

  /*
   * Descargar View Once.
   */

  const buffer =
    await downloadViewOnce(m, view)

  /*
   * Enviar contenido recuperado.
   */

  if (buffer) {
    await sendMedia(
      conn,
      buffer,
      view
    )
  }

  /*
   * Texto que escribió el usuario
   * al citar la Vista Una Vez.
   */

  const response =
    body.trim() ||
    'Sin texto'

  const notification =
`👁️ *VIEW ONCE DETECTADO*

👤 *Remitente:* ${mention}
📱 *Número:* ${info.number}
🌎 *País:* ${info.country} ${info.flag}
🍁 *Respuesta:* ${response}`

  const sent =
    await conn.sendMessage(
      NOTIFY_GROUP,
      {
        text: notification,
        mentions: [sender]
      },
      {
        quoted: m
      }
    )

  /*
   * Guardamos únicamente el ID del aviso
   * que acaba de enviar el bot.
   */

  if (sent?.key?.id) {
    notices.set(
      sent.key.id,
      true
    )
  }

  /*
   * Limitar memoria.
   */

  if (notices.size > 300) {
    const first =
      notices.keys().next().value

    if (first) {
      notices.delete(first)
    }
  }
}

handler.before = async (m, ctx) => {
  try {
    return await handler(m, ctx)
  } catch (err) {
    console.error(
      '[VIEWONCE BEFORE]',
      err?.stack || err
    )
  }
}

export default handler
