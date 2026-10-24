/**
 * setup.js - Cross-platform auto-setup for yt-dlp & FFmpeg
 * Supports Windows, Linux, Docker, and Cloud (Render / Railway)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const isWindows = process.platform === 'win32';
const BIN_DIR = path.join(__dirname, 'bin');
const YTDLP_BIN_NAME = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const YTDLP_PATH = path.join(BIN_DIR, YTDLP_BIN_NAME);
const YTDLP_URL = isWindows
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

function isSystemYtDlpAvailable() {
  try {
    const cmd = isWindows ? 'where yt-dlp' : 'which yt-dlp';
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

async function downloadFile(url, destPath, label) {
  return new Promise((resolve, reject) => {
    console.log(`⬇  Downloading ${label}...`);

    const file = fs.createWriteStream(destPath);

    function doRequest(reqUrl) {
      https.get(reqUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          file.destroy();
          return doRequest(res.headers.location);
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${reqUrl}`));
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        let lastPercent = -1;

        res.on('data', chunk => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = Math.floor((downloaded / total) * 100);
            if (pct !== lastPercent && pct % 10 === 0) {
              process.stdout.write(`\r   ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
              lastPercent = pct;
            }
          }
        });

        res.pipe(file);
        file.on('finish', () => {
          console.log(`\n✅  ${label} downloaded!`);
          file.close(() => {
            if (!isWindows) {
              try { fs.chmodSync(destPath, 0o755); } catch (e) {}
            }
            resolve();
          });
        });
      }).on('error', err => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    doRequest(url);
  });
}

async function setup() {
  console.log('\n══════════════════════════════════════');
  console.log('  MP3 Downloader Backend – Auto Setup');
  console.log('══════════════════════════════════════\n');

  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
    console.log('📁  Created bin/ directory');
  }

  // 1. Check yt-dlp
  if (isSystemYtDlpAvailable()) {
    console.log('✅  System yt-dlp found in PATH');
  } else if (fs.existsSync(YTDLP_PATH)) {
    const stats = fs.statSync(YTDLP_PATH);
    const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    if (ageDays < 30) {
      console.log(`✅  Local ${YTDLP_BIN_NAME} already present`);
    } else {
      console.log(`🔄  Local ${YTDLP_BIN_NAME} is older than 30 days, updating...`);
      await downloadFile(YTDLP_URL, YTDLP_PATH, YTDLP_BIN_NAME);
    }
  } else {
    await downloadFile(YTDLP_URL, YTDLP_PATH, YTDLP_BIN_NAME);
  }

  // 2. Check FFmpeg
  try {
    const ffmpegPath = require('ffmpeg-static');
    console.log('✅  FFmpeg available at:', ffmpegPath);
  } catch (e) {
    try {
      execSync(isWindows ? 'where ffmpeg' : 'which ffmpeg', { stdio: 'ignore' });
      console.log('✅  System FFmpeg found in PATH');
    } catch (err) {
      console.warn('⚠   FFmpeg not found. Install ffmpeg on system or run npm install.');
    }
  }

  console.log('\n🚀  Setup complete! Starting server...\n');
}

module.exports = { setup, YTDLP_PATH, BIN_DIR };
