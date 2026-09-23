import fetch from "node-fetch";

let handler = async (m, { conn, args }) => {
    try {
        if (!args[0]) {
            return m.reply(`${e} Ingresa un número.\nEjemplo:\n.bancheck 50492280729`);
        }

        const cleanNum = args[0].replace(/\D/g, "");
        const number = "+" + cleanNum;

        await m.react("🕒");

        const url = "https://api.dead.lt/v1/bancheck";
        const params = new URLSearchParams({
            number,
            lang: "es"
        });

        const response = await fetch(`${url}?${params}`, {
            headers: {
                "Accept": "application/json",
                "X-Api-Key": "evil"
            }
        });

        const json = await response.json();

        if (!json.status) {
            await m.react("❌");
            return m.reply("❌ Error: la API no pudo procesar el número.");
        }

        if (!json.data) {
            await m.react("⚠️");
            return m.reply(
                `${e} El número *${json.number}* no está registrado en WhatsApp o no tiene datos disponibles.`
            );
        }

        const d = json.data;

        const txt = `
📞 *Verificación de WhatsApp*
Número: *${json.number}*

*¿Existe en WhatsApp?* ✔️ Sí
*¿Baneado?* ${d.isBanned ? "🚫 Sí" : "✅ No"}

${
d.isBanned
? `
*Suspensión permanente:* ${d.isPermanent ? "Sí" : "No"}
*Tipo de violación:* ${d.violation_type}
*Descripción:* ${d.violation_description}

${e} *Detalles del caso*
➝ ${d.violation_info.description}
➝ *Duración:* ${d.violation_info.duration}
➝ *Riesgo:* ${d.violation_info.risk}
➝ *Estado:* ${d.violation_info.status}
`
: `✔ No tiene registro de bans. El número está limpio.`
}
`.trim();

        await m.react("✅");
        return m.reply(txt);

    } catch (err) {
        console.error(err);
        await m.react("❌");
        return m.reply("❌ Error inesperado al procesar la solicitud.");
    }
};

handler.help = ["bancheck"];
handler.tags = ["herramientas"];
handler.command = ["bancheck", "checkban", "wban"];
handler.group = true;

export default handler;
