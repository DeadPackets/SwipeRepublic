# Swipe Republic: the midnight cabinet

## Direction

The player reads one demand and makes one decision. Keep the grim cabinet palette and severe portraits, but remove anything that competes with the card. The user's simplification request supersedes the earlier desk composition, sidebars, stamps and repeated summaries.

## Composition

Welcome has one setting field, three examples and Begin. Saved games are collapsed. Introduction names the world and role, offers two aims, and has one primary action. During play, show four faction meters, one portrait and speaker, one short dilemma, and two choices. Tapping a choice commits it. Swiping also commits; hover, focus and arrow keys preview reactions. Keep faction names, aims, promises, laws and history in Menu. A faction icon opens its own details directly. Endings offer two successors without another confirmation step.

New dilemmas target 18–28 words in at most two short sentences; choice labels target 2–4 words. Existing saved cards remain intact. Repeated card titles are hidden visually and retained as accessible headings. A first-decision hint teaches the basic rule. Only major crises, due promises, fatal previews and errors add situational text.

## Appearance

Blackened olive background #141611, surface #23261e, warm ink #e8e4d9, muted ink #b5b7a8, brass #d1b989 and restrained danger red #efac9c. Newsreader carries dialogue and titles; Manrope carries controls. Both fonts are bundled locally. A single column reaches 420 px; dialogue is 23–25 px, or 20–22 px for longer stored cards. Buttons and metadata remain at least 14 px.

## Motion

Cards arrive, follow the pointer and leave laterally in 240 ms. Meters interpolate; applied numerical changes briefly float beside them. Pages, dialogs and endings have short entrances. Buttons press to 0.96 scale. No scene animation competes with reading. Network work starts immediately. Reduced motion disables CSS motion and numerical interpolation.

## Assets

`public/art/cabinet-portraits.webp` is a bundled 4-by-4 atlas created with the built-in image generation tool. Six human advisers are followed by fox, owl, deer, bear, beaver, robot, alien and three spare human variants. Faces are illustrative, not historical likenesses. World generation selects an appropriate human portrait or a species. There are no runtime image generation calls.

## Accessibility and performance

Controls are at least 44 px tall. Native dialogs trap focus, Escape closes them and closing restores focus. Faction buttons have full names and support values in accessible labels. Reaction direction uses symbols as well as color. Long cards scroll without clipping; meters remain available. Frame-by-frame pointer positions stay in refs. CSS transform and opacity handle card motion. Client game constants do not import the server validation schema.
