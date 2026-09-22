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
