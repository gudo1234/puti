import fetch from "node-fetch"

const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i

const handler = async (m, { conn, args }) => {

  if (!args[0])
    return m.reply(`${e} *Ingresa la URL de un repositorio de GitHub.*`)

  if (!regex.test(args[0])) {
    await m.react("❌")
    return m.reply(`${e} *La URL no parece válida de GitHub.*`)
  }

  let [, user, repo] = args[0].match(regex) || []
  let sanitizedRepo = repo.replace(/\.git$/, "")

  let repoUrl = `https://api.github.com/repos/${user}/${sanitizedRepo}`
  let zipUrl = `https://api.github.com/repos/${user}/${sanitizedRepo}/zipball`

  await m.react("🕒")

  try {
    const [repoResponse, zipResponse] = await Promise.all([
      fetch(repoUrl),
      fetch(zipUrl)
    ])

    const repoData = await repoResponse.json()
    const dispo = zipResponse.headers.get("content-disposition")
    const filename = dispo?.match(/attachment; filename=(.*)/)?.[1] || `${sanitizedRepo}.zip`
    const im = await (await fetch(icono)).buffer()

    let txt = `➝ *Nombre:* ${sanitizedRepo}\n`
    txt += `➝ *Repositorio:* ${user}/${sanitizedRepo}\n`
    txt += `➝ *Creador:* ${repoData.owner?.login || "Desconocido"}\n`
    txt += `➝ *Descripción:* ${repoData.description || "Sin descripción"}\n`
    txt += `> ⌗ Enviando archivo...`

    await conn.sendMessage(
      m.chat,
      {
        text: txt,
        contextInfo: {
          externalAdReply: {
            title: sanitizedRepo,
            body: textbot,
            thumbnail: im,
            thumbnailUrl: redes,
            sourceUrl: redes,
            mediaType: 1
          }
        }
      },
      { quoted: m }
    )

    const zipBuffer = await zipResponse.arrayBuffer()

    await conn.sendMessage(
      m.chat,
      {
        document: Buffer.from(zipBuffer),
        fileName: filename,
        mimetype: "application/zip"
      },
      { quoted: m }
    )

    await m.react("✅")

  } catch (err) {
    console.error(err)
    await m.react("❌")
    m.reply(`${msm} *Error al descargar el repositorio.*`)
  }
}

handler.help = ["gitclone"]
handler.tags = ["descargas"]
handler.command = ["gitclone", "github", "ghdl"]
handler.group = true

export default handler
