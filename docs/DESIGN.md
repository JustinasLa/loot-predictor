# Loot Lookout: Design Spec (v2 "Game UI")

Status: binding for the UI overhaul. Every PR in the overhaul must follow this document. If code and this spec disagree, fix the code or change the spec in the same PR and explain why.

User brief, in their words: "a full UI overhaul to actually look presentable, include actual items from the game", and "a toddler must understand how to use this". The previous attempt was rejected as "AI slop".

---

## 0. North star

The app should look like a screen inside Eatventure: bright sky-blue, chunky white panels, fat buttons that press down, and real item and chest art on saturated rarity tiles. Pictures carry the meaning. Words are labels, not explanations.

A first-time user should manage the whole flow without reading a sentence:
1. Tap **Load my save** (or **Try demo**).
2. See a box picture and the items that come out next.
3. After opening that box in the game, tap **I opened it!**.

Everything else is secondary and lives one tap away: Find, XP, Settings and the Save menu.

---

## 1. Anti-slop rules (hard rules; a reviewer rejects the PR if any is broken)

1. No SaaS landing-page hero: no split hero with marketing copy beside an illustration, no feature grids, and no "how it works 01 / 02 / 03" step cards.
2. No beige, cream-paper or forest-green palette. The page is sky blue. Panels are white. Colour comes from the game art and the rarity tiles.
3. No small uppercase letter-spaced eyebrow labels. The only uppercase text in the app is the **NEXT** ribbon on the first opening card.
4. No cutesy taglines or filler copy. Banned examples include "A little less guessing", "Big chef energy", "Your next great find", "Let's find the good stuff" and "Your loot, a little clearer". Any similar phrase is also banned.
5. No decorations: no tilted or floating card collages, sparkle glyphs (✨, ★ used as decoration), concentric circles, orbit rings, blobs, noise textures or glassmorphism.
6. No paragraphs. A label has 6 words or fewer. An empty state or status message is one line. The help sheet is the only place with more than one line, and even there each row is one sentence next to a picture.
7. Use real art, not icon fonts. Boxes, items, eggs, keys and pet food always use the real sprites in `public/assets/items/*.webp`. For pure controls (back, close, gear, search, plus, minus, check, star), use chunky filled SVG glyphs in white on coloured buttons. No thin-stroke line icon sets and no emoji.
8. No blurred "soft UI" shadows as the main depth cue. Depth comes from a solid bottom lip (`0 6px 0 <darker same hue>`). A faint ambient shadow may sit under the lip.
9. No black comic outlines. Borders use a darker shade of the element's own hue (2–4px). Text strokes are only for display numbers and titles.
10. One primary action per view, and it must be the biggest and most saturated thing on that view.
11. Do not invent game facts. Show only rarity, names and quantities that come from the data.

Before opening a PR, take a screenshot at 390x844 and 1280x800 and check it against every rule above.

---

## 2. Visual tokens

These live in `src/ui/styles/tokens.css` as CSS custom properties, exposed through Tailwind v4 `@theme` where useful.

### 2.1 Colour

```css
/* page */
--bg-top:#5cc0ff;            /* sky gradient start */
--bg-bottom:#2a8cff;         /* sky gradient end */
--page-bg: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%) fixed;

/* HUD (top bar), like the game's dark top bar */
--hud:#14181f;
--hud-ink:#ffffff;
--hud-pill:#fefff0;          /* cream currency-style pill */
--hud-pill-ink:#1a252c;

/* surfaces */
--panel:#ffffff;
--panel-row:#eceff3;         /* rows inside panels */
--panel-sunk:#f3f5f8;        /* past/opened cards */
--divider:#e3e7ec;

/* text */
--ink:#1a1f26;
--ink-muted:#5f6b78;         /* passes 4.5:1 on white */
--ink-on-color:#ffffff;
--display-stroke:#003c97;    /* stroke for big white display text */

/* buttons: face / lip (border and bottom lip use the same lip colour) */
--primary:#4bbeff;  --primary-lip:#2c9cdd;      /* game blue: navigation and secondary actions */
--go:#4bc25d;       --go-lip:#2f9a40;           /* green: "I opened it!", "Find it!", "Plan XP", "Load my save" */
--gold:#ffd746;     --gold-lip:#e0a21c;  --gold-ink:#5a3a00;  /* highlights, NEXT ribbon, "Yours!" */
--danger:#ff554b;   --danger-lip:#dd362c;       /* close X, remove save */
--ghost:#ffffff;    --ghost-lip:#b9bfc6;  --ghost-border:#d5d9de;

/* rarity: face / dark lip / light tint */
--r-common:#a7b0bd;    --r-common-dk:#6b7686;    --r-common-tint:#eef1f5;
--r-rare:#3fcf6a;      --r-rare-dk:#1f9a45;      --r-rare-tint:#dcf8e4;
--r-epic:#a64dff;      --r-epic-dk:#7426c9;      --r-epic-tint:#f0e2ff;
--r-legendary:#ffc21a; --r-legendary-dk:#d98a00; --r-legendary-tint:#fff3c9;
--r-ultimate:#ff4d5e;  --r-ultimate-dk:#c8243a;  --r-ultimate-tint:#ffe0e4;
--r-mythic:#29bffa;    --r-mythic-dk:#0b86c4;    --r-mythic-tint:#d8f3ff;
/* "None" (resource / pet food list entries) uses common */

/* box backings (chest picker tiles and box header disc) */
--box-small:#7cc8f0;  --box-big:#ffd76a;   --box-clan:#c9d2e3;  --box-pet:#e9c58f;
--box-mine:#ff9d6c;   --box-seaport:#5fd6d6; --box-space:#2f4f9e; --box-middleages:#b07a4a;
--box-alchemist:#5fd39b; --box-zeus:#2f7fe0; --box-pirate:#f2c45a;
--box-egg:#ffffff;    /* eggs sit on white; the egg art carries the colour */
--box-unknown:#a7b0bd;
```

