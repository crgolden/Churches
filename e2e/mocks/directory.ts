import { constants } from 'node:http2';
import express, { type Express, type Request, type Response } from 'express';
import { DEFAULT_PAGE_SIZE, DirectoryRoutes, SearchParamNames } from '../../src/shared/directory-api';
import { CORRECTABLE_FIELDS, FieldKinds } from '../../src/shared/correctable-fields';
import type { CampusInput, CorrectionInput, MinistryInput, ScheduleInput } from '../../src/shared/church.service';
import { MERGE_FIELD } from '../../src/shared/models';
import { CorrectionStatus, DirectoryLimits, DirectoryRefusals } from './directory-constants';
import { e2eContract } from './e2e-contract';

export const ControlRoutes = e2eContract().controlRoutes;

export { CorrectionStatus };
export type CorrectionStatusValue = (typeof CorrectionStatus)[keyof typeof CorrectionStatus];

export interface ChurchRecord {
  id: string;
  canonicalName: string;
  slug: string;
  latitude: number;
  longitude: number;
  street: string | null;
  city: string;
  state: string;
  zip: string;
  phoneNumber: string | null;
  website: string | null;
  emailAddress: string | null;
  denominationId: string | null;
  worshipStyle: number;
  primaryLanguage: string;
  acceptsLGBTQ: boolean | null;
  wheelchairAccessible: boolean | null;
  hasNursery: boolean | null;
  hasYouthProgram: boolean | null;
  confidenceScore: number;
  lastVerifiedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  schedules: ScheduleRecord[];
  ministries: MinistryRecord[];
  campuses: CampusRecord[];
}

export interface ScheduleRecord {
  id: string;
  churchId: string;
  campusId: string | null;
  dayOfWeek: number;
  startTime: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MinistryRecord {
  id: string;
  churchId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampusRecord {
  id: string;
  churchId: string;
  name: string;
  street: string | null;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface CorrectionRecord {
  id: string;
  churchId: string;
  userId: string | null;
  field: string;
  oldValue: string | null;
  newValue: string;
  status: CorrectionStatusValue;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  churchName: string | null;
  targetChurchName: string | null;
  churchSlug: string | null;
  targetChurchSlug: string | null;
}

const churches = new Map<string, ChurchRecord>();
const corrections = new Map<string, CorrectionRecord>();

const TEXT_FIELDS: ReadonlySet<string> = new Set(
  CORRECTABLE_FIELDS.filter(field => field.kind === FieldKinds.text).map(field => field.key),
);

const RouteParam = {
  churchId: newRouteParamName(),
  id: newRouteParamName(),
  slug: newRouteParamName(),
} as const;

function newRouteParamName(): string {
  return `p${crypto.randomUUID().replaceAll('-', '')}`;
}

function newId(): string {
  return crypto.randomUUID();
}

function applyCorrection(correction: CorrectionRecord, survivingId: string | undefined): string | null {
  if (correction.field === MERGE_FIELD) {
    if (survivingId === undefined) { return DirectoryRefusals.mergeSurvivorMissing; }
    if (survivingId !== correction.churchId && survivingId !== correction.newValue) {
      return DirectoryRefusals.mergeSurvivorNotInSuggestion;
    }
    const absorbedId = survivingId === correction.churchId ? correction.newValue : correction.churchId;
    const absorbed = churches.get(absorbedId);
    if (absorbed) { churches.set(absorbedId, { ...absorbed, isActive: false }); }
    for (const pending of [...corrections.values()]) {
      if (pending.status === CorrectionStatus.Pending && pending.field === MERGE_FIELD
        && (pending.churchId === absorbedId || pending.newValue === absorbedId)) {
        corrections.set(pending.id, { ...pending, status: CorrectionStatus.Rejected, reviewedBy: newId(), reviewedAt: now() });
      }
    }
    return null;
  }

  if (!TEXT_FIELDS.has(correction.field)) { return `'${correction.field}' is not a field this app can apply.`; }
  const column = correction.field as keyof ChurchRecord;
  const church = churches.get(correction.churchId);
  if (!church?.isActive) { return DirectoryRefusals.churchInactive; }
  churches.set(church.id, { ...church, [column]: correction.newValue, updatedAt: now() });
  return null;
}

function now(): string {
  return new Date().toISOString();
}

function getActiveChurches(): ChurchRecord[] {
  return [...churches.values()].filter(c => c.isActive);
}

function pagingFrom(req: Request): { page: number; pageSize: number } {
  const requestedPage = Number((req.query[SearchParamNames.page] as string | undefined) ?? 1);
  const requestedPageSize = Number((req.query[SearchParamNames.pageSize] as string | undefined) ?? DEFAULT_PAGE_SIZE);
  return {
    page: Math.max(1, requestedPage),
    pageSize: Math.min(DirectoryLimits.maxPageSize, Math.max(1, requestedPageSize)),
  };
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw new Error(`Handler for '${req.path}' ran without a single '${name}' route parameter.`);
  }

  return value;
}

export function createDirectoryApp(): Express {
  const app = express();
  app.use(express.json());

  app.post(ControlRoutes.reset, (_req: Request, res: Response) => {
    churches.clear();
    corrections.clear();
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.churches, (req: Request, res: Response) => {
    const church: ChurchRecord = req.body as ChurchRecord;
    church.schedules ??= [];
    church.ministries ??= [];
    church.campuses ??= [];
    church.createdAt ??= now();
    church.updatedAt ??= now();
    churches.set(church.id, church);
    res.status(constants.HTTP_STATUS_CREATED).json({ id: church.id });
  });

  app.post(ControlRoutes.corrections, (req: Request, res: Response) => {
    const correction: CorrectionRecord = req.body as CorrectionRecord;
    correction.createdAt ??= now();
    corrections.set(correction.id, correction);
    res.status(constants.HTTP_STATUS_CREATED).json({ id: correction.id });
  });

  app.get(DirectoryRoutes.denominations, (_req: Request, res: Response) => {
    res.json([]);
  });

  app.get(DirectoryRoutes.search, (req: Request, res: Response) => {
    const q = (req.query[SearchParamNames.q] as string | undefined)?.toLowerCase();
    const state = req.query[SearchParamNames.state] as string | undefined;
    const worshipStyle = req.query[SearchParamNames.worshipStyle]
      ? parseInt(req.query[SearchParamNames.worshipStyle] as string, 10)
      : undefined;
    const wheelchairAccessible =
      req.query[SearchParamNames.wheelchairAccessible] !== undefined
        ? req.query[SearchParamNames.wheelchairAccessible] === String(true)
        : undefined;
    const { page, pageSize } = pagingFrom(req);

    let results = getActiveChurches();

    if (q) {
      results = results.filter(
        c =>
          c.canonicalName.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q),
      );
    }
    if (state) {
      results = results.filter(c => c.state.toLowerCase() === state.toLowerCase());
    }
    if (worshipStyle !== undefined) {
      results = results.filter(c => c.worshipStyle === worshipStyle);
    }
    if (wheelchairAccessible !== undefined) {
      results = results.filter(c => c.wheelchairAccessible === wheelchairAccessible);
    }

    results.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
    const total = results.length;
    const items = results.slice((page - 1) * pageSize, page * pageSize);

    res.json({
      items: items.map(c => ({ church: c, distanceMiles: null })),
      totalCount: total,
      page,
      pageSize,
    });
  });

  app.get(DirectoryRoutes.churches, (req: Request, res: Response) => {
    const { page, pageSize } = pagingFrom(req);

    const all = getActiveChurches().sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName),
    );
    const total = all.length;
    const items = all.slice((page - 1) * pageSize, page * pageSize);

    res.json({ items, totalCount: total, page, pageSize });
  });

