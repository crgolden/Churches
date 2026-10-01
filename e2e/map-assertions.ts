import { expect, type Page } from '@playwright/test';
import { computedStyleOf } from './computed-style.js';
import { CssValues } from './css-constants.js';

export async function expectTileLayerMounted(page: Page, tilesId: string): Promise<void> {
  await expect(page.locator(`#${tilesId}`)).toBeAttached();
}

export async function expectLeafletStylesheetApplied(
  page: Page,
  mapId: string,
  tilesId: string,
): Promise<void> {
  const tileLayerPosition = await computedStyleOf(page, tilesId, 'position');
  expect(tileLayerPosition).toBe(CssValues.absolute);

  const mapContainerOverflow = await computedStyleOf(page, mapId, 'overflow');
  expect(mapContainerOverflow).toContain(CssValues.hidden);
}
