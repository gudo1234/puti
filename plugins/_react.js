let handler = async (m, { conn }) => {
const names = [
'newsletterReactMessage',
'newsletterMetadata',
'newsletterFetchMessages'
]

let output = 'DIAGNÓSTICO DE BAILEYS\n\n'

for (const name of names) {
output += name + ': ' + typeof conn[name] + '\n'
}

output += '\nOTROS MÉTODOS:\n'

let obj = conn
const methods = new Set()

while (obj && obj !== Object.prototype) {
for (const name of Object.getOwnPropertyNames(obj)) {
if (/newsletter|channel/i.test(name)) {
methods.add(name)
}
}
obj = Object.getPrototypeOf(obj)
}

output += methods.size
? Array.from(methods).sort().join('\n')
: 'No se encontraron métodos adicionales.'

return m.reply(output)
}

handler.help = ['rchdebug']
handler.tags = ['tools']
handler.command = ['rchdebug']

export default handler
