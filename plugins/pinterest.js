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
  }
}

const handler = async (m, { conn, args }) => {
  const text = args.join(" ")
  const chat = m.chat

  if (!text)
    return m.reply(
      `${e} *Uso correcto:* .pinterest <texto | url>\n` +
      `Ejemplos:\n• .pinterest Akame\n• .pinterest https://pin.it/10HeaH0Uk`
    )

  await m.react("🕒")

  // 📌 URL directa (video o imagen)
  if (/^https?:\/\//.test(text)) {
    try {
      const html = await (await fetch(text)).text()

      let videoUrl =
        html.match(/"contentUrl":"([^"]+\.mp4[^"]*)"/) ||
        html.match(/"url":"([^"]+\.mp4[^"]*)"/)

      if (videoUrl)
        videoUrl = videoUrl[1].replace(/\\u0026/g, "&")

      let imageUrl = null
      if (!videoUrl) {
        imageUrl = html.match(/"image":"([^"]+)"/)
        if (imageUrl)
          imageUrl = imageUrl[1].replace(/\\u0026/g, "&")
      }

      if (!videoUrl && !imageUrl)
        return m.reply(`${e} Pinterest no devolvió medios.`)

      if (videoUrl) {
        const buffer = Buffer.from(
          await (await fetch(videoUrl)).arrayBuffer()
        )

        await conn.sendMessage(
          chat,
          { video: buffer, caption: `${e} Pinterest Video` },
          { quoted: m }
        )

        return m.react("✅")
      }

      if (imageUrl) {
        const buffer = Buffer.from(
          await (await fetch(imageUrl)).arrayBuffer()
        )

        await conn.sendMessage(
          chat,
          { image: buffer, caption: `${e} Pinterest Imagen` },
          { quoted: m }
        )

        return m.react("✅")
      }

    } catch (err) {
      console.error("[PINTEREST URL ERROR]", err)
      await m.react("❌")
      return m.reply(`${e} Error:\n${err.message}`)
    }
  }

  // 🔎 Búsqueda por texto
  try {
    const url = `https://api.dorratz.com/v2/pinterest?q=${encodeURIComponent(text)}`
    const response = await fetch(url)

    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)

    const json = await response.json()

    if (!Array.isArray(json) || json.length === 0)
      throw new Error("No se encontraron imágenes en Pinterest")

    const buffers = []

    for (const item of json.slice(0, 5)) {
      if (!item.image_large_url) continue
      const buf = Buffer.from(
        await (await fetch(item.image_large_url)).arrayBuffer()
      )
      buffers.push(buf)
    }

    if (buffers.length === 0)
      throw new Error("Pinterest no devolvió imágenes válidas")

    if (buffers.length === 1) {
      await conn.sendMessage(
        chat,
        {
          image: buffers[0],
          caption: `${e} *Resultado para:* ${text}`
        },
        { quoted: m }
      )
      return m.react("✅")
    }

    await sendAlbumMessage(conn, chat, buffers, {
      caption: `${e} *Resultados para:* ${text}`,
      quoted: m
    })

    await m.react("✅")

  } catch (err) {
    console.error("[PINTEREST SEARCH ERROR]", err)
    m.reply(`${e} *Ocurrió un error:*\n${err.message}`)
  }
}

handler.help = ["pinterest"]
handler.tags = ["descargas"]
handler.command = ["pinterest", "pin", "pinimg", "pvid"]
handler.group = true

export default handler
