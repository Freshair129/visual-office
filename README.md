# Zuri Office World

The owner accepted the measured low-rate Visual Office slice for MVP on
31 October 2026. See [accepted scope and retained limits](docs/game-design/OFFICE-MVP-ACCEPTANCE-20261031.md).
This includes measured department plans, local team/workflow designs and design-ID
export, while preserving the illustrated default shell and Business-scoped
privacy behavior. Physical every-frame 33.3 ms, backend health and live Zuri
registration remain separate, open qualifications.

Visual Office is an optional web client for viewing an office and opening existing workspace
pages. Zuri owns business data, tenant and Business scope, domain definitions, authentication,
Agent identities, and permissions. Office art, saved layouts, and synthetic fixtures do not
create Zuri records or grants.

Temporary Zuri, Wangjai and staff models are available in
`character-lab.html?model=zuri-anime` and the Hybrid floor/Studio appearance
picker. See [character runtime scope](docs/game-design/characters/TEMPORARY-RUNTIME.md).
The owner approved Zuri R4, Wangjai and Staff A/B (originals and LOD1) on
7 November 2026. Other candidates and review assets remain unapproved; choosing
an appearance never adds an Agent.

## External assets

Brand character files, ImageGen artwork, Zuri brand marks and the licensed character
candidates are stored outside Git. The public checkout uses procedural characters
and neutral image placeholders until the optional files are present. To receive
the files from the asset owner (`npm run assets:pull`) and for the handoff
procedure, see [External assets](docs/EXTERNAL-ASSETS.md). New brand or ImageGen
assets go to `asset-store/manifest.json`, never to Git.

## Start a local preview

```powershell
npm ci
npm run preview
# Open http://127.0.0.1:4173/
```

Set `PORT` to use another loopback port. This static preview opens the default `BuildingView`
with the shared canonical Office art. It does not load T3 bridge credentials or forward requests
to a hosted Site.

## Navigate the app

The Office is a full-screen building and lobby with an Office dock and a **เพิ่มเติม** menu. Work,
Chat, Results and Files, Team Knowledge, Team, and Inbox open as separate workspace pages. Chat
uses the existing role profiles and conversation choices; a `#chat/<thread-id>` route is resolved
against current sessions, jobs, and assignments before the conversation is opened. The retired
inline composer and sidebar shell are not part of the current Office UI.

Workspace pages use the existing T3/Worker interfaces. If their data source is unavailable, the
app reports that state instead of presenting an empty or invented feed. Demo mode is read-only.
The pinned domain-floor map and its role cards are display metadata, not an Agent roster or an
access grant.

## Optional connections and local harnesses

The existing T3 bridge remains a separate transport for the T3 workspace. `npm run dev` uses the
local bridge configuration when present; `npm run bridge` starts the configured bridge process.
These commands require configuration already provisioned for this machine.

The local Zuri connector is optional and separate from the T3 bridge. To target a local Zuri server:

```powershell
$env:PORT = '4181'
$env:ZURI_PORT = '3100' # or 3000 for the existing UAT instance
node scripts/serve.mjs --preview --zuri
```

The connector uses a narrow loopback route allowlist and Zuri's existing session and scope. Sign
in to the selected Zuri server in the same browser before testing. Zuri owns authentication,
authorized domains, and Agent identity. This local adapter does not establish a hosted service
integration or provide generic domain-agent dispatch. See [the Office domain boundary](docs/DOMAIN-OFFICE.md#local-zuri-connection).

The synthetic app harnesses exercise different paths:

| Mode | Command | What it represents |
| --- | --- | --- |
| Dynamic domain candidate | `node scripts/serve-marketing-app.mjs --dynamic` | Synthetic candidate context using its exact fixture domain list; no upstream calls or live authorization. |
| Synthetic workspace | `node scripts/serve-marketing-app.mjs --workspace` | Separate in-memory T3 workspace profile through Worker handlers; it cannot be combined with `--dynamic`. |
| Built Worker candidate | `npm run build`, then `node scripts/serve-marketing-app.mjs --worker --dynamic` | Built Worker against the same synthetic adapter; not a live Zuri or production check. |
| Local art snapshot preview | `node scripts/serve-marketing-app.mjs --legacy-art` | Enables the retained local art-snapshot hook; does not restore the retired application shell. |

## Development checks

```powershell
npm run docs:check
npm test
npm run build
```

Source lives in `web/`, local adapters in `scripts/`, and Worker handlers in
`worker/`; the shared route policy is `shared/office-api-routes.js`. `dist/` is
generated deployment output. Build is explicit and does not deploy anything.
For an already provisioned Windows T3 installation, `node scripts/start-office.mjs`
is the retained startup helper; `node scripts/cloud-probe.mjs` checks that configured
Office transport. Provisioned credentials remain outside the repository. Those
commands are separate from the credential-free synthetic harnesses above.

## Documentation and evidence

- [Documentation index](docs/README.md) — document entrypoints and ownership.
- [Domain mapping and connection limits](docs/DOMAIN-OFFICE.md).
- [Visual Office SRS](docs/VISUAL-OFFICE-SRS.md) and [Zuri platform boundary](docs/ZURI-PLATFORM-INTEGRATION-BOUNDARY.md).
- [Design QA](docs/records/design-qa.md) — dated screenshots and local results. Historical test/build counts
  apply only to their recorded revision and are not current validation or hosted/live acceptance.
