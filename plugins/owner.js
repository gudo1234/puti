let handler = async (m, { conn }) => {
    try {

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
N:${author};;;;
FN:${author}
ORG:Zentrix-AI;
TITLE:Developer & Owner
item1.TEL;waid=50492280729:+50492280729
item1.X-ABLabel:Empresa
X-WA-BIZ-NAME:Zentrix-AI
X-WA-BIZ-DESCRIPTION:Desarrollo de software e inteligencia artificial
TEL;type=CELL;type=VOICE;waid=50492280729:+50492280729
EMAIL:izumilitee@gmail.com
ADR;type=WORK:;;Honduras;;;;
URL:https://www.instagram.com/edi504_
NOTE:ᴢᴇɴᴛʀɪx-ʙᴏᴛ
END:VCARD`;

        await conn.sendMessage(
            m.chat,
            {
                contacts: {
                    displayName: "Zentrix-AI",
                    contacts: [{
                        displayName: "Zentrix-AI",
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
};

handler.help = ["owner"];
handler.tags = ["main"];
handler.command = ["owner", "dueño", "desarrollador", "creador", "edar", "zeus"];

export default handler;
