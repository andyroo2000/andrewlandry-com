import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

/** @param {number} size @param {string} suffix */
function suffixStart(size, suffix) {
  const length = Number(suffix);
  if (!Number.isSafeInteger(length) || length <= 0) throw new RangeError();
  return Math.max(0, size - length);
}

/** @param {string} range */
function rangeParts(range) {
  const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!parts) throw new RangeError();
  if (!(parts[1] || parts[2])) throw new RangeError();
  return parts;
}

/** @param {string[]} parts @param {number} size */
function rangeEnd(parts, size) {
  if (!parts[1] || !parts[2]) return size - 1;
  return Math.min(Number(parts[2]), size - 1);
}

/** @param {string | undefined} range @param {number} size */
function byteRange(range, size) {
  if (!range) return { start: 0, end: size - 1, partial: false };
  const parts = rangeParts(range);
  const start = parts[1] ? Number(parts[1]) : suffixStart(size, parts[2]);
  const end = rangeEnd(parts, size);
  if (![start, end].every(Number.isSafeInteger)) throw new RangeError();
  if (start > end || start >= size) throw new RangeError();
  return { start, end, partial: true };
}

/** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res @param {string} file */
async function serveMedia(req, res, file) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  try {
    const { size } = await stat(file);
    const { start, end, partial } = byteRange(req.headers.range, size);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Content-Length', end - start + 1);
    if (partial) res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.statusCode = partial ? 206 : 200;
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file, { start, end });
    res.on('close', () => stream.destroy());
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch (error) {
    res.statusCode = error instanceof RangeError ? 416 : 404;
    res.end();
  }
}

/** Serve the finished MP4s during local development, without adding them to public/ or the build. */
export function tripMedia() {
  const directory = process.env.JAPAN_TRIP_MEDIA_DIR;
  return {
    name: 'local-trip-media',
    apply: /** @type {const} */ ('serve'),
    /** @param {import('vite').ViteDevServer} server */
    configureServer(server) {
      if (!directory) return;
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        const match = /^\/__trip-media\/(2025|2026)\.mp4$/.exec(pathname ?? '');
        if (!match) return next();
        await serveMedia(req, res, join(directory, `Hokkaido Bike Trip ${match[1]}.mp4`));
      });
    },
  };
}
