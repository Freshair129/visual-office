---
title: Visual Office and Zuri platform integration boundary
status: discussion-record
updated_at: 2026-10-26
---

# Visual Office and Zuri platform integration boundary

**Current approved direction / implementation boundary — 26 October 2026:** Office
is an optional, separately hosted registered web client; Zuri owns auth, scope and
business APIs. “Service” in earlier planning does not create an Office business
domain/backend or an adopted Zuri service contract. The dynamic-domain candidate
is implemented and qualified with synthetic fixtures only. Studio/shared scene
saves, roster/execution adoption and real commands remain contract-gated. Read
[current domain modes](DOMAIN-OFFICE.md) and [API audit](API-ENDPOINT-AUDIT.md).

**23 October scope refinement:** The owner now requests the Building/Lobby/Projects Tycoon slice with actual Zuri reads and agent commands. Investigation and frontend integration planning are resumed for that slice; the [current dependency/source audit](game-design/TYCOON-INTEGRATION-AND-ACCEPTANCE.md) distinguishes existing routes from approved Office-client contracts and live acceptance. All authority and contract requirements below remain. The earlier blanket instruction to continue only offline work does not prevent current source investigation or implementation against an owner-approved contract; it never authorizes inventing one.

This document records the product and data-flow discussion for joining Visual Office to Zuri.ai. It guides Visual Office work; it is not a published Zuri API/event contract or a claim that an integration is live. Zuri's platform contract remains the source of truth when it is published.

## Product shape and ownership

Visual Office is an optional visual frontend surface for operating and understanding a Zuri business. A person can use Zuri without opening Visual Office. The Office must not become a second authority for business data, agents or permissions.

| Information or action | Authority | Visual Office responsibility |
| --- | --- | --- |
| Tenant, Business, Workspace, domain IDs and access | Zuri platform | Read the authorized context and render it; never invent or persist canonical IDs as local identity |
| Authorized leaf Business domains; group/module metadata | Zuri platform | Present one floor per returned leaf Business domain, plus G/Lobby; groups/modules/services do not create floors or grants |
| Agent definitions, actual roles, permissions and live status | Zuri platform | Display the roster and role count returned for that domain; never pad, rename, merge or infer roles from artwork |
| Agent commands and business CRUD | Zuri platform API | Present permitted actions and submit them through the owner API; report the committed result or conflict |
| Scene layout, avatar illustration, furniture and finishes | Visual Office design surface | Edit visual state and its approved per-floor design snapshot without changing agent/domain records |

The first viewport is a building overview with all returned domains. G opens the Lobby. The elevator directory selects a domain floor. A domain's real agent count and roles determine what is presented there; if the platform reports four agents and four roles, the floor presents those four records. The current local floor list is a prototype and must not be treated as the tenant's authoritative domain list.

## Command, transaction and event flow

CRUD on canonical Zuri objects should use a request/response API command. The platform validates the caller and scope, applies the write transaction, records its audit event and returns the authoritative object/version before Visual Office reports success. An asynchronous event bus is useful after commit for projections, notifications and other subscribers; it is not a substitute for the write response and does not make conflicting writes safe by itself.

For a shared object edited from Zuri and Visual Office, the owner API should accept a version/ETag precondition and an idempotency key. The platform serializes and commits each valid command, then returns the new version. If the client's version is stale, return a conflict (for example 409/412) with enough information to reload and review; do not silently overwrite either user's change. Keep audit attribution and authorization on the platform.

Long-running agent execution is a separate workflow from CRUD. If an authorized agent run takes time, the API may return a durable operation ID and later publish status events. Visual Office can subscribe or poll for that operation, but must not display a successful business write before Zuri confirms it.

