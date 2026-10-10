let handler = async (m, { conn }) => {
const methods = Object.keys(
Object.getPrototypeOf(conn) || {}
).filter(k => /newsletter|channel/i.test(k))

const available = [
'newsletterReactMessage',
'newsletterMetadata',
'newsletterFetchMessages'
].map(name => "${name}: ${typeof conn[name]}")

return m.reply(
"🔎 Métodos de canales\n\n${available.join('\n')}\n\nOtros métodos:\n${methods.join('\n') || 'No encontrados'}"
)
}

handler.help = ['rchdebug']
handler.tags = ['tools']
handler.command = ['rchdebug']

export default handler
