import axios from "axios"

const handler = async (m, { conn, args }) => {
  try {
    if (!args[0])
      return m.reply(`${e} Debes enviar un link de MediaFire válido`)

    const link = args[0]
    const chat = m.chat

    await m.react("🕒")

    const api = `https://api-nv.ultraplus.click/api/download/mediafire?url=${encodeURIComponent(link)}&key=2yLJjTeqXudWiWB8`
    const response = await axios.get(api)

    if (!response.data?.status)
      return m.reply(`${e} Error al obtener datos del MediaFire.`)

    const data = response.data.result
    const filename = data.fileName || "archivo"
    const fileurl = data.url

    const mimeTypes = {
      "7z": "application/x-7z-compressed",
      "zip": "application/zip",
      "rar": "application/vnd.rar",
      "apk": "application/vnd.android.package-archive",
      "tar": "application/x-tar",
      "gz": "application/gzip",
      "tgz": "application/gzip",
      "bz2": "application/x-bzip2",
      "mp4": "video/mp4",
      "mkv": "video/x-matroska",
      "avi": "video/x-msvideo",
      "mov": "video/quicktime",
      "wmv": "video/x-ms-wmv",
      "mp3": "audio/mpeg",
      "wav": "audio/wav",
      "ogg": "audio/ogg",
      "flac": "audio/flac",
      "m4a": "audio/mp4",
      "aac": "audio/aac",
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "gif": "image/gif",
      "webp": "image/webp",
      "bmp": "image/bmp",
      "svg": "image/svg+xml",
      "pdf": "application/pdf",
      "doc": "application/msword",
      "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "xls": "application/vnd.ms-excel",
      "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "ppt": "application/vnd.ms-powerpoint",
      "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "txt": "text/plain",
      "csv": "text/csv",
      "html": "text/html",
      "json": "application/json",
      "xml": "application/xml",
      "js": "text/javascript",
      "py": "text/x-python",
      "c": "text/x-c",
      "cpp": "text/x-c++",
      "exe": "application/vnd.microsoft.portable-executable",
      "msi": "application/x-msi",
      "jar": "application/java-archive",
      "mcaddon": "application/x-mcaddon",
      "mcpack": "application/x-mcpack",
      "mcworld": "application/x-mcworld",
      "iso": "application/x-iso9660-image",
      "bin": "application/octet-stream"
    }

    const ext = filename.split(".").pop().toLowerCase()
    const mimetype = mimeTypes[ext] || "application/octet-stream"

    const file = await axios.get(fileurl, { responseType: "arraybuffer" })

    await conn.sendMessage(
      chat,
      {
        document: file.data,
        fileName: filename,
        mimetype
      },
      { quoted: m }
    )

    await m.react("✅")

  } catch (err) {
    console.error(err)
    m.reply(`${e} Ocurrió un error al descargar el archivo.`)
  }
}

handler.help = ["mediafire"]
handler.tags = ["descargas"]
handler.command = ["mediafire", "mf"]
handler.group = true

export default handler
