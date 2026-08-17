// Stand-in for the `server-only` package inside Vitest.
//
// The real package deliberately throws when it is resolved through a client
// entrypoint, which is how it stops a server module reaching the browser bundle.
// A test runner has no bundle to protect, so importing it there fails for a
// reason that does not apply. `next build` still enforces the real thing.
export {};
