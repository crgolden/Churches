import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'churches', renderMode: RenderMode.Server },
  { path: 'churches/:slug', renderMode: RenderMode.Server },
  { path: 'contribute/:slug', renderMode: RenderMode.Client },
  { path: 'admin/moderation', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client },
];
