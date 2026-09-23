import sharp from 'sharp';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { sticker } from '../lib/sticker.js';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG_BIN, args, {
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let stderr = '';

    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', code => {
      if (code === 0) return resolve();

      reject(
        new Error(
          `FFmpeg terminó con código ${code}${
            stderr
              ? `: ${stderr.trim().slice(-1200)}`
              : ''
          }`
        )
      );
    });
  });
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
  const shapeFlags = {
    '-c': 'circle',
    '-t': 'triangle',
    '-d': 'diamond',
    '-g': 'hexagon',
    '-p': 'pentagon',
    '-a': 'heart',
    '-b': 'blob',
    '-l': 'leaf',
    '-n': 'moon',
    '-s': 'star',
    '-z': 'zap',
    '-r': 'curve',
    '-e': 'edges',
    '-m': 'mirror',
    '-f': 'arrow',
    '-x': 'attach',
    '-i': 'expand',
    '-h': 'flip-horizontal',
    '-v': 'flip-vertical'
  };

  const selectedFlag = args.find(arg =>
    Object.keys(shapeFlags).includes(arg)
  );

  const selectedShape = shapeFlags[selectedFlag] || null;

  let q = m.quoted ? m.quoted : m;
  let mime = (q.msg || q).mimetype || q.mediaType || '';
  let img;

  if (/webp|image|video|gif/g.test(mime)) {
    if (
      /video/g.test(mime) &&
      (q.msg || q).seconds > 8
    ) {
      return m.reply(
        '¡El video no puede durar más de 8 segundos!'
      );
    }

    img = await q.download?.();

  } else if (args[0] && isUrl(args[0])) {
    img = await fetch(args[0]).then(res => res.buffer());
    mime = 'image/url';

  } else {
    return conn.reply(
      m.chat,
      `${e} _Responde a una *imagen, video o GIF* para crear un sticker. También puedes agregar una forma personalizada con una opción._

┌🎨 \`Formas disponibles:\`
│
│ ● *Básicas*
│ ├─ -c → Circular
│ ├─ -t → Triangular
│ ├─ -d → Diamante
│ ├─ -g → Hexágono
│ └─ -p → Pentágono
│
│ ● *Decorativas*
│ ├─ -a → Corazón
│ ├─ -b → Burbuja
│ ├─ -l → Hoja
│ ├─ -n → Luna
│ ├─ -s → Estrella
│ └─ -z → Rayo
│
│ ● *Especiales*
│ ├─ -r → Curvado
│ ├─ -e → Esquinas redondeadas
│ ├─ -m → Espejo
│ ├─ -f → Flecha
│ ├─ -x → Acoplado
│ ├─ -i → Ampliado
│ ├─ -h → Horizontal
│ └─ -v → Vertical
└──────────

◈ *Ejemplo:* responde a una imagen con: \`${usedPrefix + command} -a\``,
      m
    );
  }

  m.react('🧩');

  try {

    // VIDEO o GIF sin forma personalizada => sticker animado
    if (
      /video|mp4|gif/.test(mime) &&
      !selectedShape
    ) {
      const tempInputPath = path.join(
        tmpdir(),
        `${randomUUID()}.mp4`
      );

      const tempOutputPath = path.join(
        tmpdir(),
        `${randomUUID()}.webp`
      );

      await fs.writeFile(tempInputPath, img);

      await runFFmpeg([
        '-y',
        '-i',
        tempInputPath,
        '-vf',
        "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=0x00000000",
        '-loop',
        '0',
        '-ss',
        '0',
        '-t',
        '8',
        '-an',
        '-vsync',
        '0',
        '-preset',
        'default',
        '-f',
        'webp',
        tempOutputPath
      ]);

      const animatedSticker =
        await fs.readFile(tempOutputPath);

      await fs.unlink(tempInputPath).catch(() => {});
      await fs.unlink(tempOutputPath).catch(() => {});

      // ENVÍO NORMAL, SIN contextInfo
      return await conn.sendFile(
        m.chat,
        animatedSticker,
        'sticker.webp',
        '',
        m,
        true,
        {
          asSticker: true
        }
      );
    }

    // FRAME ESTÁTICO si es imagen o video con forma
    let frameBuffer = img;

    if (/video|mp4|gif/.test(mime)) {
      const tempInputPath = path.join(
        tmpdir(),
        `${randomUUID()}.mp4`
      );

      const tempOutputPath = path.join(
        tmpdir(),
        `${randomUUID()}.png`
      );

      await fs.writeFile(tempInputPath, img);

      await runFFmpeg([
        '-y',
        '-i',
        tempInputPath,
        '-vf',
        'scale=500:-1',
        '-vframes',
        '1',
        tempOutputPath
      ]);

      frameBuffer =
        await fs.readFile(tempOutputPath);

      await fs.unlink(tempInputPath).catch(() => {});
      await fs.unlink(tempOutputPath).catch(() => {});
    }

    // Transformaciones según forma o flip
    let processed;

    if (selectedShape === 'flip-horizontal') {

      processed = await sharp(frameBuffer)
        .flip()
        .resize(512, 512, {
          fit: 'contain',
          background: {
            r: 0,
            g: 0,
            b: 0,
            alpha: 0
          }
        })
        .webp()
        .toBuffer();

    } else if (selectedShape === 'flip-vertical') {

      processed = await sharp(frameBuffer)
        .flop()
        .resize(512, 512, {
          fit: 'contain',
          background: {
            r: 0,
            g: 0,
            b: 0,
            alpha: 0
          }
        })
        .webp()
        .toBuffer();

    } else if (selectedShape) {

      const masked = await applyShapeMask(
        frameBuffer,
        selectedShape,
        500
      );

      processed = await sharp(masked)
        .ensureAlpha()
        .resize(512, 512, {
          fit: 'contain',
          background: {
            r: 0,
            g: 0,
            b: 0,
            alpha: 0
          }
        })
        .webp()
        .toBuffer();

    } else {

      processed = await sharp(frameBuffer)
        .ensureAlpha()
        .resize(512, 512, {
          fit: 'inside',
          background: {
            r: 0,
            g: 0,
            b: 0,
            alpha: 0
          }
        })
        .webp()
        .toBuffer();
    }

    let stiker = await sticker(
      processed,
      false,
      `${m.pushName}`
    );

    if (stiker) {

      // STICKER NORMAL
      // SIN contextInfo
      // SIN externalAdReply
      // SIN thumbnail
      // SIN forwardingScore
      return await conn.sendFile(
        m.chat,
        stiker,
        'sticker.webp',
        '',
        m,
        true,
        {
          asSticker: true
        }
      );
    }

  } catch (error) {
    console.error(error);

    return conn.reply(
      m.chat,
      `${error} Por favor, envía una imagen o video para hacer un sticker.`,
      m
    );
  }
};

