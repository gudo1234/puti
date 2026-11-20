
import { sticker } from '../lib/sticker.js';
import sharp from 'sharp';

const handler = async (m, { conn, args, usedPrefix, command }) => {
  try {
    let textFinal = args.join(' ') || m.quoted?.text;

    if (!textFinal) {
      return conn.reply(m.chat, `${e} Te faltó el texto.`, m);
    }

    const target = m.quoted?.sender || m.sender;

    if (textFinal.length > 30) {
      await m.react('✖️');
      return conn.reply(m.chat, `${e} El texto no puede tener más de 30 caracteres.`, m);
    }

    await m.react('🕒');

    const pp = await conn.profilePictureUrl(target).catch(
      () => 'https://telegra.ph/file/24fa902ead26340f3df2c.png'
    );

    const nombre = await conn.getName(target);

    const avatarBuffer = await fetch(pp)
      .then(async res => {
        if (!res.ok) throw new Error('No se pudo obtener el avatar.');
        return Buffer.from(await res.arrayBuffer());
      })
      .then(buffer => sharp(buffer)
        .resize(112, 112, { fit: 'cover' })
        .png()
        .toBuffer()
      )
      .catch(() => null);

    const escapeXml = (str) => String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const lines = [];
    let current = '';

    for (const word of textFinal.trim().split(/\s+/)) {
      const test = current ? `${current} ${word}` : word;

      if (test.length > 20 && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }

    if (current) lines.push(current);

    const avatar = avatarBuffer
      ? `<image href="data:image/png;base64,${avatarBuffer.toString('base64')}"
          x="200" y="105" width="112" height="112"
          clip-path="url(#avatar)" />`
      : `<circle cx="256" cy="161" r="56" fill="#444444"/>`;

    const messageSvg = lines.map((line, i) => `
      <text x="256" y="${310 + (i * 48)}"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="34"
        font-weight="bold"
        fill="#ffffff">${escapeXml(line)}</text>
    `).join('');

    const svg = `
      <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="avatar">
            <circle cx="256" cy="161" r="56"/>
          </clipPath>
        </defs>

        <rect width="512" height="512" fill="#000000"/>

        ${avatar}

        <text x="256" y="247"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="28"
          font-weight="bold"
          fill="#ffffff">${escapeXml(nombre)}</text>

        ${messageSvg}
      </svg>
    `;

    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    const stiker = await sticker(
      buffer,
      false,
      textbot,
      author
    );

    if (!Buffer.isBuffer(stiker)) {
      throw new Error('No se pudo generar el sticker.');
    }

    await conn.sendMessage(
      m.chat,
      { sticker: stiker },
      { quoted: m }
    );

    await m.react('✔️');

  } catch (err) {
    console.error(err);
    await m.react('✖️');

    return conn.reply(
      m.chat,
      `${e} Error al generar el sticker: ${err.message}`,
      m
    );
  }
};

handler.help = ['qc'];
handler.tags = ['maker'];
handler.group = true;
handler.command = ['qc'];

export default handler;