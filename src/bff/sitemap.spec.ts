import { HttpStatusCode } from '@angular/common/http';
import type { Request, Response } from 'express';
import { Writable } from 'node:stream';
import { newCount, newHttpsAddress, newText } from '@crgolden/modules/testing';
import {
  SITEMAP_CHUNK_CONTENT_TYPE,
  SITEMAP_INDEX_CONTENT_TYPE,
  SitemapFileNames,
  sitemapChunkFileName,
  sitemapChunkHandler,
  sitemapIndexHandler,
} from './sitemap';
import { BffSettingKeys, InvalidSettingError } from './settings';
import { CONTENT_TYPE_HEADER, HopByHopHeaders } from './http-headers';

function makeReq(params: Record<string, string> = {}): Request {
  return { params } as unknown as Request;
}

function makeRes() {
  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  let statusCode = HttpStatusCode.Ok;

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

function newBlobBaseUrl(): string {
  return `${new URL(newHttpsAddress()).origin}/`;
}

const GZIP_MAGIC = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff]);

describe('sitemapIndexHandler', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv[BffSettingKeys.SitemapBlobBaseUrl] = process.env[BffSettingKeys.SitemapBlobBaseUrl];
    process.env[BffSettingKeys.SitemapBlobBaseUrl] = newBlobBaseUrl();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedEnv[BffSettingKeys.SitemapBlobBaseUrl] === undefined) {
      delete process.env[BffSettingKeys.SitemapBlobBaseUrl];
    } else {
      process.env[BffSettingKeys.SitemapBlobBaseUrl] = savedEnv[BffSettingKeys.SitemapBlobBaseUrl];
    }

    vi.unstubAllGlobals();
  });

  it('throws rather than answering when SitemapBlobBaseUrl is not configured', async () => {
    delete process.env[BffSettingKeys.SitemapBlobBaseUrl];
    const { res } = makeRes();

    await expect(sitemapIndexHandler(makeReq(), res)).rejects.toThrow(
      new InvalidSettingError(BffSettingKeys.SitemapBlobBaseUrl),
    );
  });

  it('streams the index blob through with Content-Type application/xml', async () => {
    const xml = newText();
    stubFetchResponse(new Response(xml, { status: HttpStatusCode.Ok }));
    const { res, body, headers, status } = makeRes();

    await sitemapIndexHandler(makeReq(), res);

    expect(status()).toBe(HttpStatusCode.Ok);
    expect(headers[CONTENT_TYPE_HEADER.toLowerCase()]).toBe(SITEMAP_INDEX_CONTENT_TYPE);
    expect(body().toString()).toBe(xml);
  });

  it('returns 502 when the upstream fetch throws', async () => {
    stubFetchRejection(new Error(newText()));
    const { res, status } = makeRes();

    await sitemapIndexHandler(makeReq(), res);

    expect(status()).toBe(HttpStatusCode.BadGateway);
  });

  it('returns 502 when the upstream response is a non-OK, non-404 status', async () => {
    stubFetchResponse(new Response(null, { status: HttpStatusCode.InternalServerError }));
    const { res, status } = makeRes();

    await sitemapIndexHandler(makeReq(), res);

    expect(status()).toBe(HttpStatusCode.BadGateway);
  });
});

describe('sitemapChunkHandler', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv[BffSettingKeys.SitemapBlobBaseUrl] = process.env[BffSettingKeys.SitemapBlobBaseUrl];
    process.env[BffSettingKeys.SitemapBlobBaseUrl] = newBlobBaseUrl();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedEnv[BffSettingKeys.SitemapBlobBaseUrl] === undefined) {
      delete process.env[BffSettingKeys.SitemapBlobBaseUrl];
    } else {
      process.env[BffSettingKeys.SitemapBlobBaseUrl] = savedEnv[BffSettingKeys.SitemapBlobBaseUrl];
    }

    vi.unstubAllGlobals();
  });

  it('streams a valid chunk through with Content-Type application/gzip and no Content-Encoding', async () => {
    stubFetchResponse(new Response(GZIP_MAGIC, { status: HttpStatusCode.Ok }));
    const { res, body, headers, status } = makeRes();

    await sitemapChunkHandler(makeReq({ file: sitemapChunkFileName(newCount()) }), res);

    expect(status()).toBe(HttpStatusCode.Ok);
    expect(headers[CONTENT_TYPE_HEADER.toLowerCase()]).toBe(SITEMAP_CHUNK_CONTENT_TYPE);
    expect(headers[HopByHopHeaders.contentEncoding]).toBeUndefined();
    const bytes = body();
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
    expect(bytes).toHaveLength(GZIP_MAGIC.length);
  });

  it.each([
    [`../../${newText()}`],
    [`${sitemapChunkFileName(newCount())}${newText()}`],
    [`${SitemapFileNames.chunkPrefix}${newText()}${SitemapFileNames.chunkSuffix}`],
    [`${sitemapChunkFileName(newCount())}/../${newText()}`],
  ])('rejects a whitelist-violating filename (%s) with 404 and never calls fetch', async (file) => {
    vi.stubGlobal('fetch', vi.fn());
    const { res, status } = makeRes();

    await sitemapChunkHandler(makeReq({ file }), res);

    expect(status()).toBe(HttpStatusCode.NotFound);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('passes through a 404 from upstream blob storage', async () => {
    stubFetchResponse(new Response(null, { status: HttpStatusCode.NotFound }));
    const { res, status } = makeRes();

    await sitemapChunkHandler(makeReq({ file: sitemapChunkFileName(newCount()) }), res);

    expect(status()).toBe(HttpStatusCode.NotFound);
  });
});
