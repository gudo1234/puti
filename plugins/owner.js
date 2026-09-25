
let handler = async (m, { conn }) => {

        try {
            const nombre =
                "🍁̶͢͞▻⟅ẹ𝆊ϋ⟆٭⳺֟፝͜⳻٭.er/k";

            const emojis = [
                "🍎", "🍒", "🍉", "🍊", "🍋",
                "🍏", "🍌", "🍍", "🍓", "🍇",
                "🍈", "🍒", "🍑", "🥭", "🍐",
                "🥥", "🍋‍🟩"
            ];

            for (let i = 0; i < emojis.length; i++) {
                setTimeout(async () => {
                    try {
                        await m.react(emojis[i]);
                    } catch {}
                }, i * 1000);
            }

            const vcard =
`BEGIN:VCARD
VERSION:3.0
N:${nombre};;;
FN:${nombre}
ORG:Zentrix Bot
TITLE:Developer & Owner
TEL;type=CELL;type=VOICE;waid=50492280729:+504 9228 0727
TEL;type=WORK;type=VOICE:+504 9228 0729
EMAIL:izumilitee@gmail.com
ADR;type=WORK:;;Honduras;;;;
URL:https://www.instagram.com/edi504_
NOTE:ᴢᴇɴᴛʀɪx-ʙᴏᴛ
END:VCARD`;

            await conn.sendMessage(
                m.chat,
                {
                    contacts: {
                        contacts: [{
                            displayName: nombre,
                            vcard
                        }]
                    }
                },
                {
                    quoted: m
                }
            );

        } catch (e) {
            console.error("❌ Error en OWNER:", e);

            await m.reply(
                `❌ No se pudo mostrar la información del propietario.\n\n> ${e.message}`
            );
        }
}

handler.help = ["owner"]
handler.tags = ["main"]
handler.command = ["owner", "dueño", "desarrollador", "creador", "edar", "zeus"]

export default handler
