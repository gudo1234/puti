import fs from 'fs';
import { join } from 'path';

const sessions = 'sessions';
const jadi = global.jadi || 'JadiBots';
const sanSessionPath = join('.', sessions);
const jadiPath = join('.', jadi);
const SESSION_TTL_HOURS = 6;
const CLEAN_INTERVAL_MINUTES = 15;
const CLEAN_INTERVAL_MS = CLEAN_INTERVAL_MINUTES * 60 * 1000;
const SAFE_PREFIXES = ['session-', 'sender-key-'];
let lastCleanupAt = 0;

function isOldEnough(stats) {
  const ageMs = Date.now() - stats.mtimeMs;
  return ageMs >= SESSION_TTL_HOURS * 60 * 60 * 1000;
}

function parseSessionFile(file) {
  if (file === 'creds.json' || !file.endsWith('.json')) return null;
  for (const prefix of SAFE_PREFIXES) {
    if (!file.startsWith(prefix)) continue;
    const jid = file.slice(prefix.length, -'.json'.length);
    if (!jid) return null;
    return { prefix, jid };
  }
  return null;
}

async function cleanSessionFiles(basePath) {
  let files;
  try {
    files = await fs.promises.readdir(basePath);
  } catch {
    return;
  }
  const entries = [];
  for (const file of files) {
    const info = parseSessionFile(file);
    if (!info) continue;
    const fullPath = join(basePath, file);
    let stats;
    try {
      stats = await fs.promises.stat(fullPath);
    } catch {
      continue;
    }
    entries.push({ file, fullPath, stats, key: `${info.prefix}:${info.jid}` });
  }
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.key)) groups.set(entry.key, []);
    groups.get(entry.key).push(entry);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
    const keep = list[0];
    for (const entry of list) {
      if (entry === keep) continue;
      if (!isOldEnough(entry.stats)) continue;
      try {
        await fs.promises.unlink(entry.fullPath);
      } catch (unlinkErr) {
        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
          console.log(`Error al eliminar Session: ${entry.file}: ` + unlinkErr);
        }
      }
    }
  }
}

function cleanJadiBotSessions() {
  fs.readdir(jadiPath, (err, subbotDirs) => {
    if (err) return;
    subbotDirs.forEach((subbotDir) => {
      const subbotPath = join(jadiPath, subbotDir);
      fs.stat(subbotPath, (statErr, stats) => {
        if (statErr || !stats.isDirectory()) return;
        cleanSessionFiles(subbotPath);
      });
    });
  });
}

const handler = async (m, { conn }) => {
  if (Date.now() - lastCleanupAt < CLEAN_INTERVAL_MS) return;
  lastCleanupAt = Date.now();
  cleanSessionFiles(sanSessionPath);
  cleanJadiBotSessions();
};

handler.customPrefix = /😂|😁|🤣|😅|😆|😎|🤖|👾|❤️/;
handler.command = new RegExp(); // así funciona correctamente

export default handler;
