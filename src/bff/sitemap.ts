import type { Request, Response } from 'express';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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

// Streams the blob response straight through without buffering it fully in memory — required now
// that a single sitemap chunk can be several megabytes. Only `Content-Type` is set explicitly; no
// upstream headers are forwarded (unlike directoryProxy), and `Content-Encoding` is never set here:
// gzip chunks are served as the `.xml.gz` resource itself (Google's documented convention), not via
// negotiated HTTP compression, so nothing in this path may relabel or reinterpret the byte stream.
async function streamBlob(res: Response, blobUrl: string, contentType: string): Promise<void> {
  const blobResponse = await fetch(blobUrl);
  if (!blobResponse.ok || !blobResponse.body) {
    res.status(blobResponse.status === 404 ? 404 : 502);
    res.end('Sitemap upstream fetch failed');
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', contentType);
  await pipeline(Readable.fromWeb(blobResponse.body as WebReadableStream<Uint8Array>), res);
}

export async function sitemapIndexHandler(_req: Request, res: Response): Promise<void> {
  const blobUrl = resolveBlobUrl('sitemap-index.xml');
  if (!blobUrl) {
    res.status(502);
    res.end('SitemapBlobBaseUrl is not configured');
    return;
  }

  try {
    await streamBlob(res, blobUrl, 'application/xml');
  } catch (err) {
    logger.error({ err }, 'Failed to stream sitemap index from blob storage');
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
    await streamBlob(res, blobUrl, 'application/gzip');
  } catch (err) {
    logger.error({ err }, 'Failed to stream sitemap chunk from blob storage');
    if (!res.headersSent) {
      res.status(502);
      res.end('Sitemap upstream fetch failed');
    }
  }
}