| Concern | Intended rule |
| --- | --- |
| Canonical read or CRUD | Authenticated, scoped API request/response; success means the platform committed or returned the authoritative record |
| Concurrent writes | Transaction at the owner; expected version/ETag; explicit conflict response; no browser-side last-write-wins |
| Duplicate delivery/retry | Idempotency key for mutation/command requests, retained according to the platform contract |
| Events | Emit after commit from an outbox or equivalent reliable mechanism; consumers are idempotent and may be eventually consistent |
| Browser connection | Authenticated API and an approved stream/polling endpoint; browser does not connect to a broker or database directly |
| Studio draft | Current MVP uses browser-local preview storage plus explicit versioned JSON export; never treat it as durable cross-device state or silently apply it to a business record |

The Zuri target architecture describes a progression from an in-process event bus to a transactional outbox and a later external broker. That is target guidance, not evidence that one shared deployed bus already connects Zuri and Visual Office. Confirm the current source against `zuri.ai/docs/ARCHITECTURE-TARGET-MODULAR-MONOLITH.md` and the published platform contract before choosing an adapter.

## Scene state and asset storage

A floor design is structured state: asset IDs and versions, transforms, material/finish choices, layer order and declarative interactions. Store that as a versioned JSON document; keep the GLB, mesh source and preview image in an asset store and reference them from the scene. Do not pack binary models into every floor JSON file. The catalog should carry a stable asset ID, revision/hash, renderer type, preview and compatibility metadata.

Today, Hybrid and Native Studio save local preview state and export validated v1
floor files; Tycoon adds its separate `tycoon3d` edition and `office-floor/v2`.
Custom GLB bytes use IndexedDB; portable furniture-set files can embed model,
texture and preview bytes for explicit cross-machine exchange. These portable
sets differ from ordinary floor snapshots; see [GLB asset exchange](OFFICE-BLUEPRINTS.md).
Browser storage may be cleared and is not shared durable storage; export is not
a collaborative database or automatic build/deploy pipeline. Floor Save does not
compile or publish a model. Static/personal catalogs are not a platform-managed
shared repository; dynamic Studio stays disabled pending its scope-safe contract.

When scene state becomes shared business configuration, persist the versioned document behind the authorized platform API (or a platform-approved configuration service) with the same expected-version, idempotency and audit rules as other canonical writes. An offline editor may keep a draft and ask the user to resolve a conflict on reconnect. Visual Office should not create a second canonical database or client-side WAL; the platform's chosen persistence layer owns durability and transaction logging.

## Current implementation boundary

The repository has a pinned preview directory, a synthetic dynamic-domain
candidate, local per-edition snapshots and the bounded development connector
described in [DOMAIN-OFFICE.md](DOMAIN-OFFICE.md). Its floor/set files are visual
editor data, not authoritative Zuri business state. There is no established shared
deployed Event Bus or generic Zuri Agent-command integration. The Studio's human/AI
JSON handoff is a manual design proposal workflow, not an Agent dispatch path.

Until Zuri publishes the remaining contracts, continue eligible scene, editor and
synthetic contract work. Do not add tenant/business IDs to art, hard-code canonical
rosters, invent CRUD endpoints, use mock commands as connectivity proof, or imply
that a local floor Save updated Zuri.

## Required contract before platform integration

The integration owner should publish a versioned contract for:

1. Authentication, caller identity, Business selection and tenant isolation.
2. Business/domain read models with stable IDs, display labels and authorized floor mapping.
3. Domain AgentDefinitions, role and permission fields, and live/derived status provenance.
4. Allowed read/write/agent-command endpoints, validation errors and idempotency semantics.
5. Object versions/ETags, conflict responses, audit behavior and retry rules.
6. Event names, payload schemas, delivery/replay guarantees, outbox ownership and ordering scope.
7. The asset/scene snapshot reference that Visual Office may store without copying canonical agent state.
8. Contract tests using a real authorized Business and evidence for read, conflict, successful command and event update.

Only after these are available should the Office connector replace local preview fixtures. The connected acceptance must show the selected Business, the exact returned domain floors, the exact returned agents and roles, a successful read, a permitted command result and a concurrency conflict handled without lost updates.
