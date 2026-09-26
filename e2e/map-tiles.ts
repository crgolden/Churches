import type { Page } from '@playwright/test';
import { LeafletUrlTemplate } from './leaflet-constants.js';
import { environment } from '../src/environments/environment.ci';

const tileHost = new URL(environment.mapTileUrlTemplate.replace(LeafletUrlTemplate.subdomainPlaceholder, '')).hostname;

function isMapTileRequest(url: URL): boolean {
  return url.hostname === tileHost || url.hostname.endsWith(`.${tileHost}`);
}

export async function abortMapTiles(page: Page): Promise<void> {
  await page.route(isMapTileRequest, route => route.abort());
}
