/**
 * Mock Directory API — mirrors ChurchStore + CorrectionStore from the C# test harness.
 *
 * Serves real HTTP routes matching the real Directory API's actual shape (no path prefix — the
 * Node SSR server's directoryProxy strips the '/directory/api' mount prefix before forwarding) so
 * the server can proxy to it server-side (Playwright page.route() only intercepts browser
 * requests, not outbound Node fetch calls).  Tests manipulate state via the control API at /_test/*.
 */

import express, { type Express, type Request, type Response } from 'express';

// ── Data models ──────────────────────────────────────────────────────────────

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
  userId: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  status: number; // 0=pending, 1=approved, 2=rejected
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  churchName: string | null;
}

// ── In-memory stores ─────────────────────────────────────────────────────────

const churches = new Map<string, ChurchRecord>();
const corrections = new Map<string, CorrectionRecord>();

function newId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function getActiveChurches(): ChurchRecord[] {
  return [...churches.values()].filter(c => c.isActive);
}

// ── Seed data (mirror of C# ChurchStore static fields) ───────────────────────

export const FIRST_BAPTIST_AUSTIN: ChurchRecord = {
  id: '11111111-1111-1111-1111-111111111111',
  canonicalName: 'First Baptist Church Austin',
  slug: 'first-baptist-church-austin-tx',
  latitude: 30.2672,
  longitude: -97.7431,
  street: '901 Trinity St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  phoneNumber: '(512) 476-2625',
  website: 'https://fbcaustin.org',
  emailAddress: 'info@fbcaustin.org',
  denominationId: null,
  worshipStyle: 1,
  primaryLanguage: 'English',
  acceptsLGBTQ: null,
  wheelchairAccessible: true,
  hasNursery: true,
  hasYouthProgram: true,
  confidenceScore: 0.85,
  lastVerifiedAt: null,
  isActive: true,
  createdAt: now(),
  updatedAt: now(),
  schedules: [
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000001',
      churchId: '11111111-1111-1111-1111-111111111111',
      campusId: null,
      dayOfWeek: 0,
      startTime: '10:00:00',
      description: 'Sunday Worship',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000002',
      churchId: '11111111-1111-1111-1111-111111111111',
      campusId: null,
      dayOfWeek: 3,
      startTime: '19:00:00',
      description: 'Bible Study',
      createdAt: now(),
      updatedAt: now(),
    },
  ],
  ministries: [
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000001',
      churchId: '11111111-1111-1111-1111-111111111111',
      name: 'Youth Group',
      description: 'For teens',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000002',
      churchId: '11111111-1111-1111-1111-111111111111',
      name: 'Food Bank',
      description: null,
      createdAt: now(),
      updatedAt: now(),
    },
  ],
  campuses: [
    {
      id: 'cccccccc-0000-0000-0000-000000000001',
      churchId: '11111111-1111-1111-1111-111111111111',
      name: 'North Campus',
      street: '1200 N Lamar Blvd',
      city: 'Austin',
      state: 'TX',
      zip: '78703',
      latitude: 30.29,
      longitude: -97.75,
      createdAt: now(),
      updatedAt: now(),
    },
  ],
};

export const MOSAIC_AUSTIN: ChurchRecord = {
  id: '22222222-2222-2222-2222-222222222222',
  canonicalName: 'Mosaic Church Austin',
  slug: 'mosaic-church-austin-tx',
  latitude: 30.27,
  longitude: -97.75,
  street: null,
  city: 'Austin',
  state: 'TX',
  zip: '78702',
  phoneNumber: null,
  website: null,
  emailAddress: null,
  denominationId: null,
  worshipStyle: 2,
  primaryLanguage: 'English',
  acceptsLGBTQ: null,
  wheelchairAccessible: null,
  hasNursery: null,
  hasYouthProgram: null,
  confidenceScore: 0.2,
  lastVerifiedAt: null,
  isActive: true,
  createdAt: now(),
  updatedAt: now(),
  schedules: [],
  ministries: [],
  campuses: [],
};

// ── Express app factory ───────────────────────────────────────────────────────

