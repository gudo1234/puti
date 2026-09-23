let handler = async (m, { conn }) => {
    try {
        await m.react('🕒')
        await m.reply(`🕒 Reiniciando la conexión...\n> Esto tomará unos segundos...`)

        // Reinicio normal de BAILEYS
        setTimeout(() => {
            try {
                conn.ws.close() // Fuerza la reconexión
            } catch {}
        }, 2000)

    } catch (error) {
        conn.reply(m.chat, `${error}`, m)
    }
}

handler.help = ["reiniciar"]
handler.tags = ["owner"]
handler.command = ['restart', 'reiniciar', 'res']
handler.rowner = true

export default handler
