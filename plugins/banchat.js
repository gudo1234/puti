let handler = async (m, { conn, isAdmin, isROwner }) => {
    if (!(isAdmin || isROwner)) return dfail('admin', m, conn)
    global.db.data.chats[m.chat].isBanned = true
    await conn.reply(m.chat, `🚩 Chat Baneado con exito.`, m)
    await m.react('✅')
}
handler.help = ['banchat']
handler.tags = ['owner']
handler.command = ['banearbot', 'banchat']
handler.group = true 
export default handler
