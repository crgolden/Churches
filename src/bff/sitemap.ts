import type { Request, Response } from 'express';
import { logger } from '../telemetry/logging';

// Filenames are whitelisted before any URL is constructed from them — the blob path is built via
// `new URL(path, base)` against a fixed base (mirroring `directoryProxy`'s SSRF-safe resolution in
// proxy.ts), never by string-concatenating a request-supplied value onto the storage account origin.
const CHUNK_FILENAME_PATTERN = /^sitemap-\d+\.xml\.gz$/;

function resolveBlobUrl(path: string): string | undefined {
  const base = process.env['SitemapBlobBaseUrl'];
  if (!base) {
    return undefined;
  }

  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

// Buffers the blob response fully before responding, rather than streaming it through, so the
// client gets a normal Content-Length instead of Transfer-Encoding: chunked. Chunk files are
// gzip-compressed down to a few hundred KB, small enough to buffer safely. Only `Content-Type` is
// set explicitly; no upstream headers are forwarded (unlike directoryProxy), and `Content-Encoding`
// is never set here: gzip chunks are served as the `.xml.gz` resource itself (Google's documented
// convention), not via negotiated HTTP compression, so nothing in this path may relabel or
// reinterpret the byte stream.
async function sendBlob(res: Response, blobUrl: string, contentType: string): Promise<void> {
  const blobResponse = await fetch(blobUrl);
  if (!blobResponse.ok) {
    res.status(blobResponse.status === 404 ? 404 : 502);
    res.end('Sitemap upstream fetch failed');
    return;
  }

  const body = Buffer.from(await blobResponse.arrayBuffer());
  res.status(200);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', body.length.toString());
  res.end(body);
}

export async function sitemapIndexHandler(_req: Request, res: Response): Promise<void> {
  const blobUrl = resolveBlobUrl('sitemap-index.xml');
  if (!blobUrl) {
    res.status(502);
    res.end('SitemapBlobBaseUrl is not configured');
    return;
  }

  try {
    await sendBlob(res, blobUrl, 'application/xml');
  } catch (err) {
    logger.error({ err }, 'Failed to fetch sitemap index from blob storage');
    if (!res.headersSent) {
      res.status(502);
      res.end('Sitemap upstream fetch failed');
    }
  }
}

export async function sitemapChunkHandler(req: Request, res: Response): Promise<void> {
  const file = req.params['file'];
  if (typeof file !== 'string' || !CHUNK_FILENAME_PATTERN.test(file)) {
    res.status(404);
    res.end();
    return;
  }

  const blobUrl = resolveBlobUrl(`sitemaps/${file}`);
  if (!blobUrl) {
    res.status(502);
    res.end('SitemapBlobBaseUrl is not configured');
    return;
  }

  try {
    await sendBlob(res, blobUrl, 'application/gzip');
  } catch (err) {
    logger.error({ err }, 'Failed to fetch sitemap chunk from blob storage');
    if (!res.headersSent) {
      res.status(502);
      res.end('Sitemap upstream fetch failed');
    }
  }
}