**Rarity mapping.** Rare is green, not blue. This matches the game's egg sprites and the community tool. Epic is purple, Legendary gold, Ultimate red, Mythic sky blue and Common grey. CSS reads `[data-rarity="Common|Rare|Epic|Legendary|Ultimate|Mythic|None"]`. For combined rarities such as "Legendary / Ultimate", the renderer writes the **first** rarity into `data-rarity`.

**Contrast.** White text on `--go` and `--primary` must carry a text shadow (`0 2px 0 rgb(0 0 0 / .2)`) and be at least 18px and weight 800. That counts as large text, which needs 3:1. Body text is always `--ink` or `--ink-muted` on white or `--panel-row`.

### 2.2 Typography

- Font: **Baloo 2** variable, bundled locally with `npm i @fontsource-variable/baloo-2`, then `import "@fontsource-variable/baloo-2"` in `src/app.js`. No third-party font requests at runtime.
- `--font-ui: "Baloo 2 Variable", "Baloo 2", ui-rounded, system-ui, sans-serif;`
- Line height is 1.15 for labels and 1.35 for one-line messages.
- Counts and numbers use `font-variant-numeric: tabular-nums`.

| Token | Size / weight | Use |
|---|---|---|
| `--t-display` | 44px / 800 (phone 36px) | Big result numbers ("+340 XP", "Found in 7 opens!") |
| `--t-title` | 30px / 800 (phone 26px) | Box name in the header, Start headline |
| `--t-h2` | 24px / 800 | Panel headings ("Pick a box", "What do you want?") |
| `--t-btn-lg` | 22px / 800 | Primary buttons |
| `--t-btn` | 18px / 800 | Secondary buttons, tabs |
| `--t-body` | 17px / 600 | Messages, rows |
| `--t-label` | 15px / 700 | Item names under tiles, box names under tiles |
| `--t-small` | 13px / 700 | Badges, footers |

Display text (the app title in the HUD and big result numbers on coloured banners):
```css
.display-text{ color:#fff; -webkit-text-stroke:3px var(--display-stroke); paint-order:stroke fill; text-shadow:0 4px 0 var(--display-stroke); }
```

### 2.3 Spacing, radii, depth

```css
--s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px;
--radius-btn:14px; --radius-tile:16px; --radius-card:22px; --radius-sheet:28px; --radius-pill:999px;
--lip:6px;                       /* button bottom lip */
--lip-tile:5px;
--shadow-ambient: 0 10px 20px rgb(0 0 0 / .16);
--shadow-panel: 0 8px 0 rgb(0 0 0 / .10), 0 16px 30px rgb(0 0 0 / .16);
--focus: 0 0 0 4px #fff, 0 0 0 7px #1a1f26;   /* visible on blue and on white */
--tap-min:48px;
--ease-press: transform .06s ease-out, box-shadow .06s ease-out;
```

### 2.4 Motion

- Button press: `translateY(var(--lip))` and the lip collapses. 60ms.
- Toast: slides up 12px and fades in over 150ms. Stays 2.5s. Fades out over 150ms.
- After marking opened, the removed cards collapse (height and opacity, 180ms) and the new card 1 gets the ribbon.
- Box hero on the Start screen: one bounce on load (translateY -8px and back, 500ms). It does not loop.
- Legendary, Ultimate and Mythic item tiles get a slow `conic-gradient` light burst behind the sprite, rotating once every 8s. This is the only looping animation.
- `@media (prefers-reduced-motion: reduce)`: all of the above off. Instant state changes only.

---

## 3. Components

