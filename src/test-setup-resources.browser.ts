import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';

const componentResources: Record<string, string> = import.meta.glob<string>('./**/*.{html,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function indexByFileName(resources: Record<string, string>): Map<string, string> {
  const byFileName = new Map<string, string>();
  for (const [path, content] of Object.entries(resources)) {
    const filename = path.split('/').pop() ?? path;
    if (byFileName.has(filename)) {
      throw new Error(`Two component resources are named '${filename}', so a templateUrl cannot say which one it means.`);
    }
    byFileName.set(filename, content);
  }
  return byFileName;
}

const resourceByFileName = indexByFileName(componentResources);

const resourceResolver = (url: string): Promise<{ text(): Promise<string> }> => {
  const filename = url.split('/').pop() ?? url;
  const content = resourceByFileName.get(filename);
  if (content === undefined) {
    throw new Error(
      `No file named '${filename}' exists under src/, so the component under test would render empty and assert nothing.`,
    );
  }
  return Promise.resolve({ text: () => Promise.resolve(content) });
};

export async function resolveTestComponentResources(): Promise<void> {
  await resolveComponentResources(resourceResolver);
}
