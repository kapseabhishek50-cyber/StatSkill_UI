import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractText } from './docExtract.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Keep the regression test on the package's known-good PDF fixture. The test
// exercises the same in-memory buffer contract used by Multer in the route.
test('extracts text from a PDF buffer without opening a package fixture path', async () => {
  const fixture = path.resolve(here, '../../../node_modules/pdf-parse/test/data/01-valid.pdf');
  const result = await extractText({
    buffer: await fs.readFile(fixture),
    mimetype: 'application/pdf',
    originalname: 'uploaded.pdf',
  });

  assert.ok(result.chars > 0);
  assert.match(result.text, /Trace-based Just-in-Time Type Specialization/);
});
