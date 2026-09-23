import fetch from "node-fetch"
import {
  generateWAMessageFromContent,
  generateWAMessage,
  delay
} from "@whiskeysockets/baileys"

async function sendAlbumMessage(conn, jid, medias, options = {}) {
  if (!Array.isArray(medias) || medias.length < 2)
    throw new RangeError("Se requieren mínimo 2 imágenes")

  const caption = options.caption || ""
  const wait = !isNaN(options.delay) ? options.delay : 500

  const album = generateWAMessageFromContent(
    jid,
    {
      albumMessage: {
        expectedImageCount: medias.length,
        expectedVideoCount: 0,
        ...(options.quoted
          ? {
              contextInfo: {
                remoteJid: options.quoted.key.remoteJid,
                fromMe: options.quoted.key.fromMe,
                stanzaId: options.quoted.key.id,
                participant:
                  options.quoted.key.participant ||
                  options.quoted.key.remoteJid,
                quotedMessage: options.quoted.message
              }
            }
          : {})
      }
    },
    {}
  )

  await conn.relayMessage(album.key.remoteJid, album.message, {
    messageId: album.key.id
  })

  for (let i = 0; i < medias.length; i++) {
    try {
      const msg = await generateWAMessage(
        album.key.remoteJid,
        {
          image: medias[i],
          ...(i === 0 ? { caption } : {})
        },
        { upload: conn.waUploadToServer }
      )

      msg.message.messageContextInfo = {
        messageAssociation: {
          associationType: 1,
          parentMessageKey: album.key
        }
      }

      await conn.relayMessage(msg.key.remoteJid, msg.message, {
        messageId: msg.key.id
      })

      await delay(wait)
    } catch (err) {
      console.warn("Error enviando imagen:", err.message)
    }
  }
}

const handler = async (m, { conn, args }) => {
  const text = args.join(" ")
  const chat = m.chat

  if (!text)
    return m.reply(`${e} *Uso correcto:* .imagen <texto>\nEjemplo: .imagen neko`)

  await m.react("🕒")

  try {
    const MAX = 5
    const buffers = []

    for (let i = 0; i < MAX; i++) {
      const url = `https://api.stellarwa.xyz/search/googleimagen?query=${encodeURIComponent(
        text
      )}&key=stellar-wsRJSBsk`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const buf = Buffer.from(await res.arrayBuffer())
      if (!buffers.some(b => b.equals(buf))) buffers.push(buf)
    }

    if (buffers.length === 1) {
      await conn.sendMessage(
        chat,
        {
          image: buffers[0],
          caption: `${e} *Resultado para:* ${text}`
        },
        { quoted: m }
      )
      return await m.react("✅")
    }

    await sendAlbumMessage(conn, chat, buffers, {
      caption: `${e} *Resultados para:* ${text}`,
      quoted: m
    })

    await m.react("✅")

  } catch (err) {
    console.error("[IMG ERROR]", err)
    m.reply(`${e} *Ocurrió un error:*\n${err.message}`)
  }
}

handler.help = ["imagen <texto>"]
handler.tags = ["descargas"]
handler.command = ["imagen", "image"]
handler.group = true

export default handler
