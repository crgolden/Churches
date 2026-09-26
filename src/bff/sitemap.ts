import type { Request, Response } from 'express';
import { logger } from '../telemetry/logging';
import { BffSettingKeys, requiredUrlSetting } from './settings';
import { CONTENT_TYPE_HEADER, HopByHopHeaders } from './http-headers';

export const SITEMAP_INDEX_CONTENT_TYPE = 'application/xml';

export const SITEMAP_CHUNK_CONTENT_TYPE = 'application/gzip';

export const SitemapFileNames = {
  index: 'sitemap-index.xml',
  chunkPrefix: 'sitemap-',
  chunkSuffix: '.xml.gz',
} as const;

export function sitemapChunkFileName(index: number): string {
  return `${SitemapFileNames.chunkPrefix}${index}${SitemapFileNames.chunkSuffix}`;
}

const CHUNK_FILENAME_PATTERN = /^sitemap-\d+\.xml\.gz$/;

function resolveBlobUrl(path: string): string {
  const base = requiredUrlSetting(BffSettingKeys.SitemapBlobBaseUrl).toString();
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

async function sendBlob(res: Response, blobUrl: string, contentType: string): Promise<void> {
  const blobResponse = await fetch(blobUrl);
  if (!blobResponse.ok) {
    res.status(blobResponse.status === 404 ? 404 : 502);
    res.end('Sitemap upstream fetch failed');
    return;
  }

  const body = Buffer.from(await blobResponse.arrayBuffer());
  res.status(200);
  res.setHeader(CONTENT_TYPE_HEADER, contentType);
  res.setHeader(HopByHopHeaders.contentLength, body.length.toString());
  res.end(body);
}

export async function sitemapIndexHandler(_req: Request, res: Response): Promise<void> {
  const blobUrl = resolveBlobUrl(SitemapFileNames.index);

  try {
    await sendBlob(res, blobUrl, SITEMAP_INDEX_CONTENT_TYPE);
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

  try {
    await sendBlob(res, blobUrl, SITEMAP_CHUNK_CONTENT_TYPE);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch sitemap chunk from blob storage');
    if (!res.headersSent) {
      res.status(502);
      res.end('Sitemap upstream fetch failed');
    }
  }
}
