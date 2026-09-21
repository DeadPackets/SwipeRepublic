# Swipe Republic: the midnight cabinet

## Direction

The player reads one demand and makes one decision. Keep the grim cabinet palette and severe portraits, but remove anything that competes with the card. The user's simplification request supersedes the earlier desk composition, sidebars, stamps and repeated summaries.

## Composition

Welcome has one freeform setting field and Begin. Saved games are collapsed. Jev may suggest up to three already generated societies above 85 similarity; creating an original world is always offered. Results replace the form rather than extending the page.

Introduction reveals the generated setting, its scarce resources, then its four factions. It can begin while artwork finishes; taking office waits for all artwork and the first crisis. During play, show four faction meters, a brief request above the character's portrait, and two choices. Tapping a choice commits it. Swiping also commits; hover, focus and arrow keys preview reactions. Keep promises, laws and history in Menu. A faction icon opens its own details. Endings offer two successors. No aims, retirement checklist, turn countdown or fixed reign count.

New dilemmas target 18–28 words in at most two short sentences; choice labels target 2–4 words. Existing saved cards remain intact. Repeated card titles are hidden visually and retained as accessible headings. A first-decision hint teaches the basic rule. Only major crises, due promises, fatal previews and errors add situational text.

## Appearance

Blackened olive background #10120f, surface #1d211b, warm ink #e8e4d9, muted ink #b5b7a8, brass #d1b989 and restrained danger red #efac9c. Newsreader carries dialogue and titles; Manrope carries controls. Both fonts are bundled locally. A single play column reaches 390 px; dialogue is 23–25 px, or 20–22 px for longer stored cards. Decision controls remain 16 px; secondary metadata uses 12–14 px.

## Motion

Cards arrive, follow the pointer and leave laterally in 360 ms, from their current drag position. Meters interpolate; applied numerical changes briefly float beside them. Pages, dialogs and endings have short entrances. Buttons press to 0.96 scale. An original world painting reveals once, then settles; it dims during play. Incoming prepared cards overlap the outgoing card. Network work starts immediately. System reduced motion or the menu setting disables CSS motion and numerical interpolation.

## Assets

Luna describes the actual scene and each character's anatomy, clothing and identifying details. `meta/muse-image` generates a background, six individual portraits, and three resource icons. R2 stores the images under immutable template IDs; the Worker serves them with edge and browser caching. D1 stores complete reusable worlds and opening cards. New worlds do not select from a species list or backdrop library. The bundled portrait atlas remains a fallback for older saves only.

## Accessibility and performance

Controls are at least 44 px tall. Native dialogs trap focus, Escape closes them and closing restores focus. Faction buttons have full names and support values in accessible labels. Reaction direction uses symbols as well as color. Long cards scroll without clipping. Frame-by-frame pointer positions stay in refs. CSS transform and opacity handle card motion. Client code imports server types only; SDKs and validation schemas stay out of the client bundle. Only the next portrait is preloaded.
