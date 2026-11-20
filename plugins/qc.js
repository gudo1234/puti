
import { sticker } from '../lib/sticker.js';
import sharp from 'sharp';

const handler = async (m, { conn, args, usedPrefix, command }) => {
  try {
    let text;

    if (args.length >= 1) {
      text = args.join(' ');
    } else if (m.quoted && m.quoted.text) {
      text = m.quoted.text;
    } else {
      return conn.reply(m.chat, `${e} Te faltó el texto.`, m);
    }

    if (!text) {
      return conn.reply(m.chat, `${e} Te faltó el texto.`, m);
    }

    const who = m.mentionedJid?.[0] || (m.quoted?.sender || m.sender);
    const mentionRegex = new RegExp(
      `@${who.split('@')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`,
      'g'
    );

    const mishi = text.replace(mentionRegex, '').trim();

    if (mishi.length > 30) {
      await m.react('✖️');
      return conn.reply(m.chat, `${e} El texto no puede tener más de 30 caracteres.`, m);
    }

    await m.react('🕒');

    const pp = await conn.profilePictureUrl(who).catch(
      () => 'https://telegra.ph/file/24fa902ead26340f3df2c.png'
    );

    const nombre = await conn.getName(who);

    const thumbnail = await (await fetch(icono)).buffer();

    const avatar = await (await fetch(pp)).arrayBuffer().catch(() => null);

    const width = 512;
    const height = 768;

    const escapeXml = (str) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const lines = [];
    const words = mishi.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;

      if (test.length > 19 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }

    if (currentLine) lines.push(currentLine);

    const textSvg = lines.map((line, index) => `
      <text x="256" y="${350 + index * 48}"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="34"
        font-weight="bold"
        fill="#ffffff">${escapeXml(line)}</text>
    `).join('');

    const avatarSvg = avatar
      ? `<image href="data:image/jpeg;base64,${Buffer.from(avatar).toString('base64')}"
          x="216" y="115" width="80" height="80"
          clip-path="url(#circle)" preserveAspectRatio="xMidYMid slice"/>`
      : `<circle cx="256" cy="155" r="40" fill="#555555"/>`;

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="circle">
            <circle cx="256" cy="155" r="40"/>
          </clipPath>
        </defs>
        <rect width="100%" height="100%" fill="#000000"/>
        ${avatarSvg}
        <text x="256" y="225" text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="25" font-weight="bold"
          fill="#ffffff">${escapeXml(nombre)}</text>
        ${textSvg}
      </svg>
    `;

    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    const stiker = await sticker(buffer, false, `${m.pushName}`);

    if (!stiker || !Buffer.isBuffer(stiker)) {
      throw new Error('No se pudo generar el sticker.');
    }

    await conn.sendFile(
      m.chat,
      stiker,
      'qc.webp',
      '',
      m,
      true,
      {
        contextInfo: {
          forwardingScore: 200,
          isForwarded: false,
          externalAdReply: {
            showAdAttribution: false,
            title: `${m.pushName}`,
            body: textbot,
            mediaType: 1,
            sourceUrl: redes,
            thumbnailUrl: redes,
            thumbnail
          }
        }
      },
      { quoted: m }
    );

    await m.react('✔️');

  } catch (err) {
    console.error(err);
    await m.react('✖️');
    return conn.reply(m.chat, `${e} Error al generar el sticker: ${err.message}`, m);
  }
};

handler.help = ['qc'];
handler.tags = ['maker'];
handler.group = true;
handler.command = ['qc'];

export default handler;