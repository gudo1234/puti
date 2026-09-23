import PhoneNumber from "awesome-phonenumber";

function detectarJid(m) {
    if (m.quoted?.sender) return m.quoted.sender;

    const mention = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mention?.length) return mention[0];

    if (m.text) {
        let numero = m.text.replace(/\D/g, "");

        if (numero.length >= 6) {
            const pn = new PhoneNumber("+" + numero);
            if (pn.isValid()) {
                return pn.getNumber("rfc3966").replace("tel:+", "") + "@s.whatsapp.net";
            }
            return numero + "@s.whatsapp.net";
        }
    }

    return null;
}

const handler = async (m, { conn, args }) => {
    const jid = detectarJid(m);

    if (!jid) {
        return m.reply("❌ Menciona, responde o escribe el número del usuario para dar admin.");
    }

    try {
        await conn.groupParticipantsUpdate(m.chat, [jid], "promote");
        await m.react("✅");
    } catch (error) {
        console.error("[PROMOTE ERROR]", error);
        m.reply("❌ Error al dar admin.");
    }
};

handler.help = ["promote"];
handler.tags = ["grupo"];
handler.command = ["promote", "daradmin"];
handler.group = true;
handler.botAdmin = true;
handler.admin = true;
handler.onlyAdmin = true;

export default handler;
