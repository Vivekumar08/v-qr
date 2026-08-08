import { Button } from '@/components/ui/button';

/**
 * A link, not a fetch.
 *
 * The backend owns the OAuth flow, so this is a plain navigation to an endpoint
 * that answers with a redirect to Google. Going through fetch would fight the
 * browser over a cross-origin redirect for no benefit.
 */
export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  return (
    <Button
      variant="outline"
      className="w-full"
      nativeButton={false}
      render={
        // A real navigation, not next/link. The href is a route handler that
        // answers with a 302 to Google; client-side routing would try to render
        // it as a page and fail.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a href="/api/proxy/v1/auth/google/start" />
      }
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path
          fill="currentColor"
          d="M12 11v3.4h4.8c-.2 1.2-1.4 3.6-4.8 3.6a5 5 0 1 1 0-10c1.6 0 2.6.7 3.2 1.2l2.2-2.1C15.9 5.7 14.1 5 12 5a7 7 0 1 0 0 14c4 0 6.7-2.8 6.7-6.8 0-.5 0-.8-.1-1.2H12Z"
        />
      </svg>
      {label}
    </Button>
  );
}
