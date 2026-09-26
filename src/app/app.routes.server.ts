import { RenderMode, ServerRoute } from '@angular/ssr';
import { AppPaths } from './app-paths';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: AppPaths.churches, renderMode: RenderMode.Server },
  { path: `${AppPaths.churches}/:slug`, renderMode: RenderMode.Server },
  { path: `${AppPaths.contribute}/:slug`, renderMode: RenderMode.Client },
  { path: AppPaths.adminModeration, renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
