let handler = async (m, { conn, args }) => {
if (args.length < 2) {
return m.reply(
`⚡ Uso:
.rch <enlace de publicación> <emoji>

Ejemplo:
.rch https://whatsapp.com/channel/XXXXXXXX/732 🔥`
)
}

const postLink = args[0].trim()
const emoji = args.slice(1).join(' ').trim()

let url

try {
url = new URL(postLink)
} catch {
return m.reply('❌ El enlace no es válido.')
}

if (
!['whatsapp.com', 'www.whatsapp.com'].includes(url.hostname) ||
!url.pathname.startsWith('/channel/')
) {
return m.reply('❌ Debes proporcionar un enlace de canal de WhatsApp.')
}

const parts = url.pathname.split('/').filter(Boolean)

if (parts.length < 3 || !/^\d+$/.test(parts[2])) {
return m.reply(
'❌ El enlace no contiene un identificador de publicación válido.'
)
}

const serverId = parts[2]

if (!emoji) {
return m.reply('❌ Especifica el emoji que quieres enviar.')
}

if (typeof conn.newsletterReactMessage !== 'function') {
return m.reply(
'❌ Tu versión de Baileys no admite newsletterReactMessage().'
)
}

return m.reply(
"✅ Enlace validado.\nID de publicación: ${serverId}\nEmoji: ${emoji}\n\n⚠️ Falta resolver el JID del canal para enviar la reacción directamente."
)
}

handler.help = ['rch <enlace> <emoji>']
handler.tags = ['tools']
handler.command = ['rch', 'reactch']

export default handler
