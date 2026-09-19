# Gorilla V1.5.0 — prepared local release

Status: local implementation and simulated verification. **Not deployed to GitHub Pages or Google Apps Script yet.** Production login speed and Drive timing must be measured after backend deployment. The existing live app remains unchanged.

## Included

- Hourly background synchronization and on-demand “Sync now from Drive”. Updating the same Excel file or native Google Sheet in the configured source folder is detected by modification time. Automatic detection waits for the next hourly scan plus processing; manual sync starts immediately and reports an already-running scan.
- Login can authenticate and return authorized prepared data in one response. It never starts a source scan. A private persisted snapshot avoids rebuilding every workbook after memory cache expiry. Snapshot publication uses immutable files and a revision marker.
- Missing and NewAdd excluded from the API, loads, navigation and notifications. Original Drive source files are retained. Missing-based Coverage is replaced by Gorilla presence at the latest observed store visit.
- Navy outlined dashboard cards, SVG icons and illustrated shortcut backgrounds based on the supplied reference, with the existing eight-second shine. Reference numbers are not live data. The alerts shortcut retains its meaning rather than introducing an unimplemented Targets feature.
- Visit Trend has date labels and a zero-based count axis, with a glowing dot following a multi-point line. No line is fabricated for a single date. Reduced-motion preferences disable the dot.
- Month and 14-day cycle comparisons on Dashboard and a separate Presence Dashboard, using global filters and custom From–To dates. Presence uses the latest visit per Client Code per period, not quantities. Unobserved periods are gaps, not zero presence; edge periods may be partial.
- Follow-up has six binary observed SKU columns and Total / 6; exports include these and preserve source fields. Incomplete measurements are flagged: 0 means not observed and does not prove absence when source data is blank.
- Compact Presence over Time table opens at its latest row, with cumulative distinct-client total visible above. The entire page is not forced to the bottom.
- Notification groups in the bell and history, category/read filters, grouped real-time summaries. Device notifications still require permission and an open app; closed-app push is not implemented.
- Settings → TDM profile photos: owner uploads JPEG/PNG/WebP; browser crops/compresses it into a circular avatar; Google stores photos separately from ordinary settings. They appear in Top TDMs.
- Default hero uses its built-in design when no image is configured; unavailable custom images receive a fallback.

## Deployment order

1. Back up current Apps Script code, replace Code.gs with `google-apps-script/Code.gs`, save and update the **existing** Web App deployment to a new version. Keep its URL and Script Properties. Do not rerun security initialization.
2. User has already selected an hourly trigger. Leave exactly one hourly sync trigger. `installSyncTrigger` now creates an hourly trigger if needed later.
3. Run `syncGorillaData` once; verify completion and preparation of the snapshot.
4. Publish all staged frontend files from `outputs/gorilla-pages` to the repository root, including new modules and improvements.css.
5. Verify fresh password sign-in, session restore, an in-place Drive edit followed by manual sync, photo upload, and an RTM-limited account on the live app.

## Local checks

`node --test tests.mjs presence.test.mjs integration.test.mjs improvements.test.mjs`

`node server.mjs`, then `node qa-v150.cjs` with Playwright available or PLAYWRIGHT_PATH configured. Browser checks use fixtures and mocked Google responses, not real passwords. Coverage includes SKU totals, calendar gaps, RTM isolation, persistent snapshots, combined login, notification groups, photo upload, RTL and mobile.

## Operational limits

- Deployment blocked by the browser-control runtime missing browser-accessibility.wasm.br; direct Git access also failed. No production success is claimed.
- Prepared snapshots remain in the private cache folder; automatic retention/cleanup is not included. Source data is untouched.
- Google quotas still apply; fixed login or sync timing is not guaranteed.
