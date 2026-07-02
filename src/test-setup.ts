import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const srcDir = resolve(process.cwd(), 'src');

function buildResourceMap(dir: string, map = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      buildResourceMap(fullPath, map);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.css')) {
      if (!map.has(entry.name)) {
        map.set(entry.name, readFileSync(fullPath, { encoding: 'utf-8' }));
      }
    }
  }
  return map;
}

const resourceMap = buildResourceMap(srcDir);

const resourceResolver = (url: string): Promise<{ text(): Promise<string> }> => {
  const filename = url.split('/').pop()?.split('\\').pop() ?? url;
  const content = resourceMap.get(filename) ?? '';
  return Promise.resolve({ text: () => Promise.resolve(content) });
};

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

beforeEach(async () => {
  await resolveComponentResources(resourceResolver);
});
