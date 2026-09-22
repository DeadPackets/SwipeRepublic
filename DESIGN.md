# Swipe Republic: the midnight cabinet

## Direction

The player reads one demand and makes one decision. Keep the grim cabinet palette and distinct silhouettes, but remove anything that competes with the card. The user's simplification request supersedes the earlier desk composition, sidebars, stamps and repeated summaries.

## Composition

Welcome has one freeform setting field and Begin. Saved games are collapsed. Jev may suggest up to three already generated societies above 85 similarity; creating an original world is always offered. Results replace the form rather than extending the page.

Introduction reveals the generated setting, then its four factions and the one rule: a faction at 0 or at 100 ends the reign. It can begin while artwork finishes; taking office waits for the background and the first visitor. During play, show the dynasty year and reign number, four faction meters, the card, and two choices. Tapping a choice commits it. Swiping also commits. Hover, focus and drag show which factions react as a small or large dot, never the direction; an uncertain reaction flickers. Hold a left or right arrow for 700 ms to answer; releasing early cancels. Every input uses the same throw. Keep promises, laws, people and history in Menu. A faction icon opens its own details.

A death is a beat, not a screen: the fatal meter flares, the scene and the other meters drain of color, then a death card names the death, counts deaths collected out of eight and flags a new one. The succession card follows: pick which of two factions backs your successor; the backer starts at 65 and the rival at 40. Promises, laws, history and the deck carry over. Only Menu → Abandon dynasty ends the game; the Chronicle screen then shows the year reached, rulers, best reign and the eight-slot death grid.

New dilemmas target 8–28 spoken words in at most two short sentences; choice labels target 1–5 words. Dialogue itself is the card heading. Twenty-four recurring characters have distinct voices, alliances and disputes. A first-decision hint teaches the basic rule. Only major crises, due promises, deaths and errors add situational text.

## Appearance

Blackened olive background #10120f, surface #1d211b, warm ink #e8e4d9, muted ink #b5b7a8, brass #d1b989 and restrained danger red #efac9c. Newsreader carries dialogue and titles; Manrope carries controls. Both fonts are bundled locally. The play column reaches 440 px. Faction-tinted pale cards hold 32 px dialogue (26–28 px on phones), a compact silhouette and speaker identity without a divider. Choice labels are 20 px on desktop and 18 px on phones. Faction icons are 40 px and fill from the bottom with support. A reserved 24 px row above each icon holds the 8 or 15 px preview dot and, after a choice, a ▲ or ▼ that floats up in the gain or loss color. Society forms use 18 px type. Cards grow to fit longer saved text.

## Motion

Direction C, "cinematic", chosen from three mocks. All constants live in `src/motion.ts`. Cards follow the pointer with up to 9° of rotation and 16° of 3D turn; the portrait parallaxes. Past 26% of the card width the drag rubber-bands. Release early and a spring (240/16) snaps back with the throw velocity. A commit throws the card in 620 ms with a 60 px drop and a fade. The next card is dealt face down from the deck, springs into place, turns over, then its words fade in 18 ms apart. Meters spring to new values 90 ms apart; hits of 10 or more shake the icon; meters under 15 or over 85 glow. Death drains color for 1.6 s. Screens crossfade with a 12 px rise and blur; dialogs spring in and their panels slide and resize. Buttons press to 0.96 and bounce back. Reduced motion, from the OS or Menu, turns every effect into a 120 ms fade. Android vibrates on threshold, commit, big hits and death; optional synthesized sound (off by default) marks the same moments.

## Assets

Luna generates 24 characters, relationships, four faction palettes, eight deaths, faction symbols and compact illustrated silhouettes with curved paths specific to the player’s world. Cabinet portraits (direction B) are approved. Faction symbols are fitted to their actual drawing bounds before paint, centered in a square viewBox with 5% margin per side; portraits retain their authored composition. Validated filled paths use bounded absolute M/L/H/V/C/Q/Z commands and render locally as SVG; portraits and icons need no image calls. `meta/muse-image` paints one background per template. R2 stores it under an immutable template ID. D1 stores reusable worlds and opening cards. No species presets or preview fixtures enter production. A 30-second preparation estimate changes to “Still preparing…” if generation needs longer.

## Accessibility and performance

Controls are at least 44 px tall. Native dialogs trap focus, Escape closes them and closing restores focus. Faction buttons have full names and support values in accessible labels. Reaction direction uses symbols as well as color. Long cards scroll without clipping. Frame-by-frame pointer positions stay in refs. CSS transform and opacity handle card motion. Client code imports server types only; SDKs and validation schemas stay out of the client bundle. Only the next portrait is preloaded.
