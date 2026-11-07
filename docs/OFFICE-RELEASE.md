---
title: Visual Office static release artifact
status: current — build and verification instructions for the accepted /office/ deployment direction
updated_at: 2026-11-07
---

# Visual Office static release artifact

This guide defines the Visual Office side of the accepted 7 November 2026
deployment decision: Zuri may serve a reviewed, pinned Visual Office client from
its own origin at `/office/`. It does not claim that Zuri has implemented that
route, published Office API contracts, or deployed this artifact.

## Build and check

Run the existing asset/client build first. It creates the generated models and
local vendor files consumed by the page bundle. The release command then writes
the static client under `release/office/` and its provenance beside it at
`release/office-release.json`:

```powershell
npm run build
npm run release
npm run release:check
```

To build for a different same-origin API prefix, set `OFFICE_API_BASE` for that
process. It accepts a path only; schemes, protocol-relative URLs, query strings,
fragments and parent-directory traversal are rejected. The default is the
current same-origin `/api/` prefix:

```powershell
$env:OFFICE_API_BASE = '/api/'
npm run release
```

`release:check` verifies the provenance hashes, scans every artifact HTML/CSS/JS
file, starts a local HTTP server at the `/office/` prefix with the CSP below, and
requests each HTML page and every referenced local resource. It does not execute
the client in a browser. The release builder writes no timestamp, checks the
source-input fingerprint, and refuses a same-revision/same-input rebuild if the
artifact hash changes. It also refuses to overwrite unexpected stale files in
`release/office/`; it does not clear that directory.

For a manual browser check after building:

1. Run `npm run release:serve` and open the printed `http://127.0.0.1:4177/office/` URL.
2. Open DevTools Console and Network, enable **Preserve log**, and reload. Confirm
   the page, CSS, JavaScript chunks, fonts and images load with no CSP violations.
3. Follow a few `#office/...` routes and reload the page on a route. Confirm the
   URL remains under `/office/` and local resources still load.
4. Open `/office/character-lab.html?model=zuri-face-r4`, switch characters and
   views, then reload it directly. Confirm no module-map, asset-path or CSP error.
5. Inspect Network requests. Static resources must stay on the current origin
   under `/office/`; any API request uses the configured same-origin API path.
   The local static server intentionally does not implement an API or qualify
   Zuri integration.

## Artifact contents

The artifact contains `index.html` and `character-lab.html`, their CSS and
bundled JavaScript, local fonts, runtime manifests, and runtime assets. Esbuild
bundles the Three.js imports into local modules, so pages do not need an inline
import map. All static paths remain relative to `/office/`; hash routes do not
change the pathname. There is no service worker in this client.

The release includes only repository-tracked runtime assets and external files
whose exact paths occur in `asset-store/manifest.json` and whose byte length and
SHA-256 match that record. The artifact provenance lists every included external
asset by source path and hash. Unlisted machine files are excluded. Manifest
source files outside `web/assets/` (such as editable Blender sources and review
inputs) are not client runtime assets. If a listed optional asset is absent on a
public checkout, it is recorded as missing and the existing procedural or
placeholder fallback remains available.

The artifact excludes `worker/`, `dist/server`, build and serve scripts, tests,
performance pages, the prop baker and synthetic Marketing tools. The dynamic
domain candidate modules are omitted from the app bundle. The existing candidate
Zuri connector is replaced in the release bundle by a fail-closed unavailable
adapter; no synthetic `/api/zuri/*` route is emitted. The Office Worker is a
separate deployment input and may hold T3 runner data only. It must not hold
canonical Zuri Business data.

The release removes the local `127.0.0.1:3773` T3 launcher link from its copy of
`index.html`. Source HTML retains the local development flow. No source art or
`asset-store/manifest.json` bytes are edited by the release command.

In the release build, interactive HTML result snippets open as read-only,
sanitized previews. Their scripts, styles, forms, frames and resource URLs are
removed so user supplied markup cannot bypass the page CSP. The ordinary local
development preview retains its existing sandboxed behavior.

## Content Security Policy

