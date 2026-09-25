import { generateWAMessageFromContent } from "@whiskeysockets/baileys";
import fetch from "node-fetch";
import sharp from "sharp";
let handler = async (m, { conn }) => {

        try {
            const iconUrl = global.icono();

            const response = await fetch(iconUrl);

            if (!response.ok) {
                throw new Error(`No se pudo descargar el icono: ${response.status}`);
            }

            const imageBuffer = Buffer.from(
                await response.arrayBuffer()
            );

            // Convertir obligatoriamente a JPEG y reducir tamaño
            const thumbnail = await sharp(imageBuffer)
                .resize(300, 300, {
                    fit: "cover"
                })
                .jpeg({
                    quality: 80
                })
                .toBuffer();

            const rawContent = {
                buttonsMessage: {
                    locationMessage: {
                        degreesLatitude: 0,
                        degreesLongitude: 0,
                        jpegThumbnail: thumbnail
                    },

                    contentText: "prueba de botón",

                    footerText: "Zentríx Bot",

                    buttons: [
                        {
                            buttonId: ".menu",
                            buttonText: {
                                displayText: "📦 Menu"
                            },
                            type: 1
                        },
                        {
                            buttonId: ".perfil",
                            buttonText: {
                                displayText: "👤 Profile"
                            },
                            type: 1
                        }
                    ],

                    headerType: 6
                }
            };

            const msg = generateWAMessageFromContent(
                m.chat,
                rawContent,
                {
                    userJid: conn.user.id
                }
            );

            await conn.relayMessage(
                m.chat,
                msg.message,
                {
                    messageId: msg.key.id
                }
            );

        } catch (error) {
            console.error("❌ Error en testbutton:", error);

            await conn.sendMessage(
                m.chat,
                {
                    text: `❌ Error: ${error.message}`
                },
                {
                    quoted: m
                }
            );
        }
}

handler.help = ["testbutton"]
handler.tags = ["nada"]
handler.command = ["testbutton"]
handler.group = false
handler.botAdmin = false
handler.register = false

export default handler
