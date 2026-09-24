import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { sticker } from '../lib/sticker.js'

let handler = m => m

handler.all = async function (m) {
  const chat = db.data.chats[m.chat]
  const user = db.data.users[m.sender]

  if (!chat?.autosticker || !m.isGroup) return true

  let stiker = false

  try {
    /*
     * ==========================================
     * DESENVOLVER MENSAJES DE BAILEYS
     * ==========================================
     */

    const unwrapMessage = msg => {
      if (!msg) return null

      let current = msg

      while (true) {
        if (current.ephemeralMessage?.message) {
          current = current.ephemeralMessage.message
          continue
        }

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

        if (current.documentWithCaptionMessage?.message) {
          current = current.documentWithCaptionMessage.message
          continue
        }

        break
      }

      return current
    }

    /*
     * ==========================================
     * BUSCAR EL MENSAJE REAL
     * ==========================================
     */

    let rawMessage =
      m.message ||
      m.msg ||
      m

    /*
     * Si es respuesta a otro mensaje, primero
     * intentamos trabajar con el mensaje citado.
     */
    if (m.quoted) {
      rawMessage =
        m.quoted.message ||
        m.quoted.msg ||
        m.quoted
    }

    const message = unwrapMessage(rawMessage)

    if (!message) return true

    /*
     * ==========================================
     * DETECTAR TIPO DE MEDIA
     * ==========================================
     */

    let mediaMessage = null
    let mediaType = ''

    if (message.imageMessage) {
      mediaMessage = message.imageMessage
      mediaType = 'image'
    }

    else if (message.videoMessage) {
      mediaMessage = message.videoMessage
      mediaType = 'video'
    }

    /*
     * Documentos enviados como imagen/video.
     */
    else if (message.documentMessage) {
      const doc = message.documentMessage

      const mime = doc.mimetype || ''

      if (/^image\//i.test(mime)) {
        mediaMessage = doc
        mediaType = 'image'
      }

      else if (/^video\//i.test(mime)) {
        mediaMessage = doc
        mediaType = 'video'
      }
    }

    /*
     * ==========================================
     * SI NO ENCONTRÓ MEDIA, USAR EL MIME DEL
     * MENSAJE NORMALIZADO DEL BOT
     * ==========================================
     */

    if (!mediaMessage) {
      const q = m.quoted || m

      const mime =
        q?.msg?.mimetype ||
        q?.mimetype ||
        q?.mediaType ||
        ''

      if (/webp/i.test(mime)) {
        return true
      }

      if (/image/i.test(mime)) {
        mediaType = 'image'
      }

      else if (/video/i.test(mime)) {
        mediaType = 'video'
      }

      if (mediaType) {
        try {
          const buffer = await q.download?.()

          if (buffer) {
            stiker = await sticker(
              buffer,
              false,
              `${m.pushName || ''}`
            )
          }
        } catch (e) {
          console.error('[AUTOSTICKER]', e)
        }
      }
    }

    /*
     * ==========================================
     * DESCARGA DIRECTA CON BAILEYS
     * ==========================================
     *
     * Esto sirve cuando m.download() no consigue
     * resolver correctamente mensajes envueltos.
     */

    if (!stiker && mediaMessage && mediaType) {
      try {
        const stream = await downloadContentFromMessage(
          mediaMessage,
          mediaType
        )

        const chunks = []

        for await (const chunk of stream) {
          chunks.push(chunk)
        }

        const buffer = Buffer.concat(chunks)

        if (buffer.length) {
          stiker = await sticker(
            buffer,
            false,
            `${m.pushName || ''}`
          )
        }
      } catch (e) {
        console.error('[AUTOSTICKER BAILEYS]', e)
      }
    }

    /*
     * ==========================================
     * URL DIRECTA
     * ==========================================
     */

    if (!stiker && m.text) {
      const url = m.text
        .trim()
        .split(/\s+/)[0]

      if (isUrl(url)) {
        try {
          stiker = await sticker(
            false,
            url,
            packname,
            author
          )
        } catch (e) {
          console.error('[AUTOSTICKER URL]', e)
        }
      }
    }

    /*
     * ==========================================
     * ENVIAR STICKER
     * ==========================================
     */

    if (stiker) {
      await conn.sendMessage(
        m.chat,
        {
          sticker: stiker
        },
        {
          quoted: null
        }
      )
    }

  } catch (e) {
    console.error('[AUTOSTICKER]', e)
  }

  return true
}

export default handler

/*
 * ==========================================
 * DETECTOR DE URL
 * ==========================================
 */

const isUrl = text => {
  if (!text) return false

  return /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*(?:jpe?g|png|gif|webp|mp4)(?:\?.*)?$/i.test(text)
}
