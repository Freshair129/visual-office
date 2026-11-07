# Zuri local surface refinement

Authority: owner-requested face, hair and garment refinement on 25 October 2026,
using the visible Tripo preview as reference. **Character Lab only; owner art
acceptance and floor adoption remain pending.**

[Execution plan](../../../../superpowers/plans/historical/2026-10-25-zuri-surface-refinement.md)
continues the [local reconstruction](../local-rebuild/README.md), preserving the
approved source sheet, original face albedo and separate character identities.

## What changed

- Real facial relief: cheeks, eye sockets, nose bridge/tip, lips and chin. Smaller
  eye apertures use a smooth UV projection of the same original face source.
- Skin uses a soft dielectric specular response. Hair has directional highlights,
  a swept fringe, layered bob, darker inner volume and turned-under ends.
- Sleeves and trouser hems have localized compression folds; the cardigan and
  trousers have distinct fabric sheen. Existing rig, hands and clip timing remain.
- Closed face/hair seams have coincident positions and shared seam normals. This
  removes artificial center lines in close-up lighting, including the 3.6 mm cap
  gap identified by independent review.

## Compare in Character Lab

Open `/character-lab.html`, choose **Zuri**, then:

1. **โมเดลที่ดู** switches **รุ่นปรับรายละเอียด / ก่อนปรับ**. Camera, lighting,
   selected action and animation phase are retained for the comparison.
2. **เทียบภาพอ้างอิง** opens the approved sheet or **Tripo · ทั้งตัว / ใบหน้า**.
3. **ทิศทางแสง** moves the inspection light and environment orientation; inspect
   the surface response at front, side and Office angles.
4. Walking and seated clips, reference furniture, wireframe and model download
   remain available. Switching characters removes the Zuri-only revision control.

The baseline GLB in `web/assets/models/characters/reviews/` is preserved unchanged:
`8955b1cafa2b482a3bf6c09e7800b56317e8b27918826378328599de43543810`.
It is a local reconstruction from the preceding pass, not a Tripo export.

## Reference provenance

`tripo-front-preview.jpg` and `tripo-face-preview.jpg` contain ordinary visible
browser screenshots of the already-authorized Public pilot
`e636ec75-6c1d-4081-b718-b0979f52054e`. These source bytes are copied unchanged to
the local asset references; `sheet-reference.js` selects bounded SVG view boxes.
The browser emits JPEG, so these use the actual JPEG format/extension. No image
regeneration, provider cache extraction, provider texture download or paid job
was performed in this refinement. The previous original ImageGen face prompt
and source remain in `../local-rebuild/`.

Screenshots use the provider's own viewing angle and lighting. They are a visual
reference, not a controlled identical-camera render. Only the two **local GLB
versions** share camera/light/pose in the Lab.

## Acceptance and limits

Final commands, hashes and runtime checks are recorded in `provenance.json`.
Independent focused review passed 16 tests and identified the hair seam, which
was corrected with a failing-then-passing positional/normal regression. The
reviewer's load-generation audit is static evidence; browser checks are recorded
separately. Build/test success does not constitute visual approval.

This is still an original stylized local model. The fine strand density, facial
identity and garment drape do not reproduce the much denser provider model
exactly. Eyes remain painted with geometric blinking; there is no independent
gaze or lip-sync. Staff A/B and Wangjai bytes remain unchanged. No roster, floor
save, logo, business data or live Zuri connection is changed.

## Character continuation references

- [provenance.json](provenance.json)
- [tripo-face-preview.jpg](tripo-face-preview.jpg)
- [tripo-front-preview.jpg](tripo-front-preview.jpg)
