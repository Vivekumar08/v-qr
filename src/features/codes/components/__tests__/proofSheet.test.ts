import { describe, expect, it } from 'vitest';
import { readGeometry } from '../ProofSheet';

/**
 * The proof sheet states physical dimensions, so these numbers have to be true.
 *
 * They are read back out of the SVG the backend renders, which means the header
 * below is a contract between two repositories. A regex is exactly the kind of
 * thing that keeps parsing and starts returning nonsense when the other side
 * changes — and a wrong millimetre figure on a proof is worse than no figure,
 * because someone acts on it.
 *
 * This header is verbatim output from the backend's SvgRenderer for a 25mm code
 * at ECC M: 37 total modules, 29 of symbol plus a 4-module quiet zone each side.
 */
const RENDERED = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="25mm" height="25mm"
     viewBox="0 0 37 37"
     shape-rendering="crispEdges">
  <title>UP1DbxBR</title>
  <desc>Module 0.6757mm</desc>
  <path d="M4 4h7v1h-7z" fill="#000000"/>
</svg>`;

const asDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

describe('proof geometry', () => {
  it('reads the printed width the renderer declared', () => {
    expect(readGeometry(asDataUrl(RENDERED))?.widthMm).toBe(25);
  });

  it('derives the module size the renderer computed', () => {
    // 25mm across 37 modules. The renderer independently reports 0.6757mm.
    expect(readGeometry(asDataUrl(RENDERED))?.moduleMm).toBeCloseTo(0.6757, 4);
  });

  it('subtracts the quiet zone to get the symbol size', () => {
    // 37 total minus four clear modules on each side.
    expect(readGeometry(asDataUrl(RENDERED))?.matrixModules).toBe(29);
  });

  it('returns null rather than guessing when the header is not what we expect', () => {
    // A blank field is recoverable. An invented dimension gets printed.
    expect(readGeometry('data:image/svg+xml;utf8,<svg></svg>')).toBeNull();
    expect(readGeometry('not-a-data-url')).toBeNull();
  });

  it('returns null for a malformed data URL rather than throwing', () => {
    expect(readGeometry('data:image/svg+xml;utf8,%E0%A4%A')).toBeNull();
  });
});

/**
 * The console never composes a scan URL.
 *
 * A tenant on a custom domain resolves there, and a locally-built
 * `{slug}.{resolverDomain}` would be a URL on none of their labels — the exact
 * bug the renderer already shipped once.
 */
describe('scan URLs come from the API', () => {
  it('nothing in the codes feature builds one from a slug', async () => {
    const { readFile, readdir } = await import('node:fs/promises');
    const dir = new URL('../', import.meta.url);

    const files = (await readdir(dir)).filter((f) => f.endsWith('.tsx'));
    const sources = await Promise.all(
      files.map(async (f) => readFile(new URL(f, dir), 'utf8')),
    );

    for (const [index, source] of sources.entries()) {
      // A template literal joining a slug to a resolver domain is the shape of
      // the mistake; `scan_url` from the API is the correct source.
      expect(source, files[index]).not.toMatch(/\$\{[^}]*slug[^}]*\}\.\$\{/);
      expect(source, files[index]).not.toContain('resolverDomain}/r/');
    }
  });
});
