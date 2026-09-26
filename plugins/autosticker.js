import { sticker } from '../lib/sticker.js'

let handler = m => m

handler.before = async function (m) {
  const chat = db.data.chats[m.chat]
  const user = db.data.users[m.sender]

  if (chat.autosticker && m.isGroup) {
    const q = m

    const botJid = conn.user?.id?.split(':')[0] + '@s.whatsapp.net'
    const sender = m.sender?.split(':')[0] + '@s.whatsapp.net'

    if (sender === botJid) return

    let stiker = false
    const mime = (q.msg || q).mimetype || q.mediaType || ''

    if (/webp/g.test(mime)) return

    if (/image/g.test(mime)) {
      const img = await q.download?.()
      if (!img) return
      stiker = await sticker(img, false, packname, author)

    } else if (/video/g.test(mime)) {
      const seconds = Number((q.msg || q).seconds || 0)

      if (seconds > 6) return

      const img = await q.download()
      if (!img) return
      stiker = await sticker(img, false, packname, author)

    } else if (m.text?.split(/\n| /i)[0]) {
      const url = m.text.split(/\n| /i)[0]

      if (isUrl(url)) {
        stiker = await sticker(
          false,
          url,
          packname,
          author
        )
      } else {
        return
      }
    }

    if (stiker) {
      await conn.sendFile(
        m.chat,
        stiker,
        'sticker.webp',
        '',
        null,
        true
      )
    }
  }

  return true
}

export default handler

const isUrl = text => {
  return text.match(
    new RegExp(
      /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*(jpe?g|gif|png|mp4))/,
      'gi'
    )
  )
}