The local release server and checker apply this HTTP response header to every
artifact response:

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; object-src 'none'
```

Every `web/` HTML entry has external scripts and styles. Inline import maps were
removed from `index.html`, `character-lab.html`, `tools/office-prop-baker.html`
and `tools/marketing-preview.html`. The inline style blocks were moved out of
`office-prop-baker.html` and `marketing-preview.html`; the style attribute in
`tools/marketing-controls.html` now lives in an external stylesheet. Its inline
module script now lives in `tools/marketing-controls.js`. The permissive CSP meta
element and root `<base>` element were removed from the synthetic preview page.
There were no inline event-handler attributes in the page set. Browser event
listeners remain in external JavaScript.

`release:check` rejects inline script/style/handler attributes, import maps,
`eval()` and `new Function()`, remote HTML/CSS/module resource references, and
missing local references. It serves the built artifact under `/office/` with the
header above and fetches every statically referenced resource. A real-browser
check is still required from the lead using the steps above.

## Provenance format

`release/office-release.json` records the repository and Git revision, each
source input path and SHA-256 plus their aggregate fingerprint, `/office/` base
path, build-time API base, Node, esbuild and Three.js versions, the external
asset policy, and every artifact file's relative path, SHA-256 and byte length.
`artifact.sha256` is computed over
paths sorted by ordinal order, with each UTF-8 line encoded exactly as
`path<TAB>sha256<LF>`; the provenance JSON itself is outside the artifact hash.
`sourceInputsSha256` uses the same sorted path/hash line format over the
`sourceInputs` entries; optional absent manifest files have the explicit value
`missing`.

The shape is compatible with a vendor pin record; file entries below are
illustrative:

```json
{
  "schemaVersion": "office-release/v1",
  "repository": "https://github.com/Freshair129/visual-office",
  "revision": "<40-character Git revision>",
  "sourceInputsSha256": "<sha256>",
  "sourceInputs": [
    {"path": "web/index.html", "sha256": "<sha256>"},
    {"path": "web/app.js", "sha256": "<sha256>"}
  ],
  "basePath": "/office/",
  "apiBase": "/api/",
  "tools": {"node": "v<version>", "esbuild": "<version>", "three": "<version>"},
  "externalAssetPolicy": {
    "manifestPath": "asset-store/manifest.json",
    "manifestSha256": "<sha256>",
    "included": [
      {"sourcePath": "web/assets/...", "artifactPath": "assets/...", "sha256": "<sha256>", "sizeBytes": 123, "class": "...", "licenseNote": "..."}
    ],
    "missingOptional": []
  },
  "artifact": {
    "algorithm": "sha256(sorted UTF-8 lines: path<TAB>sha256<LF>)",
    "sha256": "<sha256>",
    "fileCount": 123,
    "totalSizeBytes": 456,
    "files": [{"path": "index.html", "sha256": "<sha256>", "sizeBytes": 789}]
  }
}
```

Zuri can copy the complete artifact and provenance, verify every file hash and
the sorted-list artifact hash, then pin the revision and artifact digest in its
own vendor provenance record. The release is deterministic for the same
revision, source-input fingerprint, tool versions and manifest-listed bytes.

## Remaining Zuri work — proposals, not implementation claims

The following need Zuri product/platform ownership and a Zuri-side change:

- Define a Zuri feature request and acceptance criteria for serving the reviewed
  artifact at `/office/` on the Zuri origin, including access and rollback.
- Configure the static route (including a trailing-slash redirect from
  `/office`), content types and the CSP response header for all `/office/`
  resources.
- Define the G5 API contracts and the allowed same-origin routes before enabling
  any Zuri Business reads or writes. The current `/api/` default is a build-time
  path setting for existing Office Worker consumers; it does not define live
  Zuri routes or qualify an integration.
- Add the Visual Office release to Zuri review and CI as trusted code, then pin
  the chosen revision, artifact hash and included asset hashes in Zuri's vendor
  provenance record. Pin changes should follow the existing review process.

These proposals do not state that a Zuri feature request, serving route, CSP
header, vendor pin or live API contract exists today.
