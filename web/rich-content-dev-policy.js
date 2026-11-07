// Development-only policy for interactive HTML previews. The Office release
// replaces this module with a stub (scripts/office-release-bundle.mjs) so the
// release client never contains an unsafe-inline policy.
export const DEVELOPMENT_INTERACTIVE_POLICY="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; worker-src 'none'";