handler.help = ['sticker'];
handler.tags = ['maker'];
handler.group = true;
handler.command = ['s', 'sticker', 'stiker'];

export default handler;

async function applyShapeMask(
  imageBuffer,
  shape = 'circle',
  size = 500
) {
  const svgMask = getSVGMask(shape, size);

  return await sharp(imageBuffer)
    .ensureAlpha()
    .resize(size, size, {
      fit: sharp.fit.fill
    })
    .composite([
      {
        input: Buffer.from(svgMask),
        blend: 'dest-in'
      }
    ])
    .png()
    .toBuffer();
}

function getSVGMask(shape, size) {
  const half = size / 2;
  const quarter = size / 4;
  const threeQuarter = 3 * quarter;
  const radius = size * 0.15;

  switch (shape) {

    case 'circle':
      return `<svg width="${size}" height="${size}">
        <circle
          cx="${half}"
          cy="${half}"
          r="${half}"
          fill="black"
        />
      </svg>`;

    case 'triangle':
      return `<svg width="${size}" height="${size}">
        <polygon
          points="${half},0 ${size},${size} 0,${size}"
          fill="black"
        />
      </svg>`;

    case 'diamond':
      return `<svg width="${size}" height="${size}">
        <polygon
          points="${half},0 ${size},${half} ${half},${size} 0,${half}"
          fill="black"
        />
      </svg>`;

    case 'hexagon':
      return `<svg width="${size}" height="${size}">
        <polygon
          points="${half},0 ${size},${quarter} ${size},${threeQuarter} ${half},${size} 0,${threeQuarter} 0,${quarter}"
          fill="black"
        />
      </svg>`;

    case 'pentagon':
      return `<svg width="${size}" height="${size}">
        <polygon
          points="${half},0 ${size},${quarter} ${(3 * quarter)},${size} ${quarter},${size} 0,${quarter}"
          fill="black"
        />
      </svg>`;

    case 'heart':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 29.6">
        <path
          d="M23.6,0c-2.7,0-5.1,1.3-6.6,3.3C15.5,1.3,13.1,0,10.4,0C4.7,0,0,4.7,0,10.4c0,6,6.2,10.9,15.7,18.5L16,29.6l0.3-0.3C25.8,21.3,32,16.4,32,10.4C32,4.7,27.3,0,21.6,0H23.6z"
          fill="black"
        />
      </svg>`;

    case 'blob':
      return `<svg width="${size}" height="${size}">
        <path
          d="M150 0 C250 50, 250 150, 150 200 C50 250, 0 150, 50 50 Z"
          fill="black"
          transform="scale(${size / 300})"
        />
      </svg>`;

    case 'leaf':
      return `<svg width="${size}" height="${size}">
        <path
          d="M${half},0 C${size},${quarter},${quarter},${size} 0,${size} C0,${half} 0,${quarter} ${half},0 Z"
          fill="black"
        />
      </svg>`;

    case 'moon':
      return `<svg width="${size}" height="${size}">
        <path
          d="M${half},0 A${half},${half} 0 1,0 ${half},${size} A${size * 0.6},${half} 0 1,1 ${half},0 Z"
          fill="black"
        />
      </svg>`;

    case 'star':
      return `<svg width="${size}" height="${size}">
        <polygon
          points="${half},0 ${half + 15},${half - 10} ${size},${half} ${half + 15},${half + 10} ${half},${size} ${half - 15},${half + 10} 0,${half} ${half - 15},${half - 10}"
          fill="black"
        />
      </svg>`;

    case 'zap':
      return `<svg width="${size}" height="${size}">
        <polygon
          points="${half - 20},${half} ${half + 10},${half} ${half - 10},${size} ${half + 30},${half} ${half},${half} ${half + 10},0"
          fill="black"
        />
      </svg>`;

    case 'curve':
      return `<svg width="${size}" height="${size}">
        <path
          d="M0,${size} Q${half},0 ${size},${size} Z"
          fill="black"
        />
      </svg>`;

    case 'edges':
      return `<svg width="${size}" height="${size}">
        <rect
          width="${size}"
          height="${size}"
          rx="${radius}"
          ry="${radius}"
          fill="black"
        />
      </svg>`;

    case 'mirror':
      return `<svg width="${size}" height="${size}">
        <rect
          width="${half}"
          height="${size}"
          x="0"
          fill="black"
        />
      </svg>`;

    case 'arrow':
      return `<svg width="${size}" height="${size}">
        <polygon
          points="0,${half - 50} ${half},${half - 50} ${half},0 ${size},${half} ${half},${size} ${half},${half + 50} 0,${half + 50}"
          fill="black"
        />
      </svg>`;

    case 'attach':
    case 'expand':
      return `<svg width="${size}" height="${size}">
        <rect
          width="${size}"
          height="${size}"
          fill="black"
        />
      </svg>`;

    default:
      throw new Error(
        `Forma no soportada: ${shape}`
      );
  }
}

function isUrl(text) {
  return /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|mp4)$/i.test(text);
}
