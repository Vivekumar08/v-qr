'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Copy, with the result shown on the button itself.
 *
 * A toast would be the easy choice, but this fires often enough that a toast
 * every time becomes noise — and the confirmation belongs where the click was.
 */
export function CopyButton({
  value,
  label = 'Copy',
  size = 'xs',
  variant = 'ghost',
  className,
}: {
  value: string;
  label?: string;
  size?: 'xs' | 'sm';
  variant?: 'ghost' | 'outline';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Denied permission, or an insecure origin. Saying nothing is wrong, but
      // so is a scary error for something the person can still do by hand.
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      aria-label={`${label} ${value}`}
      onClick={() => void copy()}
    >
      {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
