# Tripo character production pilot

Status: owner selected image-to-3D from the approved sheets on 25 October 2026.
This is production workflow guidance, not new brand authority. The current
procedural human GLBs remain review candidates and are not the art target.

## Inputs and first job

- This pilot covers one Zuri. Staff A and Staff B require a later production
  decision after inspecting the first model; they are not authorized provider jobs.
- [Zuri single-character input](zuri-front-input-v1.png) is derived with built-in
  ImageGen from the unchanged approved Zuri sheet. It preserves the right-side
  orange clip, bob/fringe, clear round glasses, cream windowpane cardigan,
  charcoal clothing and cream/orange shoes. It is a new modeling input, not a
  replacement for the approved sheet.
- Full-body front, neutral A-pose, white background; no tablet or furniture.
  Never upload the entire multi-panel sheet as one single-view character.
- [Staff A](staff-a-front-input-v1.png) and [Staff B](staff-b-front-input-v1.png)
  are also prepared from their approved sheet. Each has a saved sibling prompt.
  The initial Tripo pilot and proposed 55-credit ceiling cover Zuri only.
- Target: Tripo Studio H3.1, geometry + texture. The owner explicitly authorized
  **Public, one Zuri, no more than 55 credits** on 25 October 2026 after the
  original Private setting proved to require an account upgrade. This approval
  applies to this pilot only, not other characters, retries or paid add-ons.
- Login is verified after the owner's `ready` reply. The logged-in UI still
  shows Generate 55; selecting Private opens an upgrade offer. The Workspace
  banner says upgrade to unlock 3D model exports. The actual GLB export attempt
  after this generation confirmed the account gate described below.
- The approved PNG was uploaded and one job submitted. The final button showed
  55 credits; the displayed account balance changed from 200 to 145. Job/model
  identifier: `e636ec75-6c1d-4081-b718-b0979f52054e`.
  [Open the pilot in Tripo](https://studio.tripo3d.ai/workspace/generate/e636ec75-6c1d-4081-b718-b0979f52054e).
  Generation completed; see [request/result record](zuri-pilot-request.json)
  for the charge and export evidence. No additional job has been submitted.

## Result and remaining gates

The Tripo viewer displayed the completed textured character. Front, side, rear
three-quarter and front three-quarter views were inspected. The brown bob/fringe,
orange clip, round glasses, cream windowpane cardigan, charcoal trousers and
cream/orange shoes are recognizable in the preview. Hair volume, facial features
and clothing folds are much closer to the modeling input than the procedural
candidate. This is an initial visual observation, not the owner's art approval.
Fine finger topology, separate glasses geometry and deformation remain unverified.

The provider UI reports **1,888,667 triangle faces and 990,426 vertices**. These
are provider-reported counts, not local GLB inspection. The result exceeds the
Lab's 120k-triangle target; reduction/retopology and animation preparation remain
necessary before runtime use.

The actual **Export → GLB → 4k Current → Export** flow opened an account upgrade
dialog saying “Upgrade to export ready-to-use 3D assets in multiple formats.”
No subscription was purchased and no file downloaded. Export permission is now
the concrete blocker to local inspection and Character Lab integration. No rig,
animation, retry, second character or extra-credit operation was invoked.

Local evidence is in `reports/character-face-polish/` (ignored):
`tripo-zuri-front.png`, `tripo-zuri-angle.png`, `tripo-zuri-back.png`,
`tripo-zuri-three-quarter.png`, `tripo-zuri-detail.png`, `tripo-zuri-result.png`
and `tripo-zuri-export-blocked.png`. Screenshots are provider previews, not
downloaded model assets. The approved source sheets, existing floor characters,
Agent identities and live connection settings remain unchanged.

The owner subsequently requested [original local reconstruction](../local-rebuild/README.md)
using the visible preview as reference. That route is now implemented separately;
it does not extract this provider model or bypass this export gate. If the owner
later obtains export entitlement, export this existing job without generating
another, inspect its original bytes/licensing, then prepare a reduced/rigged copy.
Staff A/B and floor adoption remain separate decisions.

## Production sequence

1. Inspect the input against the approved sheet and retain its prompt/hash.
2. Verify the explicitly approved privacy setting and cost on the user's account.
   Public is authorized for this one pilot. Never silently broaden that approval
   or purchase/upgrade a subscription.
3. Submit one pilot, record the task/model identifier and actual credit charge.
4. Inspect actual geometry from front, side, back and three-quarter; check face,
   hair, glasses, fingers and clothing. A provider success message is not art
   acceptance. Keep the original download separate from normalized copies.
5. Reduce/retopologize only after checking the output. Aim within the Lab's
   120k-triangle and 5 MiB per-character budgets; preserve face/hair detail.
6. Rig and weight the model; validate idle, walk, seated, greeting and pointing.
   Retopology/rigging/animation may cost additional credits and are outside the
   initial generation ceiling unless explicitly included later.
7. Import/export GLB, with local embedded textures, stable identity and metre
   scale. Validate actual deformed soles, palms, sleeves and furniture contact.
8. Review in Character Lab, then separately approve floor adoption. Preserve
   Agent IDs/count/roles, floor saves, logo and business data. No live connection.

## Sources and boundaries

- [Tripo gallery supplied by owner](https://studio.tripo3d.ai/3d-model-gallery/female?sorted=recommended)
- [Tripo quick start](https://www.tripo3d.ai/product-doc/getting-started/quick-start)
  describes single-image input and GLB export for web/Three.js.
- [Terms](https://www.tripo3d.ai/terms) and account-specific rights must be checked
  before external asset adoption; a gallery thumbnail does not establish reuse
  rights or animation readiness.
- The inspected short-hair/glasses gallery example displayed 950,225 faces and
  488,806 vertices. It was inspected as an example only, not selected or imported.

Use Tripo itself for the requested provider. The unrelated to3D connector is not
a substitute for the user's Tripo account or its generation receipts.

## Character continuation references

- [input-provenance.json](input-provenance.json)
- [staff-a-front-input-v1.prompt.md](staff-a-front-input-v1.prompt.md)
- [staff-b-front-input-v1.prompt.md](staff-b-front-input-v1.prompt.md)
- [zuri-front-input-v1.prompt.md](zuri-front-input-v1.prompt.md)
