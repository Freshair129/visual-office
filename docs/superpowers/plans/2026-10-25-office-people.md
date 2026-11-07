# Office people implementation and evidence

Design: [bounded actor/layout specification](../specs/2026-10-25-office-people-design.md).

1. Add failing regression coverage for status provenance, quiet idle, cushion
   seats and fixed-length floor-contact poses.
2. Implement shared status/routine presentation helpers and transient renderer
   state input. Parent integrator wires the scene and roster boundaries.
3. Calibrate character proportions, stride, heading and seat transitions.
4. Derive sofa/chair anchors with scale and rotation, reserve cushion IDs, and
   refine only the explicit measured default/template transforms.
5. Run focused character/activity/navigation/sheet tests, then shared integration
   checks. Record actual results below; do not infer hosted/live acceptance.

Implemented in `office-activity.js`, `office-characters.js`,
`office-navigation.js`, `hybrid-office-3d.js` and `office-scene-sheet.js`.
`HybridOffice3D.setAgentStates([{avatarId,state,source}])` owns transient sourced
state; `officeActivityCaption(action,state)` keeps it separate from local pose.
The parent integration owns HybridScene/BuildingView input forwarding and UI.

The explicit template entry is `rebuildOfficeFromSheet(room)`, with display
metadata `OFFICE_SHEET_TEMPLATE`. Existing rooms remain readable without applying
it. The new default retains the 12 by 8 metre plan, partition/doors, inventory and
IDs. Desk columns are at 5.3 and 8.05 metres; rows at 1.1 and 4.5 metres. Chairs
sit .9 metre in front. The board at (10.75, .9) faces forward into a clear
discussion area and toward the camera. Chair cushion height is .55 metre and
sofa cushion height .544 metre.

Validation on the working patch (25 October 2026):

```
node --test tests/office-people.test.mjs tests/office-characters.test.mjs tests/office-navigation.test.mjs tests/office-scene-sheet.test.mjs tests/hybrid-office-3d.test.mjs tests/office-activity.test.mjs tests/office-object-skins.test.mjs
```

73 passed, 0 failed, 0 skipped. Covers actual Three.js rig bounds and floor
contact, distance-driven planted/swing feet, gradual sitting, unknown/idle
captions, 60-second idle dwell followed by water and return, all quarter-turn
cushion anchors, independent sofa reservations, closed-door and furniture
collision, whole-cell placement navigation, file roundtrip and unchanged IDs.
Existing skin/art hash and registration tests pass without regenerating any
furniture artwork, geometry or camera reference.

These are local synthetic tests. The integrator owns composed full-suite/build,
independent patch review and browser appearance/playtest; no hosted CI, live
Agent contract, deployment or release acceptance is claimed here.

Follow-up: sourced `waiting` (รอข้อมูล) and `done` (เสร็จแล้ว) are accepted
captions. Both stay quietly seated without typing or automatic idle breaks.
`node --test tests/office-people.test.mjs tests/office-activity.test.mjs` passed
12/12 with zero skipped after this extension; `git diff --check` remains clean.

Composed-suite compatibility repair: unspecified zero-degree rotation stays sparse
in rebuilt templates; known 0.72-scale quarter-turn chair fixtures now set that
scale explicitly instead of inheriting the smaller recommended default. Legacy
prototype callers without an Agent-state map remain unknown and quietly seated;
their distance accumulator initializes on first movement. Focused rotation,
painted-skeleton, people and sheet suite passed 45/45 with zero skipped.

Browser screenshot follow-up (`gap-source-sofa-first.png`): the former template
position had no physical sofa/door intersection, but the fixed camera projected
the door frame across seated people. The recommended sofa moves to (1.05, 3.45)
metres and cooler to (1.2, 5.1); persisted rooms remain unchanged. Measured seated
cushion top is .54375 m, pelvis bottom .53375 m (10 mm compression), knees .50 m,
and sole minimum zero within numerical precision. A new projection regression
keeps both seated silhouettes clear of the doorway and checks actual pelvis/sole
geometry. People, sheet, quarter-turn and navigation tests passed 50/50, zero
skipped after this template-only correction. Browser visual recheck belongs to
the integrator.

Final recommended-board refinement: moved the board to rear-right (10.75, .9),
yaw zero, so its writing surface faces the huddle area and camera. A dedicated
test checks its clear approach at (10.75, 2.2), a collision-safe path from the
aisle at (9.8, 3.2), and a valid quarter-turn placement. People, sheet,
quarter-turn and navigation tests passed 51/51 with zero skipped. No furniture
art or geometry changed. Actor/layout files are frozen for integrator validation.

Independent-review correction: sourced waiting/done now interrupts an automatic
water/rest break and replans toward the actor's desk before quiet sitting.
Unknown/offline clears an automatic route/target at its last collision-checked
position without teleporting, walking or typing; already seated actors remain
seated. Explicit user-requested local actions remain independent of these
automatic-routine transitions. Tests cover mid-walk changes, changes at water
and sofa, unknown input removal and manual-trip preservation. People,
HybridOffice3D, painted-skeleton and sheet tests passed 51/51, zero skipped.
