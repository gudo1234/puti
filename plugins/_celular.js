import PhoneNumber from "awesome-phonenumber";

let handler = async (m, { conn, args }) => {

    if (!args.length) {
        return m.reply("✳️ Usa:\n.enviar 50488723207");
    }

    // 🔥 Unir todo (para +504 8872-3207 etc)
    let numero = args.join("").replace(/\D/g, "");

    const pn = new PhoneNumber("+" + numero);
    if (!pn.isValid()) {
        return m.reply("❌ Número inválido");
    }

    let jid = numero + "@s.whatsapp.net";

    /*let txt = `📱✨ *iPhone 15 (128GB)* ✨

- 🔥 Potencia y estilo en tus manos
- 📸 Cámara impresionante
- ⚡ Rendimiento ultra rápido

💬 *Disponible ahora*
👉 ¡Cotiza sin compromiso!`;*/

    // 🧠 TRUCO CLAVE: abrir chat primero
    await conn.sendPresenceUpdate("composing", jid);

    // ⏳ pequeño delay (importante)
    await new Promise(r => setTimeout(r, 1200));

    let txt = `📱✨ *iPhone 15 (128GB)* ✨

- 🔥 Potencia y estilo en tus manos
- 📸 Cámara impresionante
- ⚡ Rendimiento ultra rápido

💬 *Disponible ahora*
👉 ¡Cotiza sin compromiso!`

    await conn.sendButton2(
        jid,
        txt,
        '📱 *Diarcel Store*',
        cel,
        [],
        null,
        [
            [
                '🛒 Comprar ahora',
                `https://wa.me/50498511183?text=👋+Hola,+me+interesa+el+iPhone+15+de+128GB,+¿me+puedes+dar+más+información?+`
            ],
            []
        ],
        null
    )

    m.react("✅")
};

handler.command = ['enviar'];

export default handler;