The foundation implements these in `src/ui/styles/components.css`, plus small helpers in `src/ui/components/*.js`. Feature PRs use them. Feature PRs do not restyle them globally; they may add scoped modifiers in their own CSS files.

### 3.1 Buttons (`.btn`)

```css
.btn{ font:800 var(--t-btn)/1 var(--font-ui); color:#fff; min-height:52px; padding:12px 20px;
  border-radius:var(--radius-btn); border:3px solid var(--lip-c); background:var(--face-c);
  box-shadow:0 var(--lip) 0 var(--lip-c), var(--shadow-ambient); text-shadow:0 2px 0 rgb(0 0 0 / .2);
  display:inline-flex; align-items:center; justify-content:center; gap:10px; transition:var(--ease-press); }
.btn:hover{ filter:brightness(1.06); }
.btn:active{ transform:translateY(var(--lip)); box-shadow:0 0 0 var(--lip-c); }
.btn:focus-visible{ outline:none; box-shadow:0 var(--lip) 0 var(--lip-c), var(--focus); }
.btn:disabled{ --face-c:#c9cfd6; --lip-c:#a4acb5; color:#f4f6f8; text-shadow:none; cursor:not-allowed; }
```

| Variant | Face / lip | Used for |
|---|---|---|
| `.btn--go` | `--go` / `--go-lip` | THE primary action of a view: Load my save, I opened it!, Find it!, Plan XP |
| `.btn--primary` | `--primary` / `--primary-lip` | Secondary actions: Try demo (on white), Show 5 more, Look further, Try again |
| `.btn--gold` | `--gold` / `--gold-lip`, ink `--gold-ink`, no text shadow | Rare highlights only. Not for a whole screen. |
| `.btn--ghost` | `#fff` / `--ghost-lip`, ink `--ink`, border `--ghost-border`, no text shadow | Opened up to here, Cancel, Stop, Pick fewer items |
| `.btn--danger` | `--danger` / `--danger-lip` | Remove, the close X |

Sizes:
- `.btn--lg`: min-height 64px, `--t-btn-lg`, padding 16px 28px.
- `.btn--sm`: min-height 44px, 16px font, `--lip:4px`.
- `.btn--block`: full width.

Icon buttons (`.icon-btn`):
- A 48x48 square with radius 12px, built on the same variants.
- Glyph is a white filled SVG at 24px.
- Must have an `aria-label`.

The square red close X (`.icon-btn.btn--danger.sheet-close`) sits at the top-right of sheets, like the game.

An icon inside a button sits before the label at 28px. It is a game sprite where one exists: PetFood, chest or key.

### 3.2 Panel / card (`.panel`)

- White, radius `--radius-card`, padding 16px (20px from 768px), `box-shadow: var(--shadow-panel)`.
- Rows inside a panel use `.panel-row`: `--panel-row` background, radius 12px, padding 10px 12px, no border.

### 3.3 Box tile (`.box-tile`), used by the box picker

- Square-ish button, about 120x132px on phone (3 per row) and 112x124px in the desktop rail (2 per row).
- Top: a rounded backing square (radius 14px) in the box's `--box-*` colour, with the sprite at 76% of it and `filter: drop-shadow(0 4px 0 rgb(0 0 0 / .22))`.
- Below: box name in `--t-label`, max 2 lines, centred.
- The tile itself is white with radius 16px, a 3px border `#e3e7ec` and a lip `0 5px 0 #c3cad2`.
- Selected state (`.is-active` with `aria-current="true"`): border becomes 4px `--primary`, lip becomes `--primary-lip`, and a 28px round check badge (white check on `--go`) sits at the top-right corner, overlapping.
- Corner badges (bottom-left, over the art): `.badge--level` "Lv 25" (dark `#1a1f26` pill, white 13px/800) and `.badge--opened` "3 opened" (blue `--primary` pill).
- Unknown art: backing `--box-unknown` with the first letter of the name, 44px/800 white. Never a broken image.

### 3.4 Item tile (`.item-tile[data-rarity]`), the hero component

