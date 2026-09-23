import moment from 'moment-timezone'

let handler = async (m, { conn }) => {
  m.react('🍉')

  const thumbnail = await (await fetch(icono)).buffer()

  // Fecha y hora en español, Bogotá
  const fechaHoraBOG = moment().tz('America/Bogota').locale('es').format('dddd D [de] MMMM [del] YYYY [a las] h:mm a')

  const txt = `${e} _*Hola ${m.pushName}*_

⚖️ \`Términos y Condiciones del Servicio\`

> ${e} Izubot y su equipo no se hacen responsables por el uso, contenido compartido, privacidad ni números involucrados en las interacciones con el bot.

👥 _El uso de Izubot es bajo tu propia responsabilidad. Se recomienda emplearlo de forma consciente y segura, respetando las normas aplicables y evitando cualquier conducta que pueda afectar la privacidad o seguridad de terceros._

> 🤖 *Este servicio se proporciona “tal cual”, sin garantías explícitas o implícitas. Izubot se reserva el derecho de modificar o interrumpir el servicio en cualquier momento sin previo aviso.*

🗓 *Fecha:* ${fechaHoraBOG}

> © ${new Date().getFullYear()} Izubot. Todos los derechos reservados.`

  await conn.sendMessage(m.chat, {
    text: txt,
    footer: textbot,
    contextInfo: {
      mentionedJid: [m.sender],
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: channelRD.id,
        newsletterName: channelRD.name,
        serverMessageId: -1,
      },
      forwardingScore: 0,
      externalAdReply: {
        title: wm,
        body: textbot,
        thumbnailUrl: redes,
        thumbnail,
        sourceUrl: redes,
        mediaType: 1,
        showAdAttribution: false,
        renderLargerThumbnail: true,
      },
    },
  }, { quoted: m })
}

handler.help = ["reglas"]
handler.tags = ["info"]
handler.command = ['reglas', 'términos', 'condiciones']
export default handler
