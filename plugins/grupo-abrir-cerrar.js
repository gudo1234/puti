const handler = async (m, { conn, args }) => {
    try {
        const chatId = m.chat || m.from;
        if (!chatId) return m.reply(`${e} No se pudo determinar el chat.`);

        const raw = String(
            m.text || m.message?.conversation || ""
        ).trim().toLowerCase();

        const invoked = raw.split(" ")[0].replace(/^[^\w]/, "");
        const arg = args[0] ? args[0].toLowerCase() : null;

        let mode = null;

        if (["abrir", "open"].includes(invoked)) {
            mode = "not_announcement";
        } else if (["cerrar", "close"].includes(invoked)) {
            mode = "announcement";
        } else if (invoked === "grupo") {
            if (["abrir", "open"].includes(arg)) {
                mode = "not_announcement";
            } else if (["cerrar", "close"].includes(arg)) {
                mode = "announcement";
            } else {
                return m.reply(
`⚙️ *Abre o cierra el grupo con:*
• .grupo abrir
• .grupo cerrar
• .abrir
• .cerrar
• .open
• .close`
                );
            }
        }

        if (!mode) return;

        const metadata = await conn.groupMetadata(chatId);
        const current = metadata?.announce ? "announcement" : "not_announcement";

        if (current === mode) {
            if (mode === "announcement") {
                return m.reply(`${e} El grupo *ya está cerrado desde antes*.`);
            } else {
                return m.reply(`${e} El grupo *ya está abierto desde antes*.`);
            }
        }

        await conn.groupSettingUpdate(chatId, mode);

        if (mode === "announcement") {
            await m.reply("🔒 *El grupo ha sido cerrado.*");
        } else {
            await m.reply("🔓 *El grupo ha sido abierto.*");
        }

    } catch (err) {
        console.error("[GRUPO ERROR]", err);
        m.reply("❌ Ocurrió un error al ejecutar el comando.");
    }
};

handler.help = ["grupo"];
handler.tags = ["grupo"];
handler.command = ["grupo", "abrir", "cerrar", "open", "close"];
handler.group = true;
handler.botAdmin = true;
handler.admin = true;

export default handler;