```css
.item-tile{ --c:var(--r-common); --dk:var(--r-common-dk);
  position:relative; aspect-ratio:1; border-radius:var(--radius-tile);
  background:radial-gradient(circle at 50% 42%, color-mix(in srgb,var(--c) 50%,#fff) 0%, var(--c) 62%, var(--dk) 100%);
  border:3px solid var(--dk); box-shadow:0 var(--lip-tile) 0 var(--dk), inset 0 2px 0 rgb(255 255 255 / .35);
  display:grid; place-items:center; }
.item-tile img{ width:84%; height:84%; object-fit:contain; filter:drop-shadow(0 4px 0 rgb(0 0 0 / .22)); }
```
- Sizes: phone tiles are at least 96px (3 per row in a card). Desktop is 104–120px, auto-fill, at most 6 per row. History and chip sizes are 48–64px.
- Name sits **under** the tile: `--t-label`, `--ink`, centred, at most 2 lines with an ellipsis.
- Rarity word: in a `.item-rarity` element that is **visually hidden** (`.sr-only`). The tile also gets `title="<Name> · <Rarity>"`. Colour carries rarity for sighted users. Combined rarities use the first one for colour.
- Quantity (pet food only): `.item-quantity` sits bottom-right inside the tile and reads `x150` in white 22px/800 with `-webkit-text-stroke:5px #3a2a1a; paint-order:stroke fill`. Keep `aria-label="Quantity: 150"`.
- Vault key drops: a gold `.badge` "Key" at the top-left.
- Wanted item (Find routes): a 4px `--gold` outer ring (`outline:4px solid var(--gold); outline-offset:2px`) and a gold pill badge "Yours!" overlapping the top edge.
- Legendary, Ultimate and Mythic: a `::before` conic light burst behind the sprite (see Motion), off under reduced motion.
- White sprites (chef hats, pearls, white apron) still read well because tiles are never white.
- Image fallback: a coloured tile with initials, as `render.js` already does with `.item-fallback`.

### 3.5 Opening card (`.open-box`)

A `.panel` that represents one opening.

**Header row (`.open-head`):**
- Left: a round number badge, 44px, `--primary` with white 800 text: "#2". For card 1, a gold ribbon **NEXT** replaces it.
- Then a title and subtitle:
  - Title: `--t-btn`, ink.
  - Subtitle `.open-subtitle`: `--t-small`, muted. For adventure boxes this is "Zeus' Feast · Level 24"; otherwise the box name.
- Seed details stay in a closed `<details><summary>Prediction details</summary>…</details>`. It is shown only when Settings "Show seed details" is on (`body[data-details="on"]`); otherwise it is visually hidden.

**Body:** an item tile grid (`ul.item-grid > li.item-row`).

**Footer:** exactly one `.open-card-btn` button.
- Card 1: `.btn--go .btn--lg .btn--block` reading **I opened it!**
- Cards 2 and later: `.btn--ghost .btn--sm` reading **Opened up to here**

**Card 1 styling:** a 4px `--gold` border, a gold lip, and the ribbon. Cards 2 and later have the default panel style.

**Past cards (`.is-past`, history):**
- `--panel-sunk` background, no lip.
- Tiles at 64px with `filter: saturate(.75)`.
- Title "Opened #12". No button.

**Constraint:** no other `<button>` may be added inside an opening card, Find route step or XP step. Tests count buttons. Use `<details>` for disclosure.

### 3.6 Tabs (`.seg-tabs`)

- A white pill bar (radius 999px, padding 6px, lip `0 5px 0 #c3cad2`) holding up to three tabs: **Next**, **Find**, **XP**.
- Each tab is a pill button at least 48px tall, with a 22px glyph and a word.
- Selected tab: `--primary` face, white text, inner lip.
- Unselected: transparent, `--ink`.
- WAI-ARIA tablist semantics, unchanged. The XP tab exists only for adventure boxes; otherwise it gets `is-hidden`.

### 3.7 Sheets (`.sheet`), for Settings, Save menu and Help

- A `div[role=dialog][aria-modal=true][aria-labelledby]` plus a backdrop `.sheet-backdrop` (`rgb(10 20 40 / .45)`). Shown and hidden with `is-hidden`. Do not use `<dialog>.showModal()`, because jsdom support is unreliable.
- **Phone (under 768px):** a bottom sheet, full width, top radius `--radius-sheet`, max-height 88dvh, scrollable, with padding-bottom `calc(16px + env(safe-area-inset-bottom))`. A grab handle bar (40x5px, `#d5d9de`) sits on top.
- **768px and up:** a right drawer, 420px wide, full height, left radius `--radius-sheet`.
- Header: a centred title in `--t-h2` and the red square close X at top-right (`aria-label="Close"`).
- Behaviour, from `src/ui/components/sheet.js`:
  - `openSheet(id, trigger)` moves focus to the first focusable element and traps Tab inside.
  - Escape, a backdrop click or the X calls `closeSheet(id)`, which returns focus to the trigger.
  - The trigger's `aria-expanded` is kept in sync.

### 3.8 Toast (`.toast`)

- One region `#toast-region` (`role=status`, `aria-live=polite`), fixed at bottom-centre, above the sticky action bar and the safe area.
- The toast is a dark `#1a1f26` pill, white 18px/700, with a 28px green check disc on the left. Max width 92vw.
- API: `showToast(text)` from `src/ui/components/toast.js`. A new toast replaces the current one. Auto-hides after 2500ms.

### 3.9 Stepper (`.stepper`)

