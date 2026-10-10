let handler = async (m, { conn }) => {
const available = [
'newsletterReactMessage',
'newsletterMetadata',
'newsletterFetchMessages'
].map(name => "${name}: ${typeof conn[name]}")

const methods = new Set()
let obj = conn

while (obj && obj !== Object.prototype) {
for (const name of Object.getOwnPropertyNames(obj)) {
if (/newsletter|channel/i.test(name)) methods.add(name)
}
obj = Object.getPrototypeOf(obj)
}

return m.reply([
'🔎 MÉTODOS DE CANALES',
'',
...available,
'',
'OTROS MÉTODOS:',
...([...methods].sort().map(name => "${name}: ${typeof conn[name]}"))
].join('\n'))
}

handler.help = ['rchdebug']
handler.tags = ['tools']
handler.command = ['rchdebug']

export default handler
