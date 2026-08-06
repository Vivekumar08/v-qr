'use client';

import { useState } from 'react';
import { usePreviewQrQuery } from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import {
  DEFAULT_QR_OPTIONS,
  ECC_LEVELS,
  QR_FORMATS,
  qrDownloadHref,
} from '@/lib/api/qrUrl';
import type { QrOptions } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Artwork preview and download.
 *
 * The preview is always SVG regardless of the download format, because it is
 * the same matrix at the same geometry in every format — and it is the only one
 * a browser renders. What changes with format is the colour space, which a
 * screen cannot show honestly anyway.
 */
export function QrPanel({ codeId, shortCode }: { codeId: string; shortCode: string }) {
  const [options, setOptions] = useState<QrOptions>(DEFAULT_QR_OPTIONS);

  // Debouncing the size would only delay a render that already takes
  // milliseconds; RTK Query dedupes the in-flight request instead.
  const { data, error, isFetching } = usePreviewQrQuery({
    id: codeId,
    ecc: options.ecc,
    size_mm: options.size_mm,
    print_marks: options.print_marks,
  });

  const set = <K extends keyof QrOptions>(key: K, value: QrOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Artwork</CardTitle>
        <CardDescription>
          Encodes the scan URL, not the destination — so the file stays valid after a repoint.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
        <div className="bg-muted/30 flex aspect-square items-center justify-center rounded-lg border p-4">
          <QrPreview data={data} error={error} isFetching={isFetching} />
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qr-format">Format</Label>
              <Select
                value={options.format}
                onValueChange={(value) => set('format', value as QrOptions['format'])}
              >
                <SelectTrigger id="qr-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QR_FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label} — {format.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr-ecc">Error correction</Label>
              <Select
                value={options.ecc}
                onValueChange={(value) => set('ecc', value as QrOptions['ecc'])}
              >
                <SelectTrigger id="qr-ecc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ECC_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qr-size">Printed width (mm)</Label>
            <Input
              id="qr-size"
              type="number"
              min={5}
              max={500}
              step={1}
              value={options.size_mm}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) set('size_mm', next);
              }}
            />
            <p className="text-muted-foreground text-xs">
              The API refuses a width whose modules would print too small to scan, and names the
              smallest that works.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={options.print_marks}
              onChange={(event) => set('print_marks', event.target.checked)}
            />
            <span>
              Bleed and registration marks
              <span className="text-muted-foreground block text-xs">
                Adds 3mm bleed. Ask the print vendor before enabling — the page grows.
              </span>
            </span>
          </label>

          <Button
            className="w-full sm:w-auto"
            nativeButton={false}
            render={
              <a href={qrDownloadHref(codeId, options)} download={`${shortCode}.${options.format}`} />
            }
          >
            Download {options.format.toUpperCase()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QrPreview({
  data,
  error,
  isFetching,
}: {
  data: string | undefined;
  error: unknown;
  isFetching: boolean;
}) {
  if (error !== undefined) {
    // Almost always a real, actionable constraint — a width below the module
    // floor, or a palette under the contrast minimum.
    const { message } = normaliseError(error);
    return <p className="text-destructive px-2 text-center text-sm">{message}</p>;
  }

  if (data === undefined) return <Skeleton className="h-full w-full" />;

  // Deliberately not next/image: the source is a data URL produced per render
  // request, so there is nothing for the optimiser to cache or resize, and the
  // SVG scales losslessly on its own.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={data}
      alt="QR code preview"
      className={`h-full w-full object-contain transition-opacity ${isFetching ? 'opacity-50' : ''}`}
    />
  );
}