export function createDirectoryApp(): Express {
  const app = express();
  app.use(express.json());

  // ── Control API (/_test/*) — test state management ──────────────────────

  /** Clear all state (called at the start of each test). */
  app.post('/_test/reset', (_req: Request, res: Response) => {
    churches.clear();
    corrections.clear();
    res.status(204).end();
  });

  /** Seed a church record (sent as full JSON body). */
  app.post('/_test/churches', (req: Request, res: Response) => {
    const church: ChurchRecord = req.body as ChurchRecord;
    church.schedules ??= [];
    church.ministries ??= [];
    church.campuses ??= [];
    church.createdAt ??= now();
    church.updatedAt ??= now();
    churches.set(church.id, church);
    res.status(201).json({ id: church.id });
  });

  /** Seed a correction record. */
  app.post('/_test/corrections', (req: Request, res: Response) => {
    const correction: CorrectionRecord = req.body as CorrectionRecord;
    correction.createdAt ??= now();
    corrections.set(correction.id, correction);
    res.status(201).json({ id: correction.id });
  });

  // ── Directory API routes (no path prefix, matches the real upstream API) ────

  /** GET /denominations — always returns empty array. */
  app.get('/denominations', (_req: Request, res: Response) => {
    res.json([]);
  });

  /** GET /search — filtered, paginated search. */
  app.get('/search', (req: Request, res: Response) => {
    const q = (req.query['q'] as string | undefined)?.toLowerCase();
    const state = req.query['state'] as string | undefined;
    const worshipStyle = req.query['worshipStyle']
      ? parseInt(req.query['worshipStyle'] as string, 10)
      : undefined;
    const wheelchairAccessible =
      req.query['wheelchairAccessible'] !== undefined
        ? req.query['wheelchairAccessible'] === 'true'
        : undefined;
    const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt((req.query['pageSize'] as string) ?? '20', 10)));

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

  /** GET /churches — paginated list. */
  app.get('/churches', (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt((req.query['pageSize'] as string) ?? '20', 10)));

    const all = getActiveChurches().sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName),
    );
    const total = all.length;
    const items = all.slice((page - 1) * pageSize, page * pageSize);

    res.json({ items, totalCount: total, page, pageSize });
  });

  /** POST /churches/:churchId/schedules — add a schedule. */
  app.post('/churches/:churchId/schedules', (req: Request, res: Response) => {
    const church = churches.get(req.params['churchId'] ?? '');
    if (!church) { res.status(404).end(); return; }

    const record: ScheduleRecord = {
      id: newId(),
      churchId: church.id,
      campusId: null,
      dayOfWeek: (req.body as Record<string, unknown>)['dayOfWeek'] as number,
      startTime: (req.body as Record<string, unknown>)['startTime'] as string,
      description: ((req.body as Record<string, unknown>)['description'] as string | null) ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    church.schedules = [...church.schedules, record];
    res.status(201).json({ id: record.id });
  });

  /** DELETE /schedules/:id — remove a schedule. */
  app.delete('/schedules/:id', (req: Request, res: Response) => {
    let found = false;
    for (const church of churches.values()) {
      const idx = church.schedules.findIndex(s => s.id === req.params['id']);
      if (idx >= 0) {
        church.schedules = church.schedules.filter(s => s.id !== req.params['id']);
        found = true;
        break;
      }
    }
    res.status(found ? 204 : 404).end();
  });

  /** POST /churches/:churchId/ministries — add a ministry. */
  app.post('/churches/:churchId/ministries', (req: Request, res: Response) => {
    const church = churches.get(req.params['churchId'] ?? '');
    if (!church) { res.status(404).end(); return; }

    const record: MinistryRecord = {
      id: newId(),
      churchId: church.id,
      name: (req.body as Record<string, unknown>)['name'] as string,
      description: ((req.body as Record<string, unknown>)['description'] as string | null) ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    church.ministries = [...church.ministries, record];
    res.status(201).json({ id: record.id });
  });

  /** DELETE /ministries/:id — remove a ministry. */
  app.delete('/ministries/:id', (req: Request, res: Response) => {
    let found = false;
    for (const church of churches.values()) {
      const idx = church.ministries.findIndex(m => m.id === req.params['id']);
      if (idx >= 0) {
        church.ministries = church.ministries.filter(m => m.id !== req.params['id']);
        found = true;
        break;
      }
    }
    res.status(found ? 204 : 404).end();
  });

  /** POST /churches/:churchId/campuses — add a campus. */
  app.post('/churches/:churchId/campuses', (req: Request, res: Response) => {
    const church = churches.get(req.params['churchId'] ?? '');
    if (!church) { res.status(404).end(); return; }

    const record: CampusRecord = {
      id: newId(),
      churchId: church.id,
      name: (req.body as Record<string, unknown>)['name'] as string,
      street: ((req.body as Record<string, unknown>)['street'] as string | null) ?? null,
      city: (req.body as Record<string, unknown>)['city'] as string,
      state: (req.body as Record<string, unknown>)['state'] as string,
      zip: (req.body as Record<string, unknown>)['zip'] as string,
      latitude: (req.body as Record<string, unknown>)['latitude'] as number,
      longitude: (req.body as Record<string, unknown>)['longitude'] as number,
      createdAt: now(),
      updatedAt: now(),
    };
    church.campuses = [...church.campuses, record];
    res.status(201).json({ id: record.id });
  });

  /** DELETE /campuses/:id — remove a campus. */
  app.delete('/campuses/:id', (req: Request, res: Response) => {
    let found = false;
    for (const church of churches.values()) {
      const idx = church.campuses.findIndex(c => c.id === req.params['id']);
      if (idx >= 0) {
        church.campuses = church.campuses.filter(c => c.id !== req.params['id']);
        found = true;
        break;
      }
    }
    res.status(found ? 204 : 404).end();
  });

  /** GET /corrections — pending corrections list. */
  app.get('/corrections', (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt((req.query['pageSize'] as string) ?? '20', 10)));

    const all = [...corrections.values()]
      .filter(c => c.status === 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = all.length;
    const items = all.slice((page - 1) * pageSize, page * pageSize);

    res.json({ items, totalCount: total, page, pageSize });
  });

  /** POST /corrections — submit a correction. */
  app.post('/corrections', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const churchId = body['churchId'] as string | undefined;
    if (!churchId) { res.status(400).end(); return; }

    const church = churches.get(churchId);
    if (!church) { res.status(404).end(); return; }

    const field = body['field'] as string | undefined;
    const newValue = body['newValue'] as string | undefined;
    if (!field || !newValue) { res.status(400).end(); return; }

    const record: CorrectionRecord = {
      id: newId(),
      churchId,
      userId: 'e2e-user-id',
      field,
      oldValue: (body['oldValue'] as string | null) ?? null,
      newValue,
      status: 0,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now(),
      churchName: church.canonicalName,
    };
    corrections.set(record.id, record);
    res.status(201).json(record);
  });

  /** PATCH /corrections/:id/approve. */
  app.patch('/corrections/:id/approve', (req: Request, res: Response) => {
    const correction = corrections.get(req.params['id'] ?? '');
    if (!correction || correction.status !== 0) { res.status(404).end(); return; }
    corrections.set(correction.id, {
      ...correction,
      status: 1,
      reviewedBy: 'e2e-mod-id',
      reviewedAt: now(),
    });
    res.status(204).end();
  });

  /** PATCH /corrections/:id/reject. */
  app.patch('/corrections/:id/reject', (req: Request, res: Response) => {
    const correction = corrections.get(req.params['id'] ?? '');
    if (!correction || correction.status !== 0) { res.status(404).end(); return; }
    corrections.set(correction.id, {
      ...correction,
      status: 2,
      reviewedBy: 'e2e-mod-id',
      reviewedAt: now(),
    });
    res.status(204).end();
  });

  /**
   * GET /churches/:slug — church detail (must come AFTER all
   * /churches/:churchId/* routes to avoid slug matching a UUID segment).
   */
  app.get('/churches/:slug', (req: Request, res: Response) => {
    const slug = req.params['slug'] ?? '';
    const church = [...churches.values()].find(
      c => c.slug === slug && c.isActive,
    );
    if (!church) { res.status(404).end(); return; }
    res.json(church);
  });

  return app;
}
