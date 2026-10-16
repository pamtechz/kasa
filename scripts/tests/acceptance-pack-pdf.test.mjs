import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';

test('official headed paper template file exists in public directory', () => {
  const templatePath = join(process.cwd(), 'public', 'kasa-headed-paper-template.pdf');
  assert.equal(existsSync(templatePath), true, 'Template file must exist');
});

test('official headed paper template is valid and can be embedded across 5 pages', async () => {
  const templatePath = join(process.cwd(), 'public', 'kasa-headed-paper-template.pdf');
  const templateBytes = readFileSync(templatePath);
  const templateDoc = await PDFDocument.load(templateBytes);
  assert.equal(templateDoc.getPageCount(), 1, 'Template must be 1 page');

  const doc = await PDFDocument.create();
  const [templatePage] = await doc.embedPdf(templateDoc, [0]);
  for (let i = 0; i < 5; i++) {
    const page = doc.addPage([595, 842]);
    page.drawPage(templatePage, {x: 0, y: 0, width: 595, height: 842});
  }

  const out = await doc.save();
  assert.ok(out instanceof Uint8Array);
  assert.ok(out.length > 50000, 'Embedded 5-page PDF should be substantial');

  const loaded = await PDFDocument.load(out);
  assert.equal(loaded.getPageCount(), 5);
});

test('pdf-acceptance-pack source integrates official headed paper template', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'lib', 'pdf-acceptance-pack.ts'), 'utf8');
  assert.match(source, /kasa-headed-paper-template\.pdf/);
  assert.match(source, /embedPdf/);
  assert.match(source, /drawHeadedPaper/);
});
