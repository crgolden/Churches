import { createDirectoryApp } from './directory.js';

const PORT = parseInt(process.env['MOCK_DIR_PORT'] ?? '4001', 10);
const app = createDirectoryApp();

app.listen(PORT, () => {
  console.log(`[MockDirectory] Listening on http://localhost:${PORT}`);
});
