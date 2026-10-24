const path = require('path');
const fs = require('fs');
const NodeID3 = require('node-id3');
const axios = require('axios');

const TEMP_DIR = path.join(__dirname, '..', 'temp');

// ─── Binary Paths ─────────────────────────────────────────────────────────────
// yt-dlp: use our bundled bin binary (downloaded by setup.js) or system PATH
const isWindows = process.platform === 'win32';
const YTDLP_PATH = path.join(__dirname, '..', 'bin', isWindows ? 'yt-dlp.exe' : 'yt-dlp');

// ffmpeg: use ffmpeg-static or fallback to system PATH
let FFMPEG_PATH;
try {
  FFMPEG_PATH = require('ffmpeg-static') || 'ffmpeg';
} catch (e) {
  FFMPEG_PATH = 'ffmpeg'; // fallback to PATH
}

/**
 * Get the correct yt-dlp binary path.
 * Uses bundled bin binary if available, otherwise falls back to system PATH.
 */
function getYtDlpPath() {
  if (fs.existsSync(YTDLP_PATH)) return YTDLP_PATH;
  if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
  return 'yt-dlp'; // fallback to system PATH (Docker / Cloud)
}

/**
 * Download image from URL and return as Buffer
 */
async function downloadImageBuffer(url) {
  if (!url) return null;
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return Buffer.from(response.data);
  } catch (e) {
    return null;
  }
}

/**
 * Add ID3 tags to an MP3 file
 */
async function addID3Tags(filePath, { title = '', artist = '', album = '', thumbnail = '', genre = '' }) {
  try {
    const tags = {
      title: title || 'Unknown',
      artist: artist || 'Unknown Artist',
      album: album || artist || 'Unknown Album',
      genre: genre || 'Music',
      encodingTechnology: 'MP3 Downloader Extension v1.0',
    };

    if (thumbnail) {
      const imgBuffer = await downloadImageBuffer(thumbnail);
      if (imgBuffer) {
        tags.image = {
          mime: 'image/jpeg',
          type: { id: 3, name: 'front cover' },
          description: 'Cover',
          imageBuffer: imgBuffer
        };
      }
    }

    NodeID3.write(tags, filePath);
  } catch (err) {
    console.warn('ID3 tagging failed (non-fatal):', err.message);
  }
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 150);
}

module.exports = {
  TEMP_DIR,
  FFMPEG_PATH,
  getYtDlpPath,
  addID3Tags,
  formatDuration,
  sanitizeFilename,
  downloadImageBuffer
};
