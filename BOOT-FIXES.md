# BO-MAIN — correcciones de instalación y arranque

Esta versión parte de `bo-main-fixed` y corrige específicamente los dos errores de instalación reportados:

## 1. Conflicto Jimp / terminal-image / Baileys

Se eliminaron las dependencias directas incompatibles `jimp@0.16.x` y `terminal-image@2.x`.

- `terminal-image` se utilizaba únicamente para mostrar imágenes opcionales en la consola.
- Las operaciones de imagen que sí necesita el bot fueron migradas a `sharp`, que ya formaba parte de las dependencias.
- Esto evita que npm intente resolver simultáneamente `jimp@0.16.x` y el `peerOptional jimp@^1.6.1` declarado por la versión de Baileys utilizada.
- No se utiliza `--force` ni `--legacy-peer-deps` como solución.

Archivos migrados a `sharp`:
- `plugins/_lis.js`
- `plugins/_welcome.js`
- `plugins/_mm.js`
- `plugins/icon.js`

## 2. ERR_MODULE_NOT_FOUND: yargs

`main.js` ya no depende de `yargs`. El bot sólo necesitaba leer unas pocas opciones (`--prefix`, `--img`, `--self`, etc.), por lo que se añadió un parser ESM pequeño y local.

Esto elimina otra dependencia que podía quedar ausente cuando la instalación se detenía antes de completar `npm install`.

## Instalación

En un panel limpio:

```bash
npm install
npm start
```

No ejecutar `npm install --force` ni `npm install --legacy-peer-deps`.

## Comprobación de sintaxis

```bash
npm test
```

## Nota

La conexión real con WhatsApp depende de la versión/commit disponible de Baileys y de la red del servidor. Esta base no incluye credenciales de sesión existentes; la carpeta `sessions/` se crea automáticamente al arrancar.

## Corrección v3 — `proto.WebMessageInfo` en Node.js 22

Se corrigió `lib/simple.js`, que asumía que toda la API de Baileys estaba únicamente dentro del `default export`. En la versión instalada de Baileys, `proto` puede estar expuesto como export ESM nombrado.

Ahora el archivo resuelve `proto`, `makeWASocket`, `downloadContentFromMessage`, `generateWAMessageFromContent` y las demás APIs desde el namespace ESM o desde el default export. Esto evita que `proto` quede `undefined` y que `serialize()` falle en `proto.WebMessageInfo.prototype` durante el arranque.

El aviso `npm warn allow-scripts` no es el error que está deteniendo el proceso; el crash mostrado ocurre después, cuando `main.js` llama `serialize()`.

## Corrección adicional — FFmpeg al crear stickers

Se corrigió `lib/sticker.js`: el código consultaba `global.support.ffmpeg`, pero este proyecto no define `global.support`. Eso provocaba exactamente el error `Cannot read properties of undefined (reading 'ffmpeg')` antes de ejecutar FFmpeg.

También se reforzó el manejo de errores de FFmpeg y se permite definir `FFMPEG_PATH` si el servidor utiliza una ruta distinta a `ffmpeg`. El conversor y el plugin de stickers usan la misma variable.

La dependencia `fluent-ffmpeg` ya estaba presente en `package.json`; recuerda que `fluent-ffmpeg` es el wrapper de Node y el ejecutable `ffmpeg` debe existir en el servidor. En el entorno de Enigma mostrado en la captura, el error observado es de código (`global.support` indefinido), no una ausencia del ejecutable.