- Layout: `[–] [ 25 ] [+]`.
  - Minus and plus are `.icon-btn.btn--primary`, 48px.
  - The middle is the real `<input type=number>`, 72px wide, centred 22px/800, with no spin buttons.
  - A visible `<label>` sits above (numeric inputs must keep a real `<label>`).
- Wired by `initSteppers(root)` from `src/ui/components/stepper.js`. The buttons carry `data-step-for="<inputId>"` and `data-step="-1|1"`.
- On click, the value is clamped to the input's `min`/`max`, set, and then `input` and `change` events are dispatched, so existing handlers run unchanged.
- Buttons get `aria-label="Less <label>"` / `"More <label>"`.

### 3.10 Chips (`.chip`)

- Pill buttons, 44px tall, white with a 3px border `#d5d9de` and a lip `0 4px 0 #c3cad2`.
- Pressed state (`aria-pressed=true`): face is `--primary`, white text.
- Rarity chips show a 14px dot in the rarity colour before the word.
- `bindChipsToSelect(groupEl, selectEl)` from `src/ui/components/chips.js` keeps a chip row in sync with a visually hidden `<select>`.

### 3.11 Empty state (`.empty`)

- Centred inside the panel: a sprite (72px, `opacity:.55`, `filter:grayscale(.3)`), one line in `--t-body`/700 ink, and an optional single button below.
- Never more than one line of text.

### 3.12 Status, spinner and banner

- `.status-line`: one line, `--t-body`, muted, with a 20px spinner (a CSS ring in the button colour, 3px) when busy.
- `.banner`: a coloured full-width rounded block (radius 18px, lip) used for results.
  - Green `--go` for success ("Found in 7 opens!", "+340 XP"), with white display text.
  - Gold `--gold` with `--gold-ink` for "best so far" / incomplete notes.
  - `--panel-row` with ink for neutral messages.
- Errors (`.error-box`): `--r-ultimate-tint` background, 3px `--danger` border, `--ink` text, one line. Live region is `role=alert`.

### 3.13 Sticky action bar (`.action-bar`), phone only

- Fixed at the bottom, white, top radius 22px, `box-shadow: 0 -6px 0 rgb(0 0 0 / .06)`, padding `12px 16px calc(12px + env(safe-area-inset-bottom))`.
- Holds the current view's primary action: Find it! or Plan XP. On the Start screen it holds Load my save and Try demo.
- Content scrolls under it. Add body padding-bottom equal to its height.

---

## 4. Layout

### 4.1 App frame

The HUD top bar `.hud` is 64px (56px on phone), `--hud` background, and sticky. It contains:
- Left:
  - Phone, Box screen only: a back icon button (`aria-label="Back to boxes"`).
  - Otherwise: the 36px BigChestIcon plus "Loot Lookout" in display text at 22px.
- Right:
  - The session pill `#session-label`, a cream `--hud-pill` pill with dark text: "Demo" or "My save".
  - The help button (`?` glyph, `aria-label="Help"`).
  - The Settings gear (`aria-label="Settings"`).
  - The Save menu button `#user-menu-trigger`, showing a file glyph (`aria-label="Save options"`).
  - These are all `.icon-btn.btn--primary`. Settings and Save are shown only once a save is loaded. Before load, only Help shows.

Page background is the sky gradient. Content panels float on it.

### 4.2 Desktop (1024px and up)

```
┌ HUD ─────────────────────────────────────────────────────────────┐
├──────────────┬───────────────────────────────────────────────────┤
│ Box rail     │  Box header (sprite 96 on backing, name, Lv stepper)│
│ 300px, white │  Tabs: [Next] [Find] [XP]                          │
│ panel, scroll│  Panel content, max-width 820px                    │
│ "Pick a box" │                                                    │
│ 2-col tiles  │                                                    │
└──────────────┴───────────────────────────────────────────────────┘
```

- The rail is a sticky white panel at `top: 80px`, height `calc(100dvh - 96px)`, with internal scroll and 16px gutters.
- The main column has 24px padding.

### 4.3 Tablet (768–1023px)

Same as desktop, but the rail is 240px with 2-column 96px tiles.

### 4.4 Phone (under 768px)

The frame uses two "screens" on `#workspace`, through `data-screen="boxes|box"` (CSS only; never `is-hidden`):
- **boxes:** the rail fills the screen as a 3-column grid with the heading "Pick a box". The box header and panels are hidden.
- **box:** the rail is hidden. The box header shows a back arrow in the HUD. Tabs are sticky under the HUD (`top:56px`). Panels are full-width with 12px gutters.

After a save loads, the app goes straight to `data-screen="box"` for the default box (Big Box). The user immediately sees drops and can go back to choose another box. The browser Back button on the Box screen returns to Boxes (`history.pushState` with `#boxes` / `#box`).

### 4.5 Start screen (no save)

