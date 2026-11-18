# Adaptive Surfaces — interactive pitch

One continuous horizontal surface, built for a 2–3 minute live pitch. The browser
window acts as a camera gliding across a single long piece of security-printed
paper. The surface has no slides and no page changes, and the background never
resets.

Plain HTML / CSS / JavaScript with no build step and no dependencies.

## Run

Open `index.html` in Chrome or Safari. It also works straight from the file system.
For a local server: `python3 -m http.server 8000`, then visit `http://localhost:8000`.

## Presenting

| Action | Input |
|---|---|
| Travel | mouse wheel or trackpad, vertical or horizontal. When you stop close to a stop, the camera settles onto it |
| Next stop | → · Space · PageDown · → button |
| Previous stop | ← · PageUp · ← button |
| Back to the beginning | "Adaptive Surfaces" (bottom left) · Home · Esc |
| Last stop | End |
| Full screen | F (in full screen, the browser uses the first Esc to exit full screen) |
| Look closely at a banknote | click a column once it has become a note, or a note in the family. FLIP turns it. Esc, an arrow or a click outside closes it |
| Security demo modes | 1 Touch · 2 Tilt · 3 Light · 4 Flip (press again to clear) |
| Start at a stop for rehearsal | add `#4` to the URL |

Presentation clickers send PageUp and PageDown, so they work without setup.

## The journey

| Stop | What is on screen | Chapter |
|---|---|---|
| 1 | Opening: Adaptive Surfaces | Origin |
| 2 | A surface is never passive: the five strategies | Origin |
| 3 | "What if a banknote could behave the same way?" | Origin |
| 4 | The five animal columns, all visible (pause) | Adaptation |
| 5–9 | Turtle → Thorny Devil → Chameleon → Gecko → Snake, each becoming its banknote | Surface |
| 10 | The columns release into the family composition | Family |
| 11 | Interactive security: Touch · Tilt · Light · Flip | Security |
| 12 | From biology to security | Security |
| 13 | Closing | Family |

**The five-column zone is held in place while the camera keeps moving.** Travelling
forward drives the transformation directly, and scrolling back plays it in reverse.
For each column:

1. The photo zooms toward its `focus` point.
2. The animal's micro-pattern surfaces.
3. The strategy word and fine guilloché pass through.
4. The banknote opens from the centre.

After the snake, the columns turn and spread into the family. Then the zone moves on.

## The surface

The surface is built from four layers, each moving at its own speed:

| Layer | What it is | Speed | File |
|---|---|---|---|
| Paper | warm ivory with fine grain and faint engraved lines | 0.4× | `css/world.css` |
| Curves | fine guilloché lines and translucent ribbons, slowly moving | 0.6× | `js/curves.js` |
| Micro-patterns | turtle scutes → thorny-devil channels → chameleon cells → gecko hexagons and lamellae → snake scale lattice | 0.85× | `js/patterns.js` |
| Content | text, animals, banknotes | 1× | `index.html` |

The curves are calculated from the position on the surface, not from the screen,
so they run unbroken from the opening to the closing. Along the way their spread,
amplitude, fine detail, opacity and colour change gradually. They become densest
around the security zone. To tune this character, edit `KEYS` in `js/curves.js`.

The field breathes along the journey. Three rows of `KEYS` control this:

- `dens`: how many of the lines are visible.
- `quiet`: how strongly the lines keep to a central band, fade toward the
  edges and dissolve before they cross the screen.
- `acc`: how strong the colour accents are.

Most lines are muted. The colour comes from one cyan line group, one lavender
edge and small orange-gold dots.

**Text protection.** Add `data-haze` to any element, optionally with a strength
such as `data-haze="0.6"`. The lines then fade softly behind that element,
with no visible box, and the effect follows it as it travels and reveals.

Colours and ink tones are in `css/tokens.css`.

The reptile patterns emerge from the curves as each animal transforms and dissolve
back into them. The same pattern also appears inside each column during its
transformation.

**The recurring thread:** thin, windowed, iridescent vertical lines cross the
surface between zones. In the security demo, a thread of the same kind runs
through the note's ANIMA thread. In TILT mode it widens to the real thread's
width, which reveals what those lines were.

## Tuning

All of these are in `js/content.js`:

- `AS.config` sets scroll speed, camera glide, and how strongly the camera settles onto stops.
- `AS.WORLD.frames` sets where each zone sits along the surface, in screen widths.
- `AS.WORLD.pin`, `.transform` and `.release` set how long the column zone is held
  and how much travel each transformation and the family release take.
- `AS.WORLD.stops` lists the presentation stops, and `AS.WORLD.chapters` the chapter labels.
- `AS.WORLD.threads` sets where the thread motif crosses the screen. Write an
  entry as `[position, opacity]` to make that thread fainter.

The family composition is in `FAMILY` at the top of `js/columns.js`.

## Replacing artwork

1. Export your photos (JPG) and banknote artwork (PNG) with the filenames listed in [`assets/README.md`](assets/README.md).
2. Drop them into `assets/`.
3. Reload. Each placeholder is replaced automatically.

To use a different filename, change the path in **`js/content.js`**:
`AS.notes[].photo`, `.front` and `.back`, and `AS.assets` for the thread
frames, watermark and register. Every image goes through one component,
`AS.image()` in `js/image.js`, which shows a labelled placeholder until the file exists.

To line the security features up with your final artwork, edit
`AS.featureLayout` in `js/content.js`. It sets the thread position, the
watermark window, the register and the touch zones, all as percentages of the note.

## Files

```
index.html            surface layers, the track and its zones (text comes from content.js)
css/tokens.css        colours, fonts, easing curves
css/typography.css    type styles
css/layout.css        zone headers, presentation controls
css/world.css         surface layers, track, micro-pattern and thread styles, reveals
css/placeholders.css  image component and placeholder look
css/scenes.css        opening, concept, biology → security, closing
css/columns.css       five columns → banknotes → family; the focused view
css/banknote.css      security demo: the interactive note, its modes, the thread
js/content.js         ALL TEXT, image paths, world layout, stops, settings
js/image.js           AS.image(): the reusable image component
js/glyphs.js          line glyphs for the five strategies
js/patterns.js        reptile micro-patterns + midground layer
js/curves.js          the continuous curve field
js/scenes.js          fills text; builds the concept words and the biology → security rows
js/columns.js         the column zone, driven by the camera
js/banknote.js        security demo interactions
js/world.js           the camera: travel, stops, parallax, reveals, chapters
```

`data-reveal="ms"` on an element makes it fade in that long after it comes into
view from the right. It resets when it leaves to the right, so travelling back
and forward again replays it.

Reduced-motion settings are respected: the camera moves without easing, the
surface stops drifting, and reveals are shortened.
