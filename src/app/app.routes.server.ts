import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'churches', renderMode: RenderMode.Server },
  { path: 'churches/:slug', renderMode: RenderMode.Server },
  { path: 'contribute/:slug', renderMode: RenderMode.Client },
  { path: 'admin/moderation', renderMode: RenderMode.Client },
  // Server-rendered so NotFoundComponent can set a real HTTP 404 via RESPONSE_INIT —
  // RESPONSE_INIT is always null under RenderMode.Client, which would leave every
  // unmatched URL responding 200 (a soft 404 that search engines penalize).
  { path: '**', renderMode: RenderMode.Server },
];
