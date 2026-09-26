import { createDirectoryApp } from './directory.js';
import { e2eContract } from './e2e-contract.js';

const port = e2eContract().mockDirectoryPort;
const app = createDirectoryApp();

app.listen(port, () => {
  console.log(`[MockDirectory] Listening on http://localhost:${port}`);
});