A centred single column, max-width 520px, on the sky background:
1. HUD with title.
2. A white panel containing:
   - BigChestIcon at 168px on a gold backing disc (200px, `--box-big`, lip)
   - the headline
   - the Load and Demo buttons
   - the lock line
   - the "What's a save file?" `<details>`
3. The footer below the panel.

On phone, the two buttons also live in the sticky action bar. The in-panel copies are hidden on phone to avoid duplicate ids; see workstream 1 for the exact rule.

> Foundation note: the foundation does not duplicate the buttons. The single `.welcome-actions.action-bar` block sits inside the panel on wide screens and is pinned to the bottom of the viewport on phone by CSS, so there is exactly one `#welcome-load-save` and one `#load-demo`.

---

## 5. Full flow and exact copy

All copy is final. Do not add words. Straight apostrophes are allowed; use the ellipsis character "…".

### 5.1 Start
| Element | Copy |
|---|---|
| HUD title | Loot Lookout |
| Headline | See what's in your next box. |
| Primary button (`#welcome-load-save`, also `#load-save`) | Load my save |
| Secondary button (`#load-demo`) | Try demo |
| Lock line (lock glyph) | Your save stays on this device. |
| Disclosure summary | What's a save file? |
| Disclosure body (2 lines) | It's your Eatventure save (.json). It's read here, never uploaded. / No file? Tap Try demo. |
| Footer | Fan-made. Not affiliated with Eatventure or Lessmore. |
| Loading | Reading savegame.json… (real file name) |
| Error: no boxes | No boxes found in this save. |
| Error: bad file | That's not an Eatventure save. |
| Error: read failure | Couldn't open that file. |
| Error action button | Try another file |

### 5.2 Boxes
| Element | Copy |
|---|---|
| Heading | Pick a box |
| Group headings (sentence case, hidden when empty) | Boxes · Adventures · Events · Eggs |
| Level badge | Lv 25 |
| Opened badge | 3 opened |
| Demo banner (top of rail / Boxes screen) | Demo save · [Load my save] |

### 5.3 Box: Next tab
| Element | Copy |
|---|---|
| Tab labels | Next · Find · XP |
| Level stepper label (adventure only) | Level |
| Card 1 ribbon | NEXT |
| Card 1 title | Next box |
| Card k title | #k (`aria-label` on the title: "Opening k") |
| Card 1 button | I opened it! |
| Card k button | Opened up to here |
| More button (below `#out`) | Show 5 more |
| More at the cap (200) | Disabled, label "That's all" |
| Toast after marking | Got it! 1 opened. / Got it! 5 opened. |
| `#open-status` (sr-only live region) | Nothing opened yet. / 3 opened so far. |
| History summary | Opened (12) |
| History card title | Opened #12 |
| History empty | Nothing opened yet. |
| Seed details summary | Prediction details |

### 5.4 Box: Find tab
| Element | Copy |
|---|---|
| Heading | What do you want? |
| Search placeholder / label | Search items |
| Rarity chips | All · Common · Rare · Epic · Legendary · Ultimate · Mythic |
| Idle hint (`.find-guidance`) | Tap the items you want. |
| Action, 0 picked (disabled) | Pick an item |
| Action, 1+ picked | Find it! (with "3 picked" counter beside it, which is `#find-selected`) |
| Running | Looking… · 12,345 tries |
| Stop button | Stop |
| Stopping | Stopping… |
| Found banner | Found in 7 opens! / Found in 1 open! |
| Route toggle (adventure, two different routes) | Fastest · 7 opens / Fewest keys · 6 keys |
| Wanted badge | Yours! |
| Adventure step title | Open at level 12 |
| All collected | All found! |
| All collected action | Pick more |
| Not found | Not in the next 10 opens. |
| Not-found actions (outside `#find-out`) | Look further · Pick fewer items |
| Stopped with routes | Stopped early. Best so far: |
| Stopped without route | Stopped. + [Try again] |
| Search limit hit | Hit the search limit. Best so far: |
| Settings changed | Box changed. Search again. |
| Box has no items | Nothing to find in this box. |
| No search match | No match. + [Show all] |

### 5.5 Box: XP tab (adventure only)
| Element | Copy |
|---|---|
| Heading | Get the most XP |
| Stepper 1 (`#xp-openings`) | Keys I have |
| Stepper 2 (`#xp-maxlevel`) | My top level |
| Button | Plan XP |
| Estimate | Instant / About 10 seconds / About 3 minutes / About 1.5 hours |
| Heavy estimate (`data-heavy=yes`), appended | · may be slow |
| Running | Planning… · 5 opens deep |
| Stop / stopping | Stop / Stopping… |
| Result banner, more XP | +340 XP (small line under it: vs 1,200 XP at top level) |
| Same | Same as top level |
| Less | 40 XP less than top level |
| Chips | 4 opens · 1 bonus key · Best so far · Stopped early |
| Step title | Open at level 12 (with "+85 XP" pill) |
| Progress | 2 of 4 done / Plan done! |
| No plan | No plan found. Try more keys or a higher level. |
| Stopped, no plan | Stopped. + [Try again] |

