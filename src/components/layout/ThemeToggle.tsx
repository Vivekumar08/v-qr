'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Light mode is not an afterthought here. Anyone approving artwork compares it
 * to paper, and that judgement is rarely made in a dark room.
 *
 * Which icon shows is decided by CSS, not by state. The server cannot know
 * which theme the browser will resolve, so rendering either one from JavaScript
 * means a hydration mismatch and a visible flip — and the usual `mounted` flag
 * that papers over it is a set-state-in-effect that costs a second render on
 * every page load.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle light and dark theme"
      // Read at click time rather than during render, so nothing here depends
      // on a value the server could not have known.
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Moon className="size-4 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 dark:block" aria-hidden />
    </Button>
  );
}
