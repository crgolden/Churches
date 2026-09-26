import { trace } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';

export const HTTP_ROUTE_ATTRIBUTE = 'http.route';
export const UNMATCHED_SUFFIX = '/*';
export const ROOT_ROUTE = '/';
export const RESPONSE_FINISHED_EVENT = 'finish';

export function routeTemplateFor(req: Request): string {
  const matched = req.route as { path?: string } | undefined;

  if (matched?.path) {
    const base = req.baseUrl;
    const path = matched.path === ROOT_ROUTE ? '' : matched.path;
    return `${base}${path}` || ROOT_ROUTE;
  }

  if (req.baseUrl) {
    return `${req.baseUrl}${UNMATCHED_SUFFIX}`;
  }

  const [firstSegment] = (req.path ?? ROOT_ROUTE).split('/').filter(Boolean);

  return firstSegment ? `/${firstSegment}${UNMATCHED_SUFFIX}` : ROOT_ROUTE;
}

export function nameSpansByRoute(req: Request, res: Response, next: NextFunction): void {
  const span = trace.getActiveSpan();

  if (span) {
    res.on(RESPONSE_FINISHED_EVENT, () => {
      const route = routeTemplateFor(req);
      span.updateName(`${req.method} ${route}`);
      span.setAttribute(HTTP_ROUTE_ATTRIBUTE, route);
    });
  }

  next();
}
