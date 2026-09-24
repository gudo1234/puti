import { sticker } from '../lib/sticker.js'

let handler = m => m

handler.before = async function (m) {

  try {

    const chat = db.data.chats[m.chat]
    const user = db.data.users[m.sender]

    if (!chat?.autosticker || !m.isGroup) return true

    console.log('\n╭─────── AUTOSTICKER ───────')
    console.log('│ 📨 Mensaje recibido')
    console.log('│ 👤 Sender:', m.sender)
    console.log('│ 💬 Chat:', m.chat)
    console.log('│ 📦 mtype:', m.mtype)
    console.log('│ 🎞️ mediaType:', m.mediaType)
    console.log('│ 📝 Texto:', m.text || '(sin texto)')

    const q = m

    const mime =
      (q.msg || q).mimetype ||
      q.mediaType ||
      ''

    console.log('│ 🧩 MIME:', mime || '(vacío)')

    /*
     * Evitar convertir stickers nuevamente
     */

    if (/webp/i.test(mime)) {
      console.log('│ ⏭️ WebP detectado, ignorando')
      console.log('╰──────────────────────────\n')
      return true
    }

    let stiker = false

    /*
     * ─────────────────────────────
     * IMAGEN
     * ─────────────────────────────
     */

    if (/image/i.test(mime)) {

      console.log('│ 🖼️ Imagen detectada')

      const img = await q.download?.()

      if (!img) {
        console.log('│ ❌ q.download() no devolvió datos')
        console.log('╰──────────────────────────\n')
        return true
      }

      console.log(
        '│ 📥 Imagen descargada:',
        img.length,
        'bytes'
      )

      stiker = await sticker(
        img,
        false,
        packname,
        author
      )
    }

    /*
     * ─────────────────────────────
     * VIDEO
     * ─────────────────────────────
     */

    else if (/video/i.test(mime)) {

      console.log('│ 🎥 Video detectado')

      const seconds =
        (q.msg || q).seconds ||
        q.seconds ||
        0

      console.log(
        '│ ⏱️ Duración:',
        seconds,
        'segundos'
      )

      /*
       * Igual que GataBot:
       * evitar vídeos demasiado largos.
       */

      if (seconds > 8) {
        console.log(
          '│ ⛔ Video demasiado largo'
        )

        return true
      }

      const img = await q.download?.()

      if (!img) {
        console.log(
          '│ ❌ q.download() no devolvió datos'
        )

        console.log(
          '╰──────────────────────────\n'
        )

        return true
      }

      console.log(
        '│ 📥 Video descargado:',
        img.length,
        'bytes'
      )

      stiker = await sticker(
        img,
        false,
        packname,
        author
      )
    }

    /*
     * ─────────────────────────────
     * URL
     * ─────────────────────────────
     */

    else if (m.text) {

      const url =
        m.text
          .trim()
          .split(/\s+/)[0]

      if (isUrl(url)) {

        console.log(
          '│ 🌐 URL multimedia detectada'
        )

        console.log(
          '│ 🔗',
          url
        )

        stiker = await sticker(
          false,
          url,
          packname,
          author
        )

      } else {

        console.log(
          '│ ℹ️ No es una URL multimedia'
        )
      }
    }

    /*
     * ─────────────────────────────
     * RESULTADO
     * ─────────────────────────────
     */

    if (stiker) {

      console.log(
        '│ ✅ Sticker generado correctamente'
      )

      await conn.sendFile(
        m.chat,
        stiker,
        'sticker.webp',
        '',
        m,
        true,
        {
          contextInfo: {
            forwardingScore: 200,
            isForwarded: false
          }
        },
        {
          quoted: m
        }
      )

      console.log(
        '│ 📤 Sticker enviado'
      )

    } else {

      console.log(
        '│ ⚠️ No se generó ningún sticker'
      )
    }

    console.log(
      '╰──────────────────────────\n'
    )

  } catch (e) {

    console.error(
      '💥 [AUTOSTICKER] ERROR:',
      e
    )

    console.log(
      '╰──────────────────────────\n'
    )
  }

  return true
}

export default handler

const isUrl = text => {

  if (!text) return false

  return text.match(
    new RegExp(
      /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png|webp|mp4|mov|webm)/,
      'gi'
    )
  )
}
