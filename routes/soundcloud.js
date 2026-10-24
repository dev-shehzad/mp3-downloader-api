const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ytDlpExec = require('yt-dlp-exec');
const { addID3Tags, TEMP_DIR, FFMPEG_PATH, getYtDlpPath } = require('../utils/helpers');

// Create yt-dlp caller that uses our bundled binary
function ytDlp(url, options) {
  return ytDlpExec(url, {
    ...options,
    binaryPath: getYtDlpPath(),
    ...(FFMPEG_PATH !== 'ffmpeg' ? { ffmpegLocation: path.dirname(FFMPEG_PATH) } : {})
  });
}

// GET /api/soundcloud/info?url=...
router.get('/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const info = await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
    });

    if (info.entries) {
      return res.json({
        type: 'playlist',
        title: info.title,
        uploader: info.uploader || '',
        count: info.entries.length,
        entries: info.entries.map(e => ({
          id: e.id,
          title: e.title,
          duration: e.duration,
          url: e.url || e.webpage_url,
          thumbnail: e.thumbnail,
          uploader: e.uploader || info.uploader || ''
        }))
      });
    } else {
      return res.json({
        type: 'track',
        id: info.id,
        title: info.title,
        uploader: info.uploader || info.creator || '',
        duration: info.duration,
        thumbnail: info.thumbnail,
        genre: info.genre || '',
        url: url
      });
    }
  } catch (err) {
    console.error('SoundCloud info error:', err.message);
    res.status(500).json({ error: 'Failed to fetch track info.' });
  }
});

// GET & POST /api/soundcloud/download
router.all('/download', async (req, res) => {
  req.setTimeout(0); // Disable timeout for large downloads
  const url = req.query.url || req.body?.url;
  const title = req.query.title || req.body?.title || 'track';
  const uploader = req.query.uploader || req.body?.uploader || '';
  const thumbnail = req.query.thumbnail || req.body?.thumbnail || '';
  const genre = req.query.genre || req.body?.genre || '';

  if (!url) return res.status(400).json({ error: 'URL is required' });

  const fileId = uuidv4();
  const safeTitle = title.replace(/[^\w\s-]/g, '').trim().substring(0, 100) || 'track';
  const outputPath = path.join(TEMP_DIR, `${fileId}.mp3`);

  try {
    await ytDlp(url, {
      output: outputPath,
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '0',
      postprocessorArgs: 'ffmpeg:-b:a 320k -ar 44100',
      noWarnings: true,
      noCheckCertificates: true,
    });

    if (fs.existsSync(outputPath)) {
      await addID3Tags(outputPath, { title: safeTitle, artist: uploader, thumbnail, genre });
    }

    const filename = encodeURIComponent(`${safeTitle}.mp3`);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.setHeader('Content-Type', 'audio/mpeg');

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on('end', () => { try { fs.unlinkSync(outputPath); } catch (e) {} });
    stream.on('error', () => { try { fs.unlinkSync(outputPath); } catch (e) {} });

  } catch (err) {
    console.error('SoundCloud download error:', err.message);
    if (fs.existsSync(outputPath)) { try { fs.unlinkSync(outputPath); } catch (e) {} }
    res.status(500).json({ error: `Download failed: ${err.message}` });
  }
});

// GET /api/soundcloud/search-page?url=...&keyword=...
router.get('/search-page', async (req, res) => {
  const { url, keyword = '' } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const info = await ytDlp(url, {
      dumpSingleJson: true,
      flatPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
      playlistEnd: 200,
    });

    let entries = info.entries || (info.id ? [info] : []);
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      entries = entries.filter(e =>
        (e.title || '').toLowerCase().includes(kw) ||
        (e.uploader || '').toLowerCase().includes(kw)
      );
    }

    res.json({
      type: 'list',
      total: entries.length,
      keyword,
      entries: entries.map(e => ({
        id: e.id,
        title: e.title || 'Unknown',
        duration: e.duration,
        url: e.url || e.webpage_url,
        thumbnail: e.thumbnail,
        uploader: e.uploader || ''
      }))
    });
  } catch (err) {
    console.error('SC search page error:', err.message);
    res.status(500).json({ error: 'Failed to fetch page tracks.' });
  }
});

module.exports = router;
