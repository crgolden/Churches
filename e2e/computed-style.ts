import type { Page } from '@playwright/test';

export async function computedStyleOf(page: Page, elementId: string, property: string): Promise<string> {
  return page.evaluate(
    ([id, prop]) => {
      const element = document.getElementById(id);
      if (element === null) {
        throw new Error(`No element with id "${id}" is in the document`);
      }
      return getComputedStyle(element).getPropertyValue(prop);
    },
    [elementId, property] as const,
  );
}
