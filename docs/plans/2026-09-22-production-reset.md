# Confirmed production reset

User confirmed deletion of all pre-existing production games, cached societies and artwork on 2026-09-22. Preserve Budget storage, credentials, hosting and game code.

1. Replace the Society namespace with a fresh SocietyV2 namespace using a delete/create migration. Block game API traffic during cleanup so neither old alarms nor new requests recreate removed content.
2. Delete all campaign/search rows and all objects in the dedicated artwork bucket. Change the edge artwork cache namespace.
3. Clear production browser save pointers once; keep settings and newly created saves. Test repeat loads and localhost exclusions.
4. Restore API traffic, verify empty storage, public health and clean welcome UI. Commit and push the applied migration.

## Applied and verified

- Removed the original Society namespace containing 13 stored objects. Its namespace ID is absent from the Cloudflare API. SocietyV2 has zero stored games.
- Deleted 4 campaign rows, 4 search entries and 31 R2 objects. All counts now zero.
- Preserved Budget namespace `6fa7b2bb792349dda9a57164ad8a56fe`; no budget data or secrets were changed.
- Public health returns 200, matching returns no campaigns, and a previous authenticated save and previous artwork URL both return 404. The browser opens at “Where will you rule?” with no saved societies.
- 21 tests / 94 assertions pass, including one-time browser cleanup, preference preservation and localhost exclusion. Build passes.
- Final production version: `656a905e-272f-44e1-bc4d-a6051d24788c`.

## Deviation

Cloudflare rejected the combined binding replacement and class deletion before changing production. A create-only attempt also required the old class export to remain. The applied sequence was: create SocietyV2 and change the binding while temporarily exporting the old alias; remove the alias and delete Society; clear D1/R2; restore game API traffic. The temporary alias and maintenance response are absent from the final code. Keep both migration tags in future deployments.

Reference: https://developers.cloudflare.com/durable-objects/reference/durable-object-class-migrations-legacy/

## Second purge: permanent runs

The user confirmed a second permanent purge of all production runs, chronicles, cached societies, search entries and generated artwork. Hosting, credentials and spend accounting stay intact.

- Inventory: 1 stored SocietyV2 game, 1 campaign, 1 search entry and 1 R2 image.
- Paused game API requests and background generation; created SocietyV3; deleted the SocietyV2 namespace through a separate migration; deleted campaign/search rows and every R2 object; changed the artwork cache namespace to world-art-v3.
- Added a new one-time browser cleanup marker, including stale creation and pending-action payloads. Local development and user preferences are preserved.
- Verification: SocietyV2 is absent, SocietyV3 has 0 stored games, both D1 tables have 0 entries, and R2 has 0 objects. The Budget namespace is unchanged. Old artwork returns 404, campaign matching is empty, and the public welcome page has no saved games.
- Restored traffic with production version `518b08e0-632c-47cc-994d-d161dab493c1`.

Succession is removed from the UI and API. Defeat is permanent. Menu → Abandon run requires confirmation, stops queued generation, returns home and preserves the chronicle. The backend rejects further choices, ignores late generation results and handles duplicate abandonment requests without creating duplicate endings. The removed succession route returns 404.

Validation: 25 tests / 134 assertions and the production build pass. Desktop and 375 px browser checks cover cancellation, confirmed abandonment, returning home, reopening the finished run, reading its preserved chronicle and defeat without successors. A simulated lost response after a successful save recovers on retry with exactly one abandonment and the original history intact.
