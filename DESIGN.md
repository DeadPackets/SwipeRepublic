# Swipe Republic: the midnight cabinet

## Direction

The player reads one demand and makes one decision. Keep the grim cabinet palette and distinct silhouettes, but remove anything that competes with the card. The user's simplification request supersedes the earlier desk composition, sidebars, stamps and repeated summaries.

## Composition

Welcome has one freeform setting field and Begin. Saved games are collapsed. Jev may suggest up to three already generated societies above 85 similarity; creating an original world is always offered. Results replace the form rather than extending the page.

Introduction reveals the generated setting, its scarce resources, then its four factions. It can begin while artwork finishes; taking office waits for all artwork and the first crisis. During play, show four faction meters, a brief request above the character's portrait, and two choices. Tapping a choice commits it. Swiping also commits. Hover and focus preview reactions; hold a left or right arrow for 700 ms to answer. Releasing early cancels. Each input uses the same full lateral swipe. Keep promises, laws and history in Menu. A faction icon opens its own details. Endings offer two successors. No aims, retirement checklist, turn countdown or fixed reign count.

New dilemmas target 8–28 spoken words in at most two short sentences; choice labels target 1–5 words. Existing saved cards remain intact. Dialogue itself is the card heading. Twenty-four recurring characters have distinct voices, alliances and disputes. A setting-specific reserve drains unless choices maintain or replenish it. A first-decision hint teaches the basic rule. Only major crises, due promises, fatal previews and errors add situational text.

## Appearance

Blackened olive background #10120f, surface #1d211b, warm ink #e8e4d9, muted ink #b5b7a8, brass #d1b989 and restrained danger red #efac9c. Newsreader carries dialogue and titles; Manrope carries controls. Both fonts are bundled locally. The play column reaches 440 px. Faction-tinted pale cards hold 32 px dialogue (26–28 px on phones), a compact silhouette and speaker identity without a divider. Choice labels are 22 px on desktop and 20 px on phones. Faction icons are 36–40 px; reserve warnings are 17–20 px. A reserved 30 px row keeps 22 px reaction arrows above icons, with red for losses and a fade when previews change. Society forms use 18 px type. Cards grow to fit longer saved text.

## Motion

Cards follow the pointer and leave fully offscreen in 620 ms from their current position. Buttons and held arrows trigger that same animation. Prepared cards reveal underneath; network work starts immediately and cannot cut the exit short. Pages and dialogs fade without scaling or bounce. Reduced motion uses a 120 ms dissolve. A hold progress line shows keyboard commitment, and the key must be released before another answer.

## Assets

Luna generates 24 characters, relationships, four faction palettes, faction symbols and compact illustrated silhouettes with curved paths specific to the player’s world. Cabinet portraits (direction B) are approved. Faction symbols are fitted to their actual drawing bounds before paint, centered in a square viewBox with 5% margin per side; portraits retain their authored composition. Validated filled paths use bounded absolute M/L/H/V/C/Q/Z commands and render locally as SVG; old polygon saves still render; portraits and icons need no image calls. `meta/muse-image` paints one background per template. R2 stores it under an immutable template ID. D1 stores reusable worlds and opening cards. Older saves retain character indices, cards and history while their cast is enriched when their remaining allowance permits it. No species presets or preview fixtures enter production. A 30-second preparation estimate changes to “Still preparing…” if generation needs longer.

## Accessibility and performance

Controls are at least 44 px tall. Native dialogs trap focus, Escape closes them and closing restores focus. Faction buttons have full names and support values in accessible labels. Reaction direction uses symbols as well as color. Long cards scroll without clipping. Frame-by-frame pointer positions stay in refs. CSS transform and opacity handle card motion. Client code imports server types only; SDKs and validation schemas stay out of the client bundle. Only the next portrait is preloaded.
