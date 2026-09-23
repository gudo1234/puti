import os from 'os';
import fs from 'fs';

const handler = async (m, { conn }) => {
  const start = Date.now();
  let netInfo = null;
  try {
    netInfo = readNetDev();
  } catch {
    netInfo = null;
  }
  const latency = Date.now() - start;
  const uptime = formatUptime(process.uptime());
  const mem = getMemory();
  const cpu = getCpuInfo();
  const load = os.loadavg().map(n => n.toFixed(2)).join(' / ');
  const hostname = os.hostname();
  const platform = `${os.platform()} ${os.release()}`;
  const arch = os.arch();
  const node = process.version;
  const pid = process.pid;
  const disk = await getDiskUsage();

  const tag = (botname || wm || 'BOT').toString().toUpperCase();
  const lines = [
    '┏━━━〔 🛰️ ESTADO SISTEMA 〕━━━┓',
    `┃ ${tag}`,
    '┣━━━━━━━━━━━━━━━━━━━┫',
    `┃ ⏱️  Uptime : ${uptime}`,
    `┃ ⚡ Latency: ${latency} ms`,
    `┃ 🆔 PID    : ${pid}`,
    '┣━━━━━━━━━━━━━━━━━━━┫',
    `┃ 💻 Host   : ${hostname}`,
    `┃ 🧭 OS     : ${platform} (${arch})`,
    `┃ 🧩 Node   : ${node}`,
    '┣━━━━━━━━━━━━━━━━━━━┫',
    `┃ 🧠 CPU    : ${cpu.model}`,
    `┃ 🧮 Cores  : ${cpu.cores}   ⛽ Load: ${load}`,
    `┃ 🧵 RAM    : ${mem.used} / ${mem.total} (${mem.percent}%)`,
    disk ? `┃ 💽 Disk   : ${disk.used} / ${disk.total} (${disk.percent}%)` : '┃ 💽 Disk   : n/d',
    '┣━━━━━━━━━━━━━━━━━━━┫',
    netInfo
      ? `┃ 🌐 Net    : RX ${netInfo.rx} | TX ${netInfo.tx}`
      : '┃ 🌐 Net    : n/d',
    '┗━━━━━━━━━━━━━━━━━━━┛',
  ];

  const msg = lines.join('\n');
  await conn.sendMessage(m.chat, { text: msg }, { quoted: m });
};

handler.help = ['status'];
handler.tags = ['info'];
handler.command = ['status', 'estado', 'vps'];
export default handler;

function formatUptime(seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor((seconds / 3600) % 24);
  const d = Math.floor(seconds / 86400);
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  return `${h}h ${m}m ${s}s`;
}

function getMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total: formatBytes(total),
    used: formatBytes(used),
    percent: ((used / total) * 100).toFixed(1),
  };
}

function getCpuInfo() {
  const cpus = os.cpus();
  const model = cpus?.[0]?.model?.trim() || 'Unknown';
  return { model, cores: cpus.length };
}

function readNetDev() {
  const data = fs.readFileSync('/proc/net/dev', 'utf8');
  const lines = data.split('\n').slice(2);
  let rx = 0;
  let tx = 0;
  for (const line of lines) {
    const parts = line.replace(/:/, ' ').trim().split(/\s+/);
    if (parts.length < 10) continue;
    const iface = parts[0];
    if (iface === 'lo') continue;
    rx += Number(parts[1] || 0);
    tx += Number(parts[9] || 0);
  }
  return { rx: formatBytes(rx), tx: formatBytes(tx) };
}

async function getDiskUsage() {
  try {
    const { exec } = await import('child_process');
    const out = await new Promise((resolve, reject) => {
      exec('df -k /', (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
      });
    });
    const lines = out.trim().split('\n');
    if (lines.length < 2) return null;
    const cols = lines[1].trim().split(/\s+/);
    const total = Number(cols[1]) * 1024;
    const used = Number(cols[2]) * 1024;
    if (!total || !used) return null;
    return {
      total: formatBytes(total),
      used: formatBytes(used),
      percent: ((used / total) * 100).toFixed(1),
    };
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}
