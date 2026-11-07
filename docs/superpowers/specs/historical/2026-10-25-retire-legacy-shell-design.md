# Retire the legacy workspace shell

Authority: owner request, 25 October 2026. This implements the established
sidebar-free Office direction; it does not authorize a new logo, scene or palette.

## Approach and scope

Remove the old Marketing/CRM dashboard markup, rail, rail handlers, office quick
chat mounting slot, activity/roster side panels and duplicate jobs list. Hiding
these at boot is insufficient. Rebuild the supporting page shell around the
current Office HUD: warm cream surfaces, blue raised dock buttons, amber actions,
authentic logo and Thai/Manrope type. Alternative hiding and wholesale API rewrite
are rejected: the former retains dead UI; the latter risks working behavior.

Chat lives permanently in its own page with a horizontal agent chooser, thread
selection, history, attachments and one composer. Work retains filtering, detail,
review and links to results; Results, Knowledge, Team and Inbox retain their
functional controllers with newly composed token-based page surfaces. All pages
have return-to-Office, contextual titles and one bottom dock, with More opening
Knowledge/Team/Inbox/settings/help. No permanent sidebar on desktop or mobile.

Existing scene renderers still used by Native Studio or saved native floor files
are active dependencies, not dead code. Build the scene host inside BuildingView
instead of borrowing a panel from dashboard HTML. Only initialize the native
fallback when a floor actually needs it. Keep imported scenes, all Agent IDs and
roles, artwork bytes, floor state and existing API contracts unchanged.

## Verification

Assert absence of legacy markup, handlers and CSS delivery. Test all static floor
routes plus Lobby, building and Studio from fresh app initialization, including
history/navigation and draft preservation. Run suite/build, exercise every floor
reload in the actual built Worker browser and supporting page dock flows. Record
synthetic/local acceptance separately from live. No live connection or API invented.
