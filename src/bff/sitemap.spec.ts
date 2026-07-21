import type { Request, Response } from 'express';
import { Writable } from 'node:stream';
import { sitemapIndexHandler, sitemapChunkHandler } from './sitemap';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(params: Record<string, string> = {}): Request {
  return { params } as unknown as Request;
}

function makeRes() {
  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  let statusCode = 200;

  const writable = new Writable({
    write(chunk: Buffer, _enc, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });

  const res = Object.assign(writable, {
    status: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
  });

  return {
    res: res as unknown as Response,
    body: () => Buffer.concat(chunks),
    headers,
    status: () => statusCode,
  };
}

function stubFetchResponse(response: globalThis.Response) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

function stubFetchRejection(error: Error) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
}

const GZIP_MAGIC = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff]);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('sitemapIndexHandler', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv['SitemapBlobBaseUrl'] = process.env['SitemapBlobBaseUrl'];
    process.env['SitemapBlobBaseUrl'] = 'https://crgolden.z13.web.core.windows.net/';
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedEnv['SitemapBlobBaseUrl'] === undefined) {
      delete process.env['SitemapBlobBaseUrl'];
    } else {
      process.env['SitemapBlobBaseUrl'] = savedEnv['SitemapBlobBaseUrl'];
    }

    vi.unstubAllGlobals();
  });

  it('returns 502 when SitemapBlobBaseUrl is not configured', async () => {
    delete process.env['SitemapBlobBaseUrl'];
    const { res, status } = makeRes();

    await sitemapIndexHandler(makeReq(), res);

    expect(status()).toBe(502);
  });

  it('streams the index blob through with Content-Type application/xml', async () => {
    const xml = '<?xml version="1.0"?><sitemapindex></sitemapindex>';
    stubFetchResponse(new Response(xml, { status: 200 }));
    const { res, body, headers, status } = makeRes();

    await sitemapIndexHandler(makeReq(), res);

    expect(status()).toBe(200);
    expect(headers['content-type']).toBe('application/xml');
    expect(body().toString('utf8')).toBe(xml);
  });

  it('returns 502 when the upstream fetch throws', async () => {
    stubFetchRejection(new Error('network error'));
    const { res, status } = makeRes();

    await sitemapIndexHandler(makeReq(), res);

    expect(status()).toBe(502);
  });

  it('returns 502 when the upstream response is a non-OK, non-404 status', async () => {
    stubFetchResponse(new Response(null, { status: 500 }));
    const { res, status } = makeRes();

    await sitemapIndexHandler(makeReq(), res);

    expect(status()).toBe(502);
  });
});

describe('sitemapChunkHandler', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv['SitemapBlobBaseUrl'] = process.env['SitemapBlobBaseUrl'];
    process.env['SitemapBlobBaseUrl'] = 'https://crgolden.z13.web.core.windows.net/';
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedEnv['SitemapBlobBaseUrl'] === undefined) {
      delete process.env['SitemapBlobBaseUrl'];
    } else {
      process.env['SitemapBlobBaseUrl'] = savedEnv['SitemapBlobBaseUrl'];
    }

    vi.unstubAllGlobals();
  });

  it('streams a valid chunk through with Content-Type application/gzip and no Content-Encoding', async () => {
    stubFetchResponse(new Response(GZIP_MAGIC, { status: 200 }));
    const { res, body, headers, status } = makeRes();

    await sitemapChunkHandler(makeReq({ file: 'sitemap-1.xml.gz' }), res);

    expect(status()).toBe(200);
    expect(headers['content-type']).toBe('application/gzip');
    expect(headers['content-encoding']).toBeUndefined();
    const bytes = body();
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
    expect(bytes.length).toBe(GZIP_MAGIC.length);
  });

  it.each([
    ['../../etc/passwd'],
    ['sitemap-1.xml'],
    ['sitemap-abc.xml.gz'],
    ['sitemap-1.xml.gz/../secret'],
  ])('rejects a whitelist-violating filename (%s) with 404 and never calls fetch', async (file) => {
    vi.stubGlobal('fetch', vi.fn());
    const { res, status } = makeRes();

    await sitemapChunkHandler(makeReq({ file }), res);

    expect(status()).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('passes through a 404 from upstream blob storage', async () => {
    stubFetchResponse(new Response(null, { status: 404 }));
    const { res, status } = makeRes();

    await sitemapChunkHandler(makeReq({ file: 'sitemap-9.xml.gz' }), res);

    expect(status()).toBe(404);
  });
});
