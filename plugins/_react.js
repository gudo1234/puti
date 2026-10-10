let handler = async (m, { conn, args }) => {
if (args.length < 2) {
return m.reply(
'⚡ Uso:\n.rch <enlace de publicación> <emoji>\n\nEjemplo:\n.rch https://whatsapp.com/channel/XXXXXXXX/732 🔥'
)
}

const postLink = args[0]
const emoji = args.slice(1).join(' ').trim()

if (!/^https?://(www.)?whatsapp.com/channel/[A-Za-z0-9_-]+/\d+/?$/i.test(postLink)) {
return m.reply(
'❌ Necesito el enlace directo de una publicación del canal, no solamente el enlace de invitación.'
)
}

const match = postLink.match(
/^https?://(www.)?whatsapp.com/channel/([A-Za-z0-9_-]+)/(\d+)/?$/i
)

if (!match) {
return m.reply('❌ No pude interpretar el enlace.')
}

const serverId = match[3]

await m.react('🕒')

try {
if (typeof conn.newsletterReactMessage !== 'function') {
throw new Error(
'Tu versión de Baileys no incluye newsletterReactMessage().'
)
}

throw new Error(
  `El enlace contiene el identificador ${serverId}, pero falta resolver el JID real del canal antes de enviar la reacción.`
)

} catch (e) {
await m.react('❌')
return m.reply("❌ ${e.message}")
}
}

handler.help = ['rch <enlace> <emoji>']
handler.tags = ['tools']
handler.command = ['rch', 'reactch']

export default handler
