let handler = async (m, { conn, args }) => {
if (args.length < 2) {
return m.reply(
'⚡ USO\n' +
'.rch <enlace de publicación> <emoji>\n\n' +
'Ejemplo:\n' +
'.rch https://whatsapp.com/channel/0029Vb5Sdfx3GJOuGSXf3K1R/5389 💀'
)
}

let url

try {
url = new URL(args[0])
} catch {
return m.reply('❌ El enlace no es válido.')
}

if (
!['whatsapp.com', 'www.whatsapp.com'].includes(url.hostname) ||
url.pathname.split('/').filter(Boolean).length !== 3
) {
return m.reply(
'❌ Usa el enlace directo de una publicación de un canal de WhatsApp.'
)
}

const parts = url.pathname.split('/').filter(Boolean)
const inviteCode = parts[1]
const serverId = parts[2]
const emojis = args.slice(1).join(' ').split(',').map(e => e.trim()).filter(Boolean)

if (parts[0] !== 'channel' || !/^\d+$/.test(serverId)) {
return m.reply('❌ El enlace no contiene un ID de publicación válido.')
}

if (!emojis.length) {
return m.reply('❌ Debes indicar al menos un emoji.')
}

if (emojis.length > 4) {
return m.reply('❌ Puedes indicar un máximo de 4 emojis.')
}

if (typeof conn.newsletterMetadata !== 'function') {
return m.reply('❌ Baileys no tiene newsletterMetadata().')
}

if (typeof conn.newsletterReactMessage !== 'function') {
return m.reply('❌ Baileys no tiene newsletterReactMessage().')
}

await m.react('🕒')

try {
const metadata = await conn.newsletterMetadata(
'invite',
inviteCode
)

const jid = metadata?.id || metadata?.jid

if (!jid || !jid.endsWith('@newsletter')) {
  throw new Error('No se pudo resolver el JID del canal.')
}

const resultados = []

for (const emoji of emojis) {
  await conn.newsletterReactMessage(
    jid,
    serverId,
    emoji
  )

  resultados.push('✅ ' + emoji + ' enviado')
}

await m.react('✅')

return m.reply(
  '🔥 SOLICITUD COMPLETADA\n\n' +
  'Canal: ' + (metadata.name || 'WhatsApp Channel') + '\n' +
  'Publicación: ' + serverId + '\n' +
  'JID: ' + jid + '\n\n' +
  resultados.join('\n') +
  '\n\n⚠️ WhatsApp puede reemplazar una reacción anterior por otra. ' +
  'Esto no genera mil reacciones independientes.'
)

} catch (e) {
console.error(
'React Channel Error:',
e.response?.data || e.stack || e.message
)

await m.react('❌')

return m.reply(
  '❌ ERROR AL REACCIONAR\n\n' +
  (e.response?.data?.message || e.message || 'Error desconocido')
)

}
}

handler.help = ['rch <enlace> <emoji,emoji>']
handler.tags = ['tools']
handler.command = ['rch', 'reactch']

export default handler
