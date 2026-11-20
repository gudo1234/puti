
import { sticker } from '../lib/sticker.js';
import sharp from 'sharp';

const handler = async (m, { conn, args }) => {
  try {
    let textFinal = args.join(' ') || m.quoted?.text;

    if (!textFinal) {
      return conn.reply(m.chat, `${e} Te faltó el texto.`, m);
    }

    const target = m.quoted?.sender || m.sender;
    textFinal = textFinal.trim();

    if (textFinal.length > 30) {
      await m.react('✖️');
      return conn.reply(m.chat, `${e} El texto no puede tener más de 30 caracteres.`, m);
    }

    await m.react('🕒');

    const pp = await conn.profilePictureUrl(target).catch(
      () => 'https://telegra.ph/file/24fa902ead26340f3df2c.png'
    );

    // Obtener y preparar foto de perfil
    const avatarBuffer = await fetch(pp)
      .then(async res => {
        if (!res.ok) throw new Error('Error al obtener foto');
        return Buffer.from(await res.arrayBuffer());
      })
      .then(buffer => sharp(buffer)
        .resize(220, 220, { fit: 'cover' })
        .png()
        .toBuffer()
      )
      .catch(() => null);

    const escapeXml = str => String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Distribuir el texto en líneas
    const words = textFinal.split(/\s+/);
    const lines = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;

      if (test.length > 13 && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }

    if (current) lines.push(current);

    // Foto de perfil circular de 220x220
    const avatar = avatarBuffer
      ? `<image href="data:image/png;base64,${avatarBuffer.toString('base64')}"
          x="14" y="146" width="220" height="220"
          clip-path="url(#avatar)" />`
      : `<circle cx="124" cy="256" r="110" fill="#888888"/>`;

    // Texto junto al perfil
    const textSvg = lines.map((line, i) => `
      <text x="250" y="${256 - ((lines.length - 1) * 24) + (i * 48)}"
        text-anchor="start"
        dominant-baseline="middle"
        font-family="Arial, sans-serif"
        font-size="38"
        font-weight="bold"
        fill="#ffffff"
        stroke="#222222"
        stroke-width="2"
        paint-order="stroke">${escapeXml(line)}</text>
    `).join('');

    // Imagen transparente
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg"
        width="512" height="512" viewBox="0 0 512 512">

        <defs>
          <clipPath id="avatar">
            <circle cx="124" cy="256" r="110"/>
          </clipPath>
        </defs>

        ${avatar}
        ${textSvg}

      </svg>
    `;

    // Convertir SVG a PNG
    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    // Generar sticker con metadatos
    const stiker = await sticker(
      buffer,
      false,
      textbot,
      author
    );

    if (!Buffer.isBuffer(stiker)) {
      throw new Error('No se pudo generar el sticker.');
    }

    // Enviar sticker normal, sin contextInfo
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