  app.post(`${DirectoryRoutes.churches}/:${RouteParam.churchId}${DirectoryRoutes.schedules}`, (req: Request, res: Response) => {
    const church = churches.get(routeParam(req, RouteParam.churchId));
    if (!church) { res.status(constants.HTTP_STATUS_NOT_FOUND).end(); return; }

    const record: ScheduleRecord = {
      id: newId(),
      churchId: church.id,
      campusId: null,
      dayOfWeek: (req.body as ScheduleInput).dayOfWeek,
      startTime: (req.body as ScheduleInput).startTime,
      description: (req.body as ScheduleInput).description ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    church.schedules = [...church.schedules, record];
    res.status(constants.HTTP_STATUS_CREATED).json({ id: record.id });
  });

  app.delete(`${DirectoryRoutes.schedules}/:${RouteParam.id}`, (req: Request, res: Response) => {
    let found = false;
    for (const church of churches.values()) {
      const idx = church.schedules.findIndex(s => s.id === routeParam(req, RouteParam.id));
      if (idx >= 0) {
        church.schedules = church.schedules.filter(s => s.id !== routeParam(req, RouteParam.id));
        found = true;
        break;
      }
    }
    res.status(found ? constants.HTTP_STATUS_NO_CONTENT : constants.HTTP_STATUS_NOT_FOUND).end();
  });

  app.post(`${DirectoryRoutes.churches}/:${RouteParam.churchId}${DirectoryRoutes.ministries}`, (req: Request, res: Response) => {
    const church = churches.get(routeParam(req, RouteParam.churchId));
    if (!church) { res.status(constants.HTTP_STATUS_NOT_FOUND).end(); return; }

    const record: MinistryRecord = {
      id: newId(),
      churchId: church.id,
      name: (req.body as MinistryInput).name,
      description: (req.body as MinistryInput).description ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    church.ministries = [...church.ministries, record];
    res.status(constants.HTTP_STATUS_CREATED).json({ id: record.id });
  });

  app.delete(`${DirectoryRoutes.ministries}/:${RouteParam.id}`, (req: Request, res: Response) => {
    let found = false;
    for (const church of churches.values()) {
      const idx = church.ministries.findIndex(m => m.id === routeParam(req, RouteParam.id));
      if (idx >= 0) {
        church.ministries = church.ministries.filter(m => m.id !== routeParam(req, RouteParam.id));
        found = true;
        break;
      }
    }
    res.status(found ? constants.HTTP_STATUS_NO_CONTENT : constants.HTTP_STATUS_NOT_FOUND).end();
  });

  app.post(`${DirectoryRoutes.churches}/:${RouteParam.churchId}${DirectoryRoutes.campuses}`, (req: Request, res: Response) => {
    const church = churches.get(routeParam(req, RouteParam.churchId));
    if (!church) { res.status(constants.HTTP_STATUS_NOT_FOUND).end(); return; }

    const record: CampusRecord = {
      id: newId(),
      churchId: church.id,
      name: (req.body as CampusInput).name,
      street: (req.body as CampusInput).street ?? null,
      city: (req.body as CampusInput).city,
      state: (req.body as CampusInput).state,
      zip: (req.body as CampusInput).zip,
      latitude: (req.body as CampusInput).latitude,
      longitude: (req.body as CampusInput).longitude,
      createdAt: now(),
      updatedAt: now(),
    };
    church.campuses = [...church.campuses, record];
    res.status(constants.HTTP_STATUS_CREATED).json({ id: record.id });
  });

  app.delete(`${DirectoryRoutes.campuses}/:${RouteParam.id}`, (req: Request, res: Response) => {
    let found = false;
    for (const church of churches.values()) {
      const idx = church.campuses.findIndex(c => c.id === routeParam(req, RouteParam.id));
      if (idx >= 0) {
        church.campuses = church.campuses.filter(c => c.id !== routeParam(req, RouteParam.id));
        found = true;
        break;
      }
    }
    res.status(found ? constants.HTTP_STATUS_NO_CONTENT : constants.HTTP_STATUS_NOT_FOUND).end();
  });

  app.get(DirectoryRoutes.corrections, (req: Request, res: Response) => {
    const { page, pageSize } = pagingFrom(req);

    const all = [...corrections.values()]
      .filter(c => c.status === CorrectionStatus.Pending)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = all.length;
    const items = all.slice((page - 1) * pageSize, page * pageSize);

    res.json({ items, totalCount: total, page, pageSize });
  });

  app.post(DirectoryRoutes.corrections, (req: Request, res: Response) => {
    const body = req.body as Partial<CorrectionInput>;
    const churchId = body.churchId;
    if (!churchId) { res.status(constants.HTTP_STATUS_BAD_REQUEST).end(); return; }

    const church = churches.get(churchId);
    if (!church) { res.status(constants.HTTP_STATUS_NOT_FOUND).end(); return; }

    const field = body.field;
    const newValue = body.newValue;
    if (!field || !newValue) { res.status(constants.HTTP_STATUS_BAD_REQUEST).end(); return; }

    const record: CorrectionRecord = {
      id: newId(),
      churchId,
      userId: newId(),
      field,
      oldValue: body.oldValue ?? null,
      newValue,
      status: CorrectionStatus.Pending,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now(),
      churchName: church.canonicalName,
      targetChurchName: churches.get(newValue)?.canonicalName ?? null,
      churchSlug: church.slug,
      targetChurchSlug: churches.get(newValue)?.slug ?? null,
    };
    corrections.set(record.id, record);
    res.status(constants.HTTP_STATUS_CREATED).json(record);
  });

  app.patch(`${DirectoryRoutes.corrections}/:${RouteParam.id}${DirectoryRoutes.approve}`, (req: Request, res: Response) => {
    const correction = corrections.get(routeParam(req, RouteParam.id));
    if (!correction || correction.status !== CorrectionStatus.Pending) { res.status(constants.HTTP_STATUS_NOT_FOUND).end(); return; }
    const survivingId: unknown = req.query[SearchParamNames.survivingId];
    const refusal = applyCorrection(correction, typeof survivingId === 'string' ? survivingId : undefined);
    if (refusal !== null) { res.status(constants.HTTP_STATUS_BAD_REQUEST).json(refusal); return; }
    corrections.set(correction.id, {
      ...correction,
      status: CorrectionStatus.Approved,
      reviewedBy: newId(),
      reviewedAt: now(),
    });
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.patch(`${DirectoryRoutes.corrections}/:${RouteParam.id}${DirectoryRoutes.reject}`, (req: Request, res: Response) => {
    const correction = corrections.get(routeParam(req, RouteParam.id));
    if (!correction || correction.status !== CorrectionStatus.Pending) { res.status(constants.HTTP_STATUS_NOT_FOUND).end(); return; }
    corrections.set(correction.id, {
      ...correction,
      status: CorrectionStatus.Rejected,
      reviewedBy: newId(),
      reviewedAt: now(),
    });
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(DirectoryRoutes.church(`:${RouteParam.slug}`), (req: Request, res: Response) => {
    const slug = routeParam(req, RouteParam.slug);
    const church = [...churches.values()].find(
      c => c.slug === slug && c.isActive,
    );
    if (!church) { res.status(constants.HTTP_STATUS_NOT_FOUND).end(); return; }
    res.json(church);
  });

  return app;
}
