import sharp from 'sharp';
import { S_WHATSAPP_NET } from '@whiskeysockets/baileys'

let handler = async (m, { conn, usedPrefix, command, args, isOwner, isAdmin, isROwner }) => {
  try {
    let groupId = m.chat;
    let quotedMsg = m.quoted ? m.quoted : m
    if (!m.quoted) return m.reply(`${e} *Responde a una Imagen.*`)
    let mediaType = (quotedMsg.type || quotedMsg).mimetype || '';
    var media = await quotedMsg.download();
    async function processImage(media) {
      const img = await sharp(media)
        .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: false })
        .jpeg()
        .toBuffer();
      return { img };
    }
    var { img: processedImage } = await processImage(media);
    conn.query({
                tag: 'iq',
                attrs: {
                    target: undefined,
                    to: S_WHATSAPP_NET,
                    type:'set',
                    xmlns: 'w:profile:picture'
                },
                content: [
                    {
                        tag: 'picture',
                        attrs: { type: 'image' },
                        content: processedImage
                    }
                ]
            })
  m.reply(`${e} *Imagen actualizada.*`);
  } catch (error) {
    m.reply(String(error))
  return m.react('❌');

  }
};

handler.help = ["icon"]
handler.tags = ["owner"]
handler.command = ['setppbot', 'icon'];
handler.owner = true;

export default handler;
