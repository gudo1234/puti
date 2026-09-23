import PhoneNumber from "awesome-phonenumber";

function getRealNumber(participant) {
    let raw = null;

    if (participant.jid && participant.jid.endsWith("@s.whatsapp.net")) {
        raw = participant.jid.split("@")[0];
    } else if (participant.id && participant.id.endsWith("@s.whatsapp.net")) {
        raw = participant.id.split("@")[0];
    }

    if (!raw) return null;

    const pn = new PhoneNumber("+" + raw);
    if (!pn.isValid()) return null;

    return pn.getNumber("e164");
}

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

var handler = async (m, { conn, participants, args, usedPrefix, command }) => {
    const groupInfo = await conn.groupMetadata(m.chat);
    const ownerGroup = groupInfo.owner || `${m.chat.split`-`[0]}@s.whatsapp.net`;
    const ownerBot = `${global.owner[0][0]}@s.whatsapp.net`;
    const admins = participants.filter(p => p.admin).map(p => p.id);

    const userJid = detectarJid(m);

if (userJid) {
    if (userJid === m.sender)
        return m.reply(`${e} No puedo eliminarte a ti mismo.`);

    if (userJid === conn.user.jid)
        return conn.reply(m.chat, `${e} No puedo eliminarme yo (bot) del grupo.`, m);

    if (userJid === ownerGroup)
        return conn.reply(m.chat, `${e} No puedo eliminar al propietario del grupo.`, m);

    if (userJid === ownerBot)
        return conn.reply(m.chat, `${e} No puedo eliminar al propietario del bot.`, m);

    if (admins.includes(userJid))
        return conn.reply(m.chat, `${e} No puedo eliminar a otro administrador del grupo.`, m);

    await conn.groupParticipantsUpdate(m.chat, [userJid], 'remove');
    return;
}
    if (args[0] && !isNaN(args[0])) {
        const prefix = "+" + args[0].replace(/\D/g, "");

        let targets = participants.filter(p => {
            if (p.id === conn.user.jid) return false;
            if (p.id === ownerGroup) return false;
            if (p.id === ownerBot) return false;
            if (admins.includes(p.id)) return false;

            const real = getRealNumber(p);
            if (!real) return false;

            return real.startsWith(prefix);
        }).map(p => p.id);

        if (!targets.length)
            return conn.reply(m.chat, `${e} *No se encontró ningún usuario con el prefijo* ${prefix}`, m);

        conn.reply(m.chat, `${e} *Expulsando ${targets.length} usuario(s) con el prefijo ${prefix}*`, m);

        for (const id of targets) {
            await conn.groupParticipantsUpdate(m.chat, [id], "remove");
            await new Promise(r => setTimeout(r, 2500));
        }

        return conn.reply(m.chat, "✅ *Expulsión finalizada.*", m);
    }

    const candidates = participants.filter(p => 
        p.id !== conn.user.jid &&
        p.id !== ownerGroup &&
        p.id !== ownerBot
    );
    const randomUser = candidates[Math.floor(Math.random() * candidates.length)]?.id || 'usuario@s.whatsapp.net';

    return conn.reply(m.chat, `${e} *Ejemplos de uso:*\n` +
        `✑ _Para expulsar a un usuario usa:_ \`${usedPrefix + command}\` @${randomUser.split('@')[0]}\n` +
        `> Para expulsar a todos los usuarios cuyo número comienza con un prefijo específico: *${usedPrefix + command} <prefijo>*\n\n` +
        `*Ejemplo:* \`${usedPrefix + command}\` 212 (esto expulsará a todos los usuarios cuyo número comience con +212)`,
        m, {
            mentions: [randomUser]
        }
    );
};

handler.help = ["kick"];
handler.tags = ["grupo"];
handler.command = ['ban', 'kick', 'echar', 'hechar', 'b', 'bam', 'kicknum'];
handler.admin = true;
handler.group = true;
handler.botAdmin = true;

export default handler;
