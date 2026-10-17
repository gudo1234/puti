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
            "N:Zentrix-AI;;;;",
            `FN:${author}`,
            "ORG:Zentrix-AI;",
            "TITLE:Artificial Intelligence & Software Development",
            "TEL;TYPE=CELL;TYPE=VOICE;waid=50492280729:+50492280729",
            "EMAIL;TYPE=WORK:izumilitee@gmail.com",
            "ADR;TYPE=WORK:;;Honduras;;;;",
            "URL:https://www.instagram.com/edi504_",
            "URL:https://github.com/gudo1234",
            "NOTE:Zentrix-AI | WhatsApp Bot Development | AI & Automation",
            "X-WA-BIZ-NAME:Zentrix-AI",
            "X-WA-BIZ-DESCRIPTION:Desarrollo de bots de WhatsApp, software e inteligencia artificial.",
            "END:VCARD"
        ].join("\n");

        await conn.relayMessage(m.chat, {
            contactMessage: {
                displayName: author,
                vcard
            }
        }, {
            quoted: m
        });

    } catch (e) {
        console.error("❌ Error en OWNER:", e);
        await m.reply(
            `❌ No se pudo mostrar la tarjeta del propietario.\n\n> ${e.message}`
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
