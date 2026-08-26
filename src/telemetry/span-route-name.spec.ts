import type { Request, Response, NextFunction } from 'express';
import { nameSpansByRoute, routeTemplateFor } from './span-route-name';

const { getActiveSpan } = vi.hoisted(() => ({ getActiveSpan: vi.fn() }));

vi.mock('@opentelemetry/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opentelemetry/api')>();
  return { ...actual, trace: { ...actual.trace, getActiveSpan } };
});

function makeReq(parts: Partial<Request>): Request {
  return { method: 'GET', path: '/', baseUrl: '', ...parts } as Request;
}

function makeRes() {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    on: vi.fn((event: string, cb: () => void) => {
      (listeners[event] ??= []).push(cb);
    }),
    finish: () => (listeners['finish'] ?? []).forEach((cb) => cb()),
  } as unknown as Response & { finish: () => void };
}

describe('routeTemplateFor', () => {
  it('joins the mount point to the matched route pattern', () => {
    expect(routeTemplateFor(makeReq({ baseUrl: '/bff', route: { path: '/login' } as never }))).toBe('/bff/login');
  });

  it('keeps a parameterised pattern rather than the concrete value', () => {
    const req = makeReq({ route: { path: '/sitemaps/:file' } as never, path: '/sitemaps/chunk-3.xml' });

    expect(routeTemplateFor(req)).toBe('/sitemaps/:file');
  });

  it('buckets a mounted proxy that matched no inner route', () => {
    expect(routeTemplateFor(makeReq({ baseUrl: '/directory/api', path: '/churches/abc' }))).toBe('/directory/api/*');
  });

  it('buckets an unmounted path by its first segment, so slugs cannot mint span names', () => {
    expect(routeTemplateFor(makeReq({ path: '/churches/grace-community' }))).toBe('/churches/*');
    expect(routeTemplateFor(makeReq({ path: '/churches/first-baptist' }))).toBe('/churches/*');
  });

  it('names the root request /', () => {
    expect(routeTemplateFor(makeReq({ path: '/' }))).toBe('/');
  });
});

describe('nameSpansByRoute', () => {
  beforeEach(() => getActiveSpan.mockReset());

  it('renames the span only once the response is finished and the route is known', () => {
    const span = { updateName: vi.fn(), setAttribute: vi.fn() };
    getActiveSpan.mockReturnValue(span);
    const req = makeReq({ method: 'GET', route: { path: '/sitemap-index.xml' } as never });
    const res = makeRes();

    nameSpansByRoute(req, res, vi.fn() as NextFunction);
    expect(span.updateName).not.toHaveBeenCalled();

    res.finish();
    expect(span.updateName).toHaveBeenCalledWith('GET /sitemap-index.xml');
    expect(span.setAttribute).toHaveBeenCalledWith('http.route', '/sitemap-index.xml');
  });

  it('continues the chain when nothing is being traced', () => {
    getActiveSpan.mockReturnValue(undefined);
    const next = vi.fn() as NextFunction;

    nameSpansByRoute(makeReq({}), makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
