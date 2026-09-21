# Gorilla 1.5.2 — Integrated voice and report assistant

Frontend-only update; no Apps Script changes required. Not deployed automatically.

The Assistant button opens a text/voice panel on the authenticated dashboard. The supplied Final Semantic Lab vocabulary is retained in voice-vocabulary.mjs; executable calculations live in assistant-engine.mjs. The original HTML is unchanged.

Supported: six individual Gorilla SKUs, confirmed presence/absence, unique-outlet counts, TDM/RTM rankings by count or explicit presence percentage, tied ranks, visit counts, quality-finding counts, exact mapped POSM/competitor/cooler/survey fields, main/cold/hot SKU facing fields, intersected date/territory filters, Excel/CSV result and detail exports. Text values are listed without inventing a numeric ranking; prices and visit durations use averages. Duration values are minutes in this report.

Presence uses each outlet's latest observed visit inside the current scoped filters. Attribution is to that visit's TDM and does not prove the TDM created new distribution. Unknown evidence is excluded from percentage denominators and never becomes absence. Best defaults to count unless the user explicitly requests a percentage. Incompatible/ambiguous metrics and unavailable fields request clarification.

Not a general language model: free-form multi-period comparisons, arbitrary exceptions, follow-up references and unmapped columns/aliases require a clearer independent request. New zone/heatmap functionality is not part of this release.

Privacy and permissions: no data is sent to an AI API. Analysis uses only currently filtered server-scoped rows. Page permissions gate queries and exports reauthorize with Apps Script. The session's assistant UI is removed on navigation, refresh and logout. Speech recognition is browser-dependent and may send microphone audio to the browser provider. It starts only after clicking the mic; the user reviews the transcript before submitting. Text entry works without speech support. Real microphone accuracy and permission prompts need a manual supported-browser check.

## Run and verify

Run `node server.mjs`, open http://127.0.0.1:8766 and sign in normally. `npm test` runs the unit/integration tests. `qa-v150.cjs` checks the existing app; `qa-assistant.cjs` checks the assistant against a mocked scoped backend. Browser tests require Playwright and Chrome.

## Upload

Run `node build-release.mjs`. Extract `outputs/Gorilla-V1.5.2-Pages.zip`. Upload all contents of the resulting public folder to the GitHub repository root, including **assets/** and **vendor/**. index.html must be at the repository root, not inside an extra folder. Do not upload the ZIP itself or test fixtures. Wait for Pages deployment, hard refresh, then test a typed report and export. Source archive is for private backup only.

The release builder preserves asset directories and checks local references, including vendor/leaflet.js; it no longer flattens paths. Existing backend URL/settings remain as configured.
