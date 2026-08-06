'use client';

import { useState } from 'react';
import { DEFAULT_QR_OPTIONS, ECC_LEVELS, QR_FORMATS, exportHref } from '@/lib/api/qrUrl';
import type { QrOptions } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Batch export of every code the tenant owns.
 *
 * The download is a plain anchor, not a fetch: the API streams the zip a file
 * at a time, and letting the browser own the transfer means a 50k-code export
 * shows real progress and survives a tab that is not focused. Buffering it into
 * a blob here would defeat the streaming the API went out of its way to do.
 */
export function ExportDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<QrOptions>({ ...DEFAULT_QR_OPTIONS, format: 'pdf' });

  const set = <K extends keyof QrOptions>(key: K, value: QrOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Export all</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export artwork</DialogTitle>
          <DialogDescription>
            One file per code plus a CSV manifest, as a zip. The manifest lists the scan URL and
            printed module size for every file, which is what a print vendor reconciles against.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="export-format">Format</Label>
              <Select
                value={options.format}
                onValueChange={(value) => set('format', value as QrOptions['format'])}
              >
                <SelectTrigger id="export-format">
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
              <Label htmlFor="export-ecc">Error correction</Label>
              <Select
                value={options.ecc}
                onValueChange={(value) => set('ecc', value as QrOptions['ecc'])}
              >
                <SelectTrigger id="export-ecc">
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
            <Label htmlFor="export-size">Printed width (mm)</Label>
            <Input
              id="export-size"
              type="number"
              min={5}
              max={500}
              value={options.size_mm}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) set('size_mm', next);
              }}
            />
            <p className="text-muted-foreground text-xs">
              Validated before the zip starts, so a width too small to scan fails immediately rather
              than part-way through the export.
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
                Adds 3mm bleed to every file.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            nativeButton={false}
            render={<a href={exportHref(options)} download="qr-codes.zip" />}
            onClick={() => setOpen(false)}
          >
            Download zip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
