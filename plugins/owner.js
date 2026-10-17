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

        const vcard = [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `N:${author};;;;`,
            `FN:${author}`,
            "ORG:Zentrix-AI;",
            "TITLE:Developer & Owner",
            "TEL;type=CELL;type=VOICE;waid=50492280729:+50492280729",
            "EMAIL:izumilitee@gmail.com",
            "ADR;type=WORK:;;Honduras;;;;",
            "URL:https://www.instagram.com/edi504_",
            "NOTE:ᴢᴇɴᴛʀɪx-ʙᴏᴛ",
            "X-WA-BIZ-NAME:Zentrix-AI",
            "X-WA-BIZ-DESCRIPTION:Desarrollo de software e inteligencia artificial",
            "END:VCARD"
        ].join("\n");

        await conn.sendMessage(
            m.chat,
            {
                contacts: {
                    displayName: author,
                    contacts: [
                        {
                            displayName: author,
                            vcard
                        }
                    ]
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
handler.command = [
    "owner",
    "dueño",
    "desarrollador",
    "creador",
    "edar",
    "zeus"
];

export default handler;
