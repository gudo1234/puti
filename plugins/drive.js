import fetch from "node-fetch"

const handler = async (m, { conn, text, args }) => {

  const url = args[0]
  if (!url) return m.reply(`${e} Por favor, ingresa una URL de Google Drive.`)

  const chat = m.chat
  const carpetaMatch = url.match(/(?:folders\/|drive\/(?:mobile\/)?folders\/)([a-zA-Z0-9_-]+)/i)
  const carpetaID = carpetaMatch?.[1]

  if (carpetaID) {
    await m.react("🗂️")

    try {
      const html = await fetch(
        `https://drive.google.com/drive/folders/${carpetaID}`
      ).then(res => res.text())

      const fileMatches = [
        ...html.matchAll(/\/file\/d\/([a-zA-Z0-9_-]{10,})/g)
      ]

      const idsUnicos = [...new Set(fileMatches.map(v => v[1]))]
      if (!idsUnicos.length)
        return m.reply(`${e} No se encontraron archivos en esta carpeta.`)

      await m.reply(`📂 Se encontraron *${idsUnicos.length}* archivos. Enviando uno por uno...`)

      for (const id of idsUnicos) {
        try {
          const info = await fdrivedl(`https://drive.google.com/file/d/${id}`)
          const nombre = info.fileName || `archivo_${id}`
          const tipo = info.mimetype || detectarMime(nombre)

          await conn.sendMessage(chat, {
            document: { url: info.downloadUrl },
            fileName: nombre,
            mimetype: tipo
          }, { quoted: m })

          await m.react("✅")
          await new Promise(r => setTimeout(r, 2000))

        } catch {
          await m.reply(`${e} No se pudo descargar el archivo con ID: ${id}`)
        }
      }

    } catch (err) {
      console.error(err)
      return m.reply(`${e} Error al procesar la carpeta.`)
    }
    return
  }

  if (!/drive\.google\.com\/(file\/d\/|open\?id=|uc\?id=)/i.test(url))
    return m.reply(`${e} La URL ingresada no es válida de Google Drive.`)

  await m.react("🕒")

  try {
    const res = await fdrivedl(url)
    const nombre = res.fileName || "archivo"
    const tipo = res.mimetype || detectarMime(nombre)
    const peso = formatBytes(res.sizeBytes)

    if (peso.includes("GB") && parseFloat(peso) > 1.8)
      return m.reply("📦 El archivo es muy grande para enviarlo.")

    await m.reply(
      `📁 *Archivo:* ${nombre}\n${e} *Tamaño:* ${peso}\n⏳ Enviando archivo...`
    )

    await conn.sendMessage(chat, {
      document: { url: res.downloadUrl },
      fileName: nombre,
      mimetype: tipo
    }, { quoted: m })

    await m.react("✅")

  } catch (err) {
    console.error(err)
    m.reply(`${e} Error al intentar descargar el archivo.`)
  }
}
async function fdrivedl(url) {
  const idMatch = url.match(/(?:\/d\/|id=|uc\?id=)([a-zA-Z0-9_-]{10,})/i)
  const id = idMatch?.[1]
  if (!id) throw "ID inválido"

  const res = await fetch(
    `https://drive.google.com/uc?id=${id}&authuser=0&export=download`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "x-json-requested": "true",
        "x-drive-first-party": "DriveWebUi",
        origin: "https://drive.google.com",
        "user-agent": "Mozilla/5.0"
      }
    }
  )

  let json
  try {
    json = JSON.parse((await res.text()).slice(4))
  } catch {
    throw "Respuesta inválida"
  }

  if (!json.downloadUrl)
    throw "Archivo privado o límite excedido"

  const head = await fetch(json.downloadUrl)
  if (!head.ok) throw "No accesible"

  return {
    downloadUrl: json.downloadUrl,
    fileName: json.fileName?.trim() || `archivo_${id}`,
    sizeBytes: json.sizeBytes,
    mimetype: (head.headers.get("content-type") || "").includes("octet-stream")
      ? detectarMime(json.fileName || "")
      : head.headers.get("content-type")
  }
}
function detectarMime(fileName) {
  const ext = fileName.split(".").pop().toLowerCase()
  return tiposMime[ext] || "application/octet-stream"
}

function formatBytes(bytes, decimals = 2) {
  if (!bytes) return "0 Bytes"
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(decimals) +
    " " + ["Bytes", "KB", "MB", "GB", "TB"][i]
}

const tiposMime = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  zip: "application/zip",
  rar: "application/vnd.rar"
}

handler.help = ["gdrive"]
handler.tags = ["descargas"]
handler.command = ["gdrive", "drive", "drivedl", "dldrive"]
handler.group = true

export default handler
