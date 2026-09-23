import fetch from 'node-fetch'
let handler = async (m, { conn, usedPrefix, text }) => {
if (!text) throw `🌱 Ingresa el texto que se enviará junto a los botones.`
let txxt = "En la mira mi perrito ☠️, ya valió mdres"
let txxt2 = "quiero de tu lechita🫦"

await conn.sendButton2('120363285614743024@newsletter', text, "Sexo a domicilio, escribanme 🌚🔥", `await (await fetch('https://qu.ax/xSolv')).buffer()`, [], null, [['Comunicarse🫦', `https://wa.me/5213313171411?text=${txxt}`], ['Mi only fans🥰 amores', `https://cdn.aceimg.com/5a683242d.mp4`]], m)
 
await m.reply('Se envío con éxito el texto al canal!')
}
handler.command = ['msg']
handler.owner = true
export default handler
