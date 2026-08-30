import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { absolute } from './legal-gap-owner-review-common.mjs';

const PDFTOTEXT = 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe';

const SPECS = {
  'CS-FR-TRUCK-BAN-BASE-2021': {
    pageCount: 7,
    markers: [/TRAT2031119A/, /Arr.t. du 16 avril 2021/i, /1er mai 2021/i, /plus de 7,5 tonnes/i, /Article 12|Art\. 12/i, /ANNEXE I/i, /ANNEXE II/i, /ANNEXE III/i],
  },
  'CS-FR-TRUCK-BAN-2026': {
    pageCount: 2,
    markers: [
      /TRAT2529272A/,
      /Arr.t. du 26 d.cembre 2025/i,
      /pour l.ann.e 2026/i,
      /8 janvier 2026\s+JOURNAL OFFICIEL[\s\S]*?Texte 28 sur 98/i,
      /lendemain de sa publication/i,
      /plus de 7,5 tonnes/i,
      /Art\.\s*1/i,
      /Art\.\s*2/i,
      /Art\.\s*3/i,
      /Art\.\s*4/i,
      /7 heures . 18 heures[\s\S]*?7 f.vrier, 14 f.vrier, 21 f.vrier, 28 f.vrier et 7 mars 2026/i,
      /7 heures . 19 heures[\s\S]*?11 juillet, 18 juillet, 25 juillet, 1er ao.t\s+et 8 ao.t 2026/i,
      /ROUTES DU R.SEAU . AUVERGNE-RH.NE-ALPES ./i,
      /Axe Bourg-en-Bresse . Chamonix/i,
      /Axe Grenoble . Chamb.ry/i,
      /RD 1090 entre Montm.lian \(73\) et Pontcharra \(38\)/i,
    ],
  },
  'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026': {
    pageCount: 2,
    markers: [
      /TRAT2621637A/,
      /7 ao.t 2026\s+JOURNAL OFFICIEL[\s\S]*?Texte 47 sur 114/i,
      /Arr.t. du 6 ao.t 2026/i,
      /lendemain de sa publication/i,
      /plus de 7,5 tonnes/i,
      /lutte contre les incendies/i,
      /31 ao.t 2026 inclus/i,
      /retour . vide/i,
      /Art\.\s*1|Article 1/i,
      /Art\.\s*2|Article 2/i,
      /Art\.\s*3|Article 3/i,
      /justifier de la conformit. du transport/i,
      /fourni aux agents de l.autorit. comp.tente/i,
      /M\. LUGRAND/i,
    ],
  },
};

export function validateFranceOwnerIngest(manifest, outDirectory) {
  return manifest.artifacts.map((item) => {
    const relativePath = `${outDirectory}/OWNER_MANUAL_INGEST/${item.filename}`;
    const path = absolute(relativePath);
    if (!existsSync(path)) {
      return { sourceId: item.sourceId, filename: item.filename, relativePath, result: 'MISSING' };
    }

    const bytes = readFileSync(path);
    const latin = bytes.toString('latin1');
    let extracted = '';
    let extractionError = null;
    try {
      extracted = execFileSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', path, '-'], {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch (error) {
      extractionError = error?.message ?? String(error);
    }

    const pages = extracted.split('\f').filter((page) => page.trim().length > 0);
    const spec = SPECS[item.sourceId];
    const checks = {
      pdfMagic: bytes.subarray(0, 5).toString('ascii') === '%PDF-',
      pdfEof: latin.includes('%%EOF'),
      extraction: !extractionError && extracted.trim().length > 100,
      expectedPages: pages.length === spec.pageCount,
      noBlankPages: pages.length > 0 && pages.every((page) => page.trim().length > 100),
      identityAndContent: spec.markers.every((pattern) => pattern.test(extracted)),
      noChallengePage: !/Cloudflare|security verification|Access denied|403 Forbidden|Just a moment/i.test(extracted),
    };

    return {
      sourceId: item.sourceId,
      filename: item.filename,
      relativePath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      sizeBytes: bytes.length,
      pages: pages.length,
      expectedPages: spec.pageCount,
      checks,
      result: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
      extractionError,
    };
  });
}
