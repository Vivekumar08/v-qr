# qr-infra console

Next.js 16 (App Router) + Tailwind v4 + shadcn/ui + Redux Toolkit Query.

Consumes the qr-infra API. The backend lives in a separate repository alongside this one.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in QR_INFRA_API_KEY
pnpm dev
```

Requires the backend running and reachable at `API_BASE_URL` (default
`http://127.0.0.1:8787`).

## The API key never reaches the browser

Requests go to `/api/proxy/*` — a route handler that attaches the key server-side and forwards to
the API.

Neither environment variable is `NEXT_PUBLIC_*`, deliberately. Anything with that prefix is compiled
into the client bundle, so a key with `codes:write` there is a key any visitor can lift from
devtools — and revoking a code is not reversible, because the label is already printed.

The proxy is also the seam where real user sessions belong. Today every request uses one tenant's
key; when the console gains authentication, the key is selected per session there, and no client
code changes.

## Layout

```
src/
├── app/
│   ├── api/proxy/[...path]/   server-side API proxy
│   ├── codes/                 codes screen
│   └── layout.tsx             store provider + toaster
├── components/
│   ├── layout/                server components, no client cost
│   └── ui/                    shadcn primitives
├── features/codes/            feature-scoped components
└── lib/
    ├── api/                   RTK Query slice, wire types, error normalisation
    └── store/                 store factory, typed hooks, provider
```

## Conventions

- **Server components by default.** `'use client'` only where there is interactivity or a hook.
- **One error shape.** The API returns a single envelope; `normaliseError` unwraps it once so no
  component reaches into `error.data.error.message`. Validation failures carry `param`, which is
  rendered against the field rather than in a toast.
- **Mutations send an idempotency key.** The API replays a repeat instead of creating a second code.
  A printed duplicate is unrecoverable, so an impatient double-click must not produce one.
- **Cache tags are per code**, not global, so revoking one code refetches that row and the list
  rather than every query.
- **The store is a factory, not a singleton** — a module-level store would be shared across requests
  on the server and leak one user's cache into another's render.

## Notes

shadcn's current default style (`base-nova`) is built on **Base UI**, not Radix. Composition uses a
`render` prop rather than `asChild`:

```tsx
<DialogTrigger render={<Button />}>New code</DialogTrigger>
```

## Status

Working: list codes with cursor pagination, create (with GS1 fields and inline field errors), revoke
with confirmation, empty/loading/error states.

Not built yet: authentication, code detail page, scan analytics views, QR preview and download,
batch export UI. The API supports all of them.
