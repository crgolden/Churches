import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkDesignUtilities } from '@crgolden/modules/design-gates';

const { passed, report } = checkDesignUtilities({ repoRoot: resolve(dirname(fileURLToPath(import.meta.url)), '..') });
for (const line of report) console.log(line);
process.exit(passed ? 0 : 1);
