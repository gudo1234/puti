import {
  downloadContentFromMessage
} from '@whiskeysockets/baileys'

import { sticker } from '../lib/sticker.js'

let handler = m => m

handler.all = async function (m) {
  try {
    const chat = db.data.chats[m.chat]

    if (!chat?.autosticker || !m.isGroup) {
      return true
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🤖 [AUTOSTICKER] MENSAJE DETECTADO')
    console.log('💬 Chat:', m.chat)
    console.log('👤 Sender:', m.sender)
    console.log('📝 Texto:', m.text || '(sin texto)')
    console.log('📦 Type:', m.mtype || '(desconocido)')
    console.log('🎞️ MediaType:', m.mediaType || '(desconocido)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    /*
     * =====================================================
     * MOSTRAR QUÉ ESTÁ LLEGANDO REALMENTE
     * =====================================================
     */

    try {
      console.log(
        '🔎 [AUTOSTICKER] m.mtype:',
        m.mtype
      )

      console.log(
        '🔎 [AUTOSTICKER] m.msg keys:',
        m.msg
          ? Object.keys(m.msg)
          : '(sin m.msg)'
      )

      console.log(
        '🔎 [AUTOSTICKER] m.message keys:',
        m.message
          ? Object.keys(m.message)
          : '(sin m.message)'
      )

      console.log(
        '🔎 [AUTOSTICKER] mimetype:',
        m.msg?.mimetype ||
        m.mimetype ||
        '(sin mimetype)'
      )

      console.log(
        '🔎 [AUTOSTICKER] mediaType:',
        m.mediaType ||
        '(sin mediaType)'
      )
    } catch (e) {
      console.log(
        '⚠️ [AUTOSTICKER] No se pudo inspeccionar m:',
        e.message
      )
    }

    /*
     * =====================================================
     * SI ES STICKER, NO HACER NADA
     * =====================================================
     */

    const directMime =
      m.msg?.mimetype ||
      m.mimetype ||
      ''

    if (
      /webp/i.test(directMime) ||
      /sticker/i.test(m.mtype || '')
    ) {
      console.log(
        '⏭️ [AUTOSTICKER] Es sticker/WebP. Ignorando.'
      )

      return true
    }

    /*
     * =====================================================
     * BUSCADOR RECURSIVO DE MEDIA
     *
     * Esto permite encontrar:
     *
     * imageMessage
     * videoMessage
     * documentMessage
     * ephemeralMessage
     * viewOnceMessage
     * viewOnceMessageV2
     * viewOnceMessageV2Extension
     * documentWithCaptionMessage
     * etc.
     * =====================================================
     */

    const findMedia = (obj, path = 'root', depth = 0) => {
      if (!obj || typeof obj !== 'object') {
        return null
      }

      if (depth > 15) {
        return null
      }

      /*
       * IMAGEN
       */

      if (obj.imageMessage) {
        console.log(
          '🖼️ [AUTOSTICKER] imageMessage encontrado:',
          path + '.imageMessage'
        )

        return {
          type: 'image',
          message: obj.imageMessage,
          path: path + '.imageMessage'
        }
      }

      /*
       * VIDEO
       */

      if (obj.videoMessage) {
        console.log(
          '🎥 [AUTOSTICKER] videoMessage encontrado:',
          path + '.videoMessage'
        )

        return {
          type: 'video',
          message: obj.videoMessage,
          path: path + '.videoMessage'
        }
      }

      /*
       * DOCUMENTO
       */

      if (obj.documentMessage) {
        const mime =
          obj.documentMessage.mimetype || ''

        console.log(
          '📄 [AUTOSTICKER] documentMessage encontrado:',
          path + '.documentMessage',
          '| MIME:',
          mime
        )

        if (/^image\//i.test(mime)) {
          return {
            type: 'image',
            message: obj.documentMessage,
            path: path + '.documentMessage'
          }
        }

        if (/^video\//i.test(mime)) {
          return {
            type: 'video',
            message: obj.documentMessage,
            path: path + '.documentMessage'
          }
        }
      }

      /*
       * RECORRER TODO EL OBJETO
       */

      for (const key of Object.keys(obj)) {
        if (
          key === 'contextInfo' ||
          key === 'messageContextInfo' ||
          key === 'senderKeyDistributionMessage'
        ) {
          continue
        }

        const value = obj[key]

        if (
          value &&
          typeof value === 'object'
        ) {
          const result = findMedia(
            value,
            `${path}.${key}`,
            depth + 1
          )

          if (result) {
            return result
          }
        }
      }

      return null
    }

    /*
     * =====================================================
     * CONSTRUIR TODAS LAS POSIBLES FUENTES
     * =====================================================
     */

    const sources = []

    if (m.message) {
      sources.push({
        name: 'm.message',
        value: m.message
      })
    }

    if (m.msg) {
      sources.push({
        name: 'm.msg',
        value: m.msg
      })
    }

    if (m) {
      sources.push({
        name: 'm',
        value: m
      })
    }

    if (m.quoted) {
      if (m.quoted.message) {
        sources.push({
          name: 'm.quoted.message',
          value: m.quoted.message
        })
      }

      if (m.quoted.msg) {
        sources.push({
          name: 'm.quoted.msg',
          value: m.quoted.msg
        })
      }

      sources.push({
        name: 'm.quoted',
        value: m.quoted
      })
    }

    /*
     * =====================================================
     * BUSCAR MEDIA
     * =====================================================
     */

    let media = null

    for (const source of sources) {
      console.log(
        '🔍 [AUTOSTICKER] Buscando multimedia en:',
        source.name
      )

      const found = findMedia(
        source.value,
        source.name
      )

      if (found) {
        media = found
        break
      }
    }

    /*
     * =====================================================
     * FALLBACK POR MIME
     * =====================================================
     */

    if (!media) {
      const mime =
        m.msg?.mimetype ||
        m.mimetype ||
        m.quoted?.msg?.mimetype ||
        m.quoted?.mimetype ||
        ''

      if (mime) {
        console.log(
          '🧩 [AUTOSTICKER] MIME encontrado por fallback:',
          mime
        )
      }

      if (/^image\//i.test(mime)) {
        media = {
          type: 'image',
          message: m.msg || m.quoted?.msg,
          path: 'fallback'
        }
      }

      else if (/^video\//i.test(mime)) {
        media = {
          type: 'video',
          message: m.msg || m.quoted?.msg,
          path: 'fallback'
        }
      }
    }

    /*
     * =====================================================
     * SI ENCONTRAMOS MEDIA
     * =====================================================
     */

    let stiker = false

    if (media) {
      console.log('\n✅ [AUTOSTICKER] MULTIMEDIA DETECTADA')
      console.log('📌 Tipo:', media.type)
      console.log('📌 Ruta:', media.path)

      /*
       * =================================================
       * MÉTODO 1
       * download() DEL WRAPPER DE TU BOT
       * =================================================
       */

      const q =
        m.quoted ||
        m

      try {
        if (typeof q.download === 'function') {
          console.log(
            '⬇️ [AUTOSTICKER] Intentando q.download()...'
          )

          const buffer = await q.download()

          if (buffer?.length) {
            console.log(
              '✅ [AUTOSTICKER] q.download() OK:',
              buffer.length,
              'bytes'
            )

            stiker = await sticker(
              buffer,
              false,
              `${m.pushName || ''}`
            )
          }
        }
      } catch (e) {
        console.log(
          '⚠️ [AUTOSTICKER] q.download() falló:',
          e.message
        )
      }

      /*
       * =================================================
       * MÉTODO 2
       * BAILEYS downloadContentFromMessage
       * =================================================
       */

      if (!stiker) {
        try {
          console.log(
            '⬇️ [AUTOSTICKER] Intentando Baileys downloadContentFromMessage()...'
          )

          const stream =
            await downloadContentFromMessage(
              media.message,
              media.type
            )

          const chunks = []

          for await (const chunk of stream) {
            chunks.push(chunk)
          }

          const buffer =
            Buffer.concat(chunks)

          console.log(
            '📦 [AUTOSTICKER] Baileys descargó:',
            buffer.length,
            'bytes'
          )

          if (buffer.length) {
            stiker = await sticker(
              buffer,
              false,
              `${m.pushName || ''}`
            )
          }
        } catch (e) {
          console.log(
            '❌ [AUTOSTICKER] Baileys download falló:',
            e.message
          )
        }
      }

      /*
       * =================================================
       * RESULTADO DE CONVERSIÓN
       * =================================================
       */

      if (stiker) {
        console.log(
          '🎉 [AUTOSTICKER] STICKER GENERADO CORRECTAMENTE'
        )

        try {
          await conn.sendMessage(
            m.chat,
            {
              sticker: stiker
            },
            {
              quoted: null
            }
          )

          console.log(
            '📤 [AUTOSTICKER] Sticker enviado.'
          )
        } catch (e) {
          console.log(
            '❌ [AUTOSTICKER] Error enviando sticker:',
            e.message
          )
        }
      } else {
        console.log(
          '❌ [AUTOSTICKER] Se detectó la multimedia pero no se pudo generar el sticker.'
        )
      }
    }

    /*
     * =====================================================
     * URL DIRECTA
     * =====================================================
     */

    if (!stiker && m.text) {
      const url =
        m.text
          .trim()
          .split(/\s+/)[0]

      if (isUrl(url)) {
        console.log(
          '🌐 [AUTOSTICKER] URL multimedia detectada:',
          url
        )

        try {
          stiker = await sticker(
            false,
            url,
            packname,
            author
          )

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

            console.log(
              '📤 [AUTOSTICKER] Sticker de URL enviado.'
            )
          }
        } catch (e) {
          console.log(
            '❌ [AUTOSTICKER] Error procesando URL:',
            e.message
          )
        }
      }
    }

    /*
     * =====================================================
     * NO ENCONTRÓ NADA
     * =====================================================
     */

    if (!media && !isUrl(m.text || '')) {
      console.log(
        'ℹ️ [AUTOSTICKER] No se encontró imagen/video en este mensaje.'
      )

      console.log(
        'ℹ️ [AUTOSTICKER] mtype:',
        m.mtype
      )

      console.log(
        'ℹ️ [AUTOSTICKER] mediaType:',
        m.mediaType
      )

      console.log(
        'ℹ️ [AUTOSTICKER] MIME:',
        directMime || '(vacío)'
      )
    }

  } catch (e) {
    console.error(
      '💥 [AUTOSTICKER] ERROR GENERAL:',
      e
    )
  }

  return true
}

export default handler

const isUrl = text => {
  if (!text) return false

  return /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*(?:jpe?g|png|gif|webp|mp4|mov|webm)(?:\?.*)?$/i.test(text)
}
