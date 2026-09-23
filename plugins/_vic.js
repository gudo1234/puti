import fetch from 'node-fetch'
import { URL } from 'url'

let handler = async (m, { text, conn, command, usedPrefix }) => {

  if (!/^https?:\/\//.test(text)) {
    return conn.reply(m.chat,
      `📎 Ingresa una URL válida\n\nEjemplo:\n*${usedPrefix + command}* http://ez.clips4u.sbs/cx`,
      m
    )
  }

  await m.react('🕒')

  try {
    const res = await fetch(text)
    const html = await res.text()

    // 🔞 detectar adulto
    const adultSites = ['xvideos','xnxx','pornhub','redtube','spankbang','youjizz','youporn']
    const isAdult = adultSites.some(site => text.includes(site))

    // 🔎 buscar TODO
    const regexAll = /(https?:\/\/[^\s"'<>]+?\.(mp4|webm|mov|mkv)(\?[^\s"'<>]*)?)/gi
    const found = [...html.matchAll(regexAll)].map(v => v[0])

    const tagSrcRegex = /<(video|source)[^>]+src=["']([^"']+)["']/gi
    const src = [...html.matchAll(tagSrcRegex)].map(v => v[2])

    const all = [...found, ...src].filter(Boolean)

    // 🧠 limpiar URLs duplicadas (clave aquí)
    let videos = []

    for (let url of all) {
      try {
        let full = url.startsWith('http') ? url : new URL(url, text).href

        // ❗ quitar parámetros para evitar duplicados falsos
        let clean = full.split('?')[0]

        if (/\.(mp4|webm|mov|mkv)$/i.test(clean)) {
          videos.push(clean)
        }

      } catch {}
    }

    // 🧹 eliminar duplicados reales
    videos = [...new Set(videos)]

    // ⚠️ limitar (evita spam o ban)
    videos = videos.slice(0, 10)

    if (videos.length === 0) {
      return conn.sendMessage(m.chat, { text: '❌ No se encontraron videos' }, { quoted: m })
    }

    // 🚀 enviar TODOS
    for (let vid of videos) {
      if (isAdult) {
        await conn.sendMessage(m.chat, {
          document: { url: vid },
          fileName: 'video.mp4',
          mimetype: 'video/mp4',
          caption: text
        }, { quoted: m })
      } else {
        await conn.sendMessage(m.chat, {
          video: { url: vid },
          mimetype: 'video/mp4',
          caption: vid
        }, { quoted: m })
      }
    }

    await m.react('✅')

  } catch (e) {
    console.error(e)
    await m.react('❌')
    m.reply(`Error: ${e.message}`)
  }
}

handler.help = ["vi"]
handler.tags = ["descargas"]
handler.command = ['vi'] // 🔥 aquí el cambio
handler.group = true

export default handler
