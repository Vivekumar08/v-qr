import type { QrFormat, QrOptions } from './types';

/**
 * URLs for rendered artwork.
 *
 * One place builds these because the preview and the download must agree. If
 * they drifted, the customer would approve one code on screen and send a
 * different one to the press.
 */

export const QR_FORMATS: { value: QrFormat; label: string; hint: string }[] = [
  { value: 'svg', label: 'SVG', hint: 'Vector, opens anywhere' },
  { value: 'pdf', label: 'PDF', hint: 'CMYK, for print vendors' },
  { value: 'eps', label: 'EPS', hint: 'CMYK, older print workflows' },
];

export const ECC_LEVELS: { value: QrOptions['ecc']; label: string }[] = [
  { value: 'L', label: 'L — 7% recovery' },
  { value: 'M', label: 'M — 15% recovery' },
  { value: 'Q', label: 'Q — 25% recovery' },
  { value: 'H', label: 'H — 30% recovery' },
];

export const DEFAULT_QR_OPTIONS: QrOptions = {
  format: 'svg',
  ecc: 'M',
  size_mm: 25,
  print_marks: false,
};

export const qrQueryString = (options: QrOptions): string =>
  new URLSearchParams({
    format: options.format,
    ecc: options.ecc,
    size_mm: String(options.size_mm),
    // The API takes the string, not a flag, so an absent parameter and an
    // explicit `false` mean the same thing rather than differing by accident.
    print_marks: String(options.print_marks),
  }).toString();

/**
 * Same-origin so the proxy attaches the API key. Downloads go through a plain
 * anchor rather than fetch-then-blob: the response streams, and the browser
 * shows its own progress for a large PDF.
 */
export const qrDownloadHref = (codeId: string, options: QrOptions): string =>
  `/api/proxy/v1/codes/${codeId}/qr?${qrQueryString(options)}`;

export const exportHref = (options: QrOptions): string =>
  `/api/proxy/v1/codes/export?${qrQueryString(options)}`;
