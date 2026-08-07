'use client';

/**
 * A press proof, not a preview.
 *
 * Every figure on this sheet is read back out of the SVG the API returned, so
 * the panel cannot claim a dimension the file does not have. That matters more
 * than it sounds: the whole point of the product is that the file going to the
 * press is correct, and a preview that invents its own numbers is worse than no
 * preview at all.
 *
 * The sheet is white in both themes. Artwork is judged against paper, and a QR
 * code floating on #09090B misrepresents it twice over — the quiet zone reads
 * as page rather than as ink-free margin, and a palette that looks confident on
 * black can sit under the 4:1 contrast floor the renderer enforces.
 */

/** Fixed by the renderer and by GS1. Four clear modules on every side. */
const QUIET_ZONE_MODULES = 4;

export interface ProofGeometry {
  widthMm: number;
  moduleMm: number;
  /** Modules across the symbol itself, excluding the quiet zone. */
  matrixModules: number;
  totalModules: number;
}

/**
 * Reads the physical geometry back out of the rendered SVG.
 *
 * The renderer writes a real millimetre width and a module-unit viewBox, which
 * is everything needed. Returns null rather than guessing when the shape is not
 * what we expect — a wrong number on a proof sheet is worse than a blank space.
 */
export const readGeometry = (dataUrl: string): ProofGeometry | null => {
  let svg: string;
  try {
    svg = decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml;utf8,/, ''));
  } catch {
    return null;
  }

  const width = /width="([\d.]+)mm"/.exec(svg);
  const viewBox = /viewBox="0 0 (\d+) \d+"/.exec(svg);
  if (width === null || viewBox === null) return null;

  const widthMm = Number(width[1]);
  const totalModules = Number(viewBox[1]);
  if (!Number.isFinite(widthMm) || !Number.isFinite(totalModules) || totalModules === 0) {
    return null;
  }

  return {
    widthMm,
    moduleMm: widthMm / totalModules,
    matrixModules: totalModules - QUIET_ZONE_MODULES * 2,
    totalModules,
  };
};

export function ProofSheet({
  src,
  geometry,
  ecc,
  printMarks,
  isRendering,
}: {
  src: string;
  geometry: ProofGeometry | null;
  ecc: string;
  printMarks: boolean;
  isRendering: boolean;
}) {
  // The quiet zone as a fraction of the sheet, so the dashed rule lands exactly
  // on the module boundary rather than near it.
  const quietInset =
    geometry === null ? 12 : (QUIET_ZONE_MODULES / geometry.totalModules) * 100;

  return (
    <figure className="space-y-3">
      <div className="proof-sheet relative rounded-lg p-7">
        <TrimMarks />

        <div className="relative">
          <div
            className="proof-quiet-zone absolute inset-0"
            style={{ inset: `${quietInset}%` }}
            aria-hidden
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Proof of the printed code"
            className={`w-full transition-opacity duration-200 ${isRendering ? 'opacity-40' : ''}`}
          />
          {isRendering && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <div className="proof-scanline h-[3px] w-full" />
            </div>
          )}
        </div>
      </div>

      <figcaption className="text-muted-foreground grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[11px] sm:grid-cols-4">
        <Spec label="Width" value={geometry === null ? '—' : `${geometry.widthMm.toFixed(2)} mm`} />
        <Spec
          label="Module"
          value={geometry === null ? '—' : `${geometry.moduleMm.toFixed(3)} mm`}
          // 0.25mm is the floor the renderer refuses to print below. Showing how
          // close a code sits to it is the difference between a label that scans
          // in a warehouse and one that does not.
          warn={geometry !== null && geometry.moduleMm < 0.3}
        />
        <Spec label="Symbol" value={geometry === null ? '—' : `${geometry.matrixModules}²`} />
        <Spec label="ECC" value={ecc} />
        <Spec label="Quiet zone" value={`${QUIET_ZONE_MODULES} modules`} />
        <Spec label="Colour" value="CMYK 0/0/0/100" />
        <Spec label="Bleed" value={printMarks ? '3 mm' : 'none'} />
        <Spec label="Output" value="Vector" />
      </figcaption>
    </figure>
  );
}

function Spec({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <span className="text-muted-foreground/70 block text-[10px] tracking-wide uppercase">
        {label}
      </span>
      <span className={warn === true ? 'text-destructive' : 'text-foreground'}>{value}</span>
    </div>
  );
}

/** Corner trim marks, the way a proof arrives from a print vendor. */
function TrimMarks() {
  const corners = [
    'top-2 left-2 border-t border-l',
    'top-2 right-2 border-t border-r',
    'bottom-2 left-2 border-b border-l',
    'bottom-2 right-2 border-b border-r',
  ];

  return (
    <>
      {corners.map((position) => (
        <span key={position} className={`proof-mark ${position}`} aria-hidden />
      ))}
    </>
  );
}
