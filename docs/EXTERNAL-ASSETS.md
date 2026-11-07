# External assets

The public repository keeps visual-office code, metadata, hashes, prompts,
provenance, license records, test fixtures and procedural assets. Brand
characters (including revisions and review art), ImageGen images, Zuri brand
marks, and third-party character candidates are **not in Git**. Their repository
paths, byte counts, SHA-256 values, content types, classes and license notes are
recorded in [`asset-store/manifest.json`](../asset-store/manifest.json), and
`.gitignore` lists each path.

The application works without those files. Character runtime uses its existing
procedural actor; missing backgrounds, logos, skins and art use a neutral local
placeholder or the existing model material. `npm run build` includes files that
are present and skips absent files. Tests that need the real bytes skip with
`external assets not present; run npm run assets:pull`; set
`VO_REQUIRE_EXTERNAL_ASSETS=1` to turn those skips into failures. The
documentation checker accepts a link to an external file only when its exact
path is in the manifest.

## Where the files live (7 November 2026)

There is one developer machine today. The **source of truth is that machine's
working tree**: the external files sit at their normal repository paths as
ordinary, gitignored files. Day-to-day work needs no object store.

- Check local bytes against the manifest: `npm run assets:verify`.
- Add or replace an approved file: put the original bytes at its repository
  path, run `npm run assets:manifest` (refreshes hashes and the ignore block),
  review the manifest diff and commit it. Never edit an existing asset to make
  its hash match. New brand or ImageGen files go to the manifest, never to Git.
  Procedural/code-generated assets and non-brand fixtures such as the Kenney CC0
  chairs remain in Git.

A dedicated S3-compatible RustFS store is kept **stopped** on the owner's
machine. It is used only to hand the files to another developer or machine
(and later, if several developers work at once, it can become the shared
store). Routine work never pushes to it.

## Handoff: giving the files to another developer

The sender (current asset owner):

1. Start the dedicated RustFS stack (its compose project lives outside this
   repository; it is not the Zuri production RustFS).
2. Make the store current: `npm run assets:verify`, then `npm run assets:push`.
   Push creates the bucket if needed, uploads only files whose size or checksum
   differs, and verifies each upload.
3. Expose the endpoint to the recipient only, for example over a private
   tailnet or a temporary LAN binding. Do not publish it on the internet.
4. Send the recipient, **out of band** (never in Git, an issue or a PR):
   the endpoint URL, the bucket name and a credential for it.
5. Record what was handed off — date, endpoint, bucket, manifest commit — in the
   local, gitignored note `.local/asset-handoff.md`. Real URLs and credentials
   stay in that note and never in this repository.
6. When the handoff is done, close the exposure and stop the stack again.

The recipient:

```powershell
$env:VO_ASSET_S3_ENDPOINT   = '<endpoint URL from the sender>'   # e.g. http://<host>:9100
$env:VO_ASSET_S3_BUCKET     = 'visual-office-assets'             # default
$env:VO_ASSET_S3_ACCESS_KEY = '<from the sender>'
$env:VO_ASSET_S3_SECRET_KEY = '<from the sender>'
npm run assets:pull     # downloads missing or mismatched files, checks SHA-256
npm run assets:verify   # expect: Verified N/N external assets
```

Instead of the two key variables, `VO_ASSET_S3_ENV_FILE` may point to a private
env file outside Git that defines `RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY`.
Defaults are endpoint `http://127.0.0.1:9100` and bucket `visual-office-assets`.
The scripts never print credentials.