### 5.6 Settings sheet (gear)
| Row | Copy |
|---|---|
| Title | Settings |
| Vault (`#vault`), with the key sprite | Vault key chance (%) |
| Seed (`#seed`) | Seed (with a small "Advanced" tag) |
| Preview count (`#count`) | Boxes to show |
| Seed details toggle | Show seed details |
| Mark many: presets | Mark 5 opened · Mark 10 opened |
| Mark many: custom (`#open-custom` + `#open-custom-go`) | How many? · Mark opened |
| Find section (adventure only) | Find: highest level · Find: max opens |
| XP section (adventure only) | XP: max opens (placeholder "No limit") |
| Footer | Only change these if you know why. |

### 5.7 Save menu (file icon)
| Element | Copy |
|---|---|
| Title | My save |
| File line | savegame.json (or "Demo save") |
| Buttons | Load another save · Reset this box · Remove from this device (red) |
| Reset confirm | Back to your save? Opened list clears. [Reset] [Cancel] |
| Remove confirm | Remove your save from this device? [Remove] [Cancel] |

### 5.8 Help sheet (? icon)
Title: **How it works**. There are three rows, each a picture on the left plus one sentence. These are rows, not numbered cards.
- BigChestIcon: "Pick a box."
- A Rare item tile and a Legendary item tile: "See what comes out, in order."
- A mini green "I opened it!" button image (a non-interactive span styled as a button): "Opened it in the game? Tap I opened it!"

Then one row with the lock glyph: "Your save stays on this device."

### 5.9 Errors (generic)
- `.error-box` text: **Oops! That didn't work.**, followed by the specific reason on the same line in muted text.
- Number errors keep the field name, e.g. "Enter a valid number for Level."

---

## 6. Code structure (built by the foundation PR)

The foundation PR (merged before the 8 workstreams start) must:
- keep all tests green at 100% coverage;
- change no prediction, RNG, solver or save behaviour;
- produce the structure below.

**Markup.**
- `index.html` contains only `<head>`, the skip link, `<div id="app-root"></div>` and the script.
- `src/ui/shell.js` exports `shellMarkup()` and `mountShell(root)`. It assembles `src/ui/views/*.html` (imported with `?raw`) by replacing `{{slot:<name>}}` markers and `{{BASE}}` (set to `import.meta.env.BASE_URL`).
- Tests build the document through `tests/helpers/html.js`.
- Every partial below exists after the foundation, filled with the current markup. Workstreams only edit their own partials. No one needs to edit `shell.js`.

**Styles.**
- `src/ui/styles.css` contains only `@import "tailwindcss";` plus one `@import` per file in `src/ui/styles/`.
- All files are pre-created by the foundation, empty where needed: `tokens.css`, `base.css`, `components.css`, `shell.css`, `mobile.css`, `welcome.css`, `box-picker.css`, `opening-card.css`, `item-tile.css`, `history.css`, `marking.css`, `save-menu.css`, `find.css`, `xp.css`, `settings.css`, `help.css`, `error.css`.

**Render.**
- `src/ui/render.js` is a barrel re-exporting `src/ui/render/{dom,items,opening-card,predictions,history,chest-list,item-picker,find-result,xp-path,error}.js`.

**App.**
- `src/app.js` is the entry point. It imports `src/app/{state,dom,session,navigation,predict,marking,save-menu,routes,find,xp-planner,settings,help,chrome}.js` and calls each module's `init*()`. Every module exists after the foundation, possibly with an empty `init` (covered by a test).

**Components.**
- `src/ui/components/{toast,sheet,stepper,chips}.js`, with tests in `tests/components/*.test.js`.

**Navigation changes the foundation makes:**
- One selected box app-wide. `#sidebar-find-list` and the separate find chest state are removed, and tests are updated.
- A third tab `#nav-xp` / `#panel-xp` that hosts `#smart-xp`. It is shown only for adventure boxes; when the box changes to a non-adventure box while XP is active, the app falls back to Next.
- `data-screen` on `#workspace`.

**Tests.**
- `tests/app.test.js` is split into `tests/app/*.test.js` with a shared `tests/helpers/app-harness.js`. Each file keeps its own `vi.mock` blocks.
- `tests/render.test.js` is split into `tests/render/*.test.js`.

### 6.1 File ownership after the foundation

