# Approved game integration

## Decisions

- Port the approved decision-first silhouette layout and readable type to React. All three input paths use one measured lateral swipe, with a soft incoming reveal. Hold arrows for 700ms, release to cancel, and latch until release. Reduced motion uses a dissolve.
- Generate 24 distinct characters, relationships, faction palettes and bounded polygon illustrations from the player's world. No species presets. Preserve old character indices and saves; enrich older worlds during preparation. Only backgrounds need Muse calls.
- Use actual persisted game state for consequences and pressure. Keep Jev faction scoring, promises, succession, cache and private sessions. No prototype events, fake scores, cast gallery debugging UI or preview turn limit in production.
- Retain the existing deploy target. Merge the verified change into main, push main, deploy Workers, then test the public site.

## Work and checks

1. Update world types, generation, art foundation and backward-compatible enrichment → verify schema, cast indices, old saves, art completion and private cache cloning.
2. Port card motion, hold controls, silhouettes, faction identity, readable onboarding and countdown → verify one action per input, cancellation, mobile clipping and reduced motion.
3. Check the complete change with build, tests, live local gameplay and the requested bug-hunt review → resolve verified findings.
4. Merge main and deploy → verify public health, assets, gameplay and git remote state.
