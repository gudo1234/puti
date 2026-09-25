
let handler = async (m, { conn }) => {

        try {
            await m.react("🔎");

            const grupos = await conn.groupFetchAllParticipating();

            const lista = Object.values(grupos || {});

            if (!lista.length) {
                return m.reply(
                    "❌ El bot no está unido a ningún grupo."
                );
            }

            // ==========================================
            // IDENTIFICAR AL BOT
            // ==========================================

            const botId =
                conn.user?.id?.replace(/:\d+/g, "") || "";

            const botJid =
                conn.user?.jid?.replace(/:\d+/g, "") ||
                botId;

            const botLid =
                conn.user?.lid?.replace(/:\d+/g, "") || "";

            const botIdClean =
                botId.split("@")[0];

            const botJidClean =
                botJid.split("@")[0];

            const botLidClean =
                botLid.split("@")[0];

            // ==========================================
            // COMPROBAR SI EL PARTICIPANTE ES EL BOT
            // ==========================================

            function esElBot(participant) {
                const ids = [
                    participant?.id,
                    participant?.phoneNumber,
                    participant?.lid
                ]
                    .filter(Boolean)
                    .map(v =>
                        String(v)
                            .replace(/:\d+/g, "")
                            .trim()
                    );

                const numeros = ids.map(v =>
                    v.split("@")[0]
                );

                return (
                    ids.includes(botId) ||
                    ids.includes(botJid) ||
                    ids.includes(botLid) ||
                    numeros.includes(botIdClean) ||
                    numeros.includes(botJidClean) ||
                    numeros.includes(botLidClean)
                );
            }

            // ==========================================
            // PROCESAR GRUPOS
            // ==========================================

            let texto =
                `📋 *GRUPOS DONDE ESTÁ ${conn.user?.name || "EL BOT"}*\n\n`;

            let contador = 0;

            for (const grupo of lista) {
                try {
                    const groupId = grupo.id;

                    const metadata =
                        await conn.groupMetadata(groupId);

                    if (!metadata) continue;

                    const participantes =
                        metadata.participants || [];

                    const botParticipant =
                        participantes.find(esElBot);

                    // Si por alguna razón no aparece el bot,
                    // no mostrar ese grupo.
                    if (!botParticipant) continue;

                    const esAdmin =
                        botParticipant.admin === "admin" ||
                        botParticipant.admin === "superadmin";

                    const nombre =
                        metadata.subject ||
                        grupo.subject ||
                        "Sin nombre";

                    const miembros =
                        participantes.length;

                    let link =
                        "No disponible";

                    // ==========================================
                    // LINK SOLO SI EL BOT ES ADMIN
                    // ==========================================

                    if (esAdmin) {
                        try {
                            const code =
                                await conn.groupInviteCode(groupId);

                            if (code) {
                                link =
                                    `https://chat.whatsapp.com/${code}`;
                            }
                        } catch {
                            link = "No disponible";
                        }
                    }

                    contador++;

                    texto +=
                        `#${contador} *Nombre:* ${nombre}\n`;

                    texto +=
                        `Admon: ${esAdmin ? "Si" : "No"}\n`;

                    texto +=
                        `Miembros: ${miembros}\n`;

                    texto +=
                        `Link: ${link}\n\n`;

                } catch (e) {
                    console.error(
                        `❌ Error obteniendo grupo ${grupo?.id}:`,
                        e.message
                    );
                }
            }

            if (!contador) {
                return m.reply(
                    "❌ No pude obtener información de los grupos."
                );
            }

            texto +=
                `> Total de grupos: *${contador}*`;

            await m.react("✅");

            return m.reply(texto);

        } catch (e) {
            console.error(
                "❌ Error en grupos:",
                e
            );

            await m.react("✖️");

            return m.reply(
                "❌ No pude obtener la información de los grupos."
            );
        }
}

handler.help = ["f1"]
handler.tags = ["owner"]
handler.command = ["f1"]
handler.owner = true

export default handler
