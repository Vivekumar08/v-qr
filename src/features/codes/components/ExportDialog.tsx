'use client';

import { useState } from 'react';
import { DEFAULT_QR_OPTIONS, ECC_LEVELS, QR_FORMATS, exportHref } from '@/lib/api/qrUrl';
import { usePlanQuery } from '@/lib/api/qrInfraApi';
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
 *
 * That same plain-anchor shape is why this must be gated up front. On a plan
 * without `export`, the API answers the download with a 403 JSON error body,
 * and a bare anchor has no way to inspect that — the browser just saves the
 * error envelope to disk as a file named "qr-codes.zip". Disabling the trigger
 * before the request ever fires is the only way to avoid handing out a corrupt
 * zip with no explanation.
 */
export function ExportDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<QrOptions>({ ...DEFAULT_QR_OPTIONS, format: 'pdf' });
  const { data: plan } = usePlanQuery();

  // Undefined while the plan is still loading is treated as allowed, same as
  // CreateCodeDialog's `atLimit`: the control should not flash disabled before
  // data arrives, only once we know the tenant lacks the feature.
  const canExport = plan === undefined || plan.limits.features.includes('export');

  const set = <K extends keyof QrOptions>(key: K, value: QrOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }));

  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" disabled={!canExport} />}>
          Export all
        </DialogTrigger>

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
                Validated before the zip starts, so a width too small to scan fails immediately
                rather than part-way through the export.
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

      {!canExport && plan !== undefined && (
        <p className="text-muted-foreground mt-1 text-xs">
          Bulk export is not on the {plan.plan} plan. Upgrade to export every code as a zip.
        </p>
      )}
    </div>
  );
}
