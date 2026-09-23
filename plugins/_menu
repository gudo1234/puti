const handler = async (m, { conn, usedPrefix }) => {
    let categorias = {}

    for (const plugin of Object.values(global.plugins)) {
        const h = plugin.default || plugin
        if (!h || !h.help || !h.tags) continue

        const helps = Array.isArray(h.help) ? h.help : [h.help]
        const tags = Array.isArray(h.tags) ? h.tags : [h.tags]

        for (const tag of tags) {
            if (!categorias[tag]) categorias[tag] = []
            categorias[tag].push(...helps)
        }
    }

    let text = `🤖 *MENÚ DE COMANDOS*\n━━━━━━━━━━━━━━\n`

    for (const tag of Object.keys(categorias).sort()) {
        text += `\n╭─❏ *${tag.toUpperCase()}*\n`
        for (const cmd of [...new Set(categorias[tag])]) {
            text += `│ • ${usedPrefix}${cmd}\n`
        }
        text += `╰────────────\n`
    }
m.react(e)
    m.reply(`[\n${text}\n]`)
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = ['menu', 'help', 'comandos', 'menú', 'm', 'memu']

export default handler
