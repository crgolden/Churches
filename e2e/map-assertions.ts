import { expect } from './fixtures.js';
import type { Page } from '@playwright/test';

export async function expectTileLayerMounted(page: Page, tilesId: string): Promise<void> {
  await expect(page.locator(`#${tilesId}`)).toBeAttached();
}

export async function expectLeafletStylesheetApplied(
  page: Page,
  mapId: string,
  tilesId: string,
): Promise<void> {
  const tileLayerPosition = await page.evaluate(
    id => getComputedStyle(document.getElementById(id)!).position,
    tilesId,
  );
  expect(tileLayerPosition).toBe('absolute');

  const mapContainerOverflow = await page.evaluate(
    id => getComputedStyle(document.getElementById(id)!).overflow,
    mapId,
  );
  expect(mapContainerOverflow).toContain('hidden');
}
