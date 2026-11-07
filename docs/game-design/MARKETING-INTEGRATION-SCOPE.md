# Integration dependency scope — Marketing P1

**26 October reconciliation:** the baseline/worktree references below describe
the original P1 integration, not today's checkout. Current main `94973644` has
the later dynamic-context candidate, scene/workspace actions, loader/runtime
cleanup and shared canonical artwork. See [current package status](README.md),
[API audit](../API-ENDPOINT-AUDIT.md) and [domain-mode guide](../DOMAIN-OFFICE.md).
Qualification remains synthetic; actual native hidden/focus lifecycle, deployed
Worker and live Zuri/Agent operations are not implied by those later merges.

This branch starts from39b6992fe78c0e1bea66ae185fec513e1517b245. The owner requested
P1 in the main application and built Worker, not only the component playtest.
The existing checkout had the GLB/Studio foundation as uncommitted dependencies.
It is copied into this isolated integration worktree; original work stays intact.

## Included foundation, not newly claimed P1 behavior

- App/building/Studio imports require the Tycoon state/scene/model/data/view/editor
  modules and their GLB kit. Native/hybrid editors and blueprint/navigation helpers
  are imported by the shared Studio and must accompany the new entry path.
- Furniture/customGLB/prefab/texture/group helpers are current runtime dependencies;
  their tests and asset generators are included to retain regression coverage.
- Existing generated static assets and vendor RoundedBoxGeometry module are required
  for offline/static Worker loading. Old saved scene asset references remain valid.
- Documentation linked from AGENTS.md is included for handoff; historical acceptance
  is not promoted to main-app/Worker acceptance by copying it.

## New integration behavior

- Worker handles existing Zuri-read routes before BUCKET routes, default disabled.
  Only an explicitly injected local synthetic service can answer in qualification.
- Main-app Tycoon labels synthetic data from status; P1 blank overview and safe
  Marketing projections use the actual app entry and same renderer modules.
- Separate local launcher serves source app4184 or built Worker4185, pinned producer
  fixture input, actual Node sanitizer and test-only controls. No real credentials.
- Lockfile and CI install/test/build/pinned57 checks. No deployment permissions.

The patch is intentionally larger than blank-overview UI alone because HEAD lacked
these runtime prerequisites. No producer implementation is copied. The vendored
fixture is synthetic and byte-pinned with source provenance. Reports record input
hashes, exact commit/build, browser results, review and hosted CI separately.