| WS | Owns (only this workstream edits these) |
|---|---|
| 1 Start & loading | views/welcome.html, views/demo-banner.html, styles/welcome.css, app/session.js, tests/app/onboarding.test.js, tests/app/import.test.js, tests/app/session.test.js |
| 2 Box picker & navigation | views/box-rail.html, views/box-header.html, views/tabs.html, styles/box-picker.css, render/chest-list.js, app/navigation.js, tests/app/navigation.test.js, tests/render/chest-list.test.js |
| 3 Next drops | views/next-panel.html, views/settings-next.html, styles/opening-card.css, styles/item-tile.css, render/items.js, render/opening-card.js, render/predictions.js, app/predict.js, src/ui/presentation.js, tests/app/predict.test.js, tests/render/{items,opening-card,predictions}.test.js, tests/presentation.test.js |
| 4 Marking, history, save menu | views/history.html, views/settings-marking.html, views/save-menu.html, styles/history.css, styles/marking.css, styles/save-menu.css, render/history.js, app/marking.js, app/save-menu.js, tests/app/marking.test.js, tests/app/save-menu.test.js, tests/render/history.test.js |
| 5 Find | views/find-panel.html, views/settings-find.html, styles/find.css, render/item-picker.js, render/find-result.js, app/find.js, tests/app/find.test.js, tests/render/{item-picker,find-result}.test.js |
| 6 XP planner | views/xp-panel.html, views/settings-xp.html, styles/xp.css, render/xp-path.js, app/xp-planner.js, tests/app/adventure-xp.test.js, tests/render/xp-path.test.js |
| 7 Settings, help, errors | views/settings-sheet.html, views/help-sheet.html, styles/settings.css, styles/help.css, styles/error.css, render/error.js, app/settings.js, app/help.js, tests/app/settings.test.js, tests/app/help.test.js, tests/render/error.test.js |
| 8 Phone & polish | index.html (head), views/shell.html (HUD + frame), styles/shell.css, styles/mobile.css, app/chrome.js, public/ icons/manifest, tests/accessibility.test.js, tests/app/chrome.test.js |

**Frozen after the foundation** (a change needs a tiny separate PR, announced in its title as `foundation:`):
- tokens.css, base.css, components.css
- src/ui/components/*
- render/dom.js
- app/state.js (additive fields allowed)
- app/dom.js, app/routes.js
- src/ui/shell.js, src/app.js, src/ui/render.js, src/ui/styles.css
- tests/helpers/*
- tests/app/route-safety.test.js, tests/app/numeric.test.js

### 6.2 Test-contract reminders (from the baseline audit)

- **Ids.** Keep every id that app.js wires. The `is-hidden` class is the show/hide mechanism.
- **Labels.** Every numeric input has a real `<label>`, because `numberField` reads `labels[0]`.
- **Structure.**
  - One direct child per chest row in the box lists, per chip in `#find-items`, and per card in `#out`.
  - `#out.children.length === count`.
- **Buttons in result containers.** Do not add buttons inside `#out` cards, `#find-out` or `#xp-out` beyond the one mark button per card/step. Extra actions go in sibling containers.
- **Preset mark buttons.** `.open-btn[data-open]` buttons keep names matching `/mark|track|simulate/i` that contain their number.
- **Route safety.** The "settings changed" guard in routes.js is untouchable.
- **Copy changes.** Copy that tests assert may change only if the test is updated in the same PR to the new exact string from §5.

### 6.3 Foundation notes (how the foundation filled gaps in this spec)

- **Slots inside partials.** `shell.js` resolves `{{slot:name}}` recursively, so a partial can host another partial: `next-panel.html` hosts `{{slot:history}}` and `settings-sheet.html` hosts `{{slot:settings-next}}`, `{{slot:settings-marking}}`, `{{slot:settings-find}}` and `{{slot:settings-xp}}`. The hosting workstream must keep the slot marker in place.
- **Tab panels.** Each tab panel `<section role="tabpanel">` lives in its own workstream's partial (`#panel-predict` in next-panel.html, `#panel-find` in find-panel.html, `#panel-xp` in xp-panel.html). Keep the ids, `role` and `aria-labelledby`.
- **Box groups.** The rail renders one `.box-grid[data-box-group]` per group (boxes, adventures, events, eggs) inside `#box-rail-list`. `navigation.js` hides empty groups.
- **`#user-panel-loggedin`** is the HUD group holding the Settings and Save buttons, hidden until a save loads. `#user-panel-guest` is gone.
- **`#xp-vault`** remains as a hidden mirror of `#vault` inside settings-xp.html because the frozen route-safety tests drive it. Do not show two vault fields to the user.
- **`#current-chest-description`** is gone (box descriptions are longer than 6 words). The header shows art, name and the level stepper.
- **Shared wiring files.** `src/app.js` only calls `init*()`. Each workstream adds behaviour inside its own `src/app/<module>.js`. Cross-module calls go through exported functions; add an export to your own module rather than editing someone else's.
