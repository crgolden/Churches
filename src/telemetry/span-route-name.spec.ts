import type { Request, Response, NextFunction } from 'express';
import {
  HTTP_ROUTE_ATTRIBUTE,
  nameSpansByRoute,
  RESPONSE_FINISHED_EVENT,
  ROOT_ROUTE,
  routeTemplateFor,
  UNMATCHED_SUFFIX,
} from './span-route-name';
import { HttpMethods } from '../bff/http-headers';

const { getActiveSpan } = vi.hoisted(() => ({ getActiveSpan: vi.fn() }));

vi.mock('@opentelemetry/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opentelemetry/api')>();
  return { ...actual, trace: { ...actual.trace, getActiveSpan } };
});

function segment(): string {
  return `/${crypto.randomUUID()}`;
}

function makeReq(parts: Partial<Request>): Request {
  return { method: HttpMethods.get, path: ROOT_ROUTE, baseUrl: '', ...parts } as Request;
}

function makeRes() {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    on: vi.fn((event: string, cb: () => void) => {
      (listeners[event] ??= []).push(cb);
    }),
    finish: () => (listeners[RESPONSE_FINISHED_EVENT] ?? []).forEach((cb) => cb()),
  } as unknown as Response & { finish: () => void };
}

describe('routeTemplateFor', () => {
  it('joins the mount point to the matched route pattern', () => {
    const mount = segment();
    const route = segment();

    expect(routeTemplateFor(makeReq({ baseUrl: mount, route: { path: route } as never }))).toBe(`${mount}${route}`);
  });

  it('keeps a parameterised pattern rather than the concrete value', () => {
    const collection = segment();
    const pattern = `${collection}/:file`;
    const req = makeReq({ route: { path: pattern } as never, path: `${collection}${segment()}` });

    expect(routeTemplateFor(req)).toBe(pattern);
  });

  it('buckets a mounted proxy that matched no inner route', () => {
    const mount = segment();

    expect(routeTemplateFor(makeReq({ baseUrl: mount, path: `${segment()}${segment()}` }))).toBe(`${mount}${UNMATCHED_SUFFIX}`);
  });

  it('buckets an unmounted path by its first segment, so slugs cannot mint span names', () => {
    const collection = segment();

    expect(routeTemplateFor(makeReq({ path: `${collection}${segment()}` }))).toBe(`${collection}${UNMATCHED_SUFFIX}`);
    expect(routeTemplateFor(makeReq({ path: `${collection}${segment()}` }))).toBe(`${collection}${UNMATCHED_SUFFIX}`);
  });

  it('names the root request /', () => {
    expect(routeTemplateFor(makeReq({ path: ROOT_ROUTE }))).toBe(ROOT_ROUTE);
  });
});

describe('nameSpansByRoute', () => {
  beforeEach(() => getActiveSpan.mockReset());

  it('renames the span only once the response is finished and the route is known', () => {
    const span = { updateName: vi.fn(), setAttribute: vi.fn() };
    getActiveSpan.mockReturnValue(span);
    const route = segment();
    const req = makeReq({ method: HttpMethods.get, route: { path: route } as never });
    const res = makeRes();

    nameSpansByRoute(req, res, vi.fn() as NextFunction);
    expect(span.updateName).not.toHaveBeenCalled();

    res.finish();
    expect(span.updateName).toHaveBeenCalledWith(`GET ${route}`);
    expect(span.setAttribute).toHaveBeenCalledWith(HTTP_ROUTE_ATTRIBUTE, route);
  });

  it('continues the chain when nothing is being traced', () => {
    getActiveSpan.mockReturnValue(undefined);
    const next = vi.fn() as NextFunction;

    nameSpansByRoute(makeReq({}), makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
