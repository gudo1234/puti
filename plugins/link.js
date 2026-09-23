const handler = async (m, { conn }) => {
    try {
        await m.react("🔗");

        const groupId = m.chat;
        const inviteCode = await conn.groupInviteCode(groupId);

        if (!inviteCode)
            return m.reply("❌ No pude obtener el enlace del grupo.");

        const link = `https://chat.whatsapp.com/${inviteCode}`;

        await conn.sendMessage(
            groupId,
            { text: `🔗 *Enlace del grupo:*\n${link}` },
            { quoted: m }
        );

        await m.react("✅");

    } catch (err) {
        console.error("[LINK ERROR]", err);
        m.reply("❌ Ocurrió un error al obtener el enlace.");
    }
};

handler.help = ["link"];
handler.tags = ["grupo"];
handler.command = ["link", "enlace"];
handler.group = true;
handler.botAdmin = true;

export default handler;
