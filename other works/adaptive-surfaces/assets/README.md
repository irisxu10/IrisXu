# Artwork files

Drop finished files here with these exact names. Anything missing shows a labelled placeholder.
Paths can be changed in `js/content.js`.

## Animal photographs (the five columns)

| Animal | File |
|---|---|
| Turtle | `turtle-photo.jpg` |
| Thorny Devil | `thorny-devil-photo.jpg` |
| Chameleon | `chameleon-photo.jpg` |
| Gecko | `gecko-photo.jpg` |
| Snake | `snake-photo.jpg` |

Each photo fills a tall, narrow strip with a 1 : 2.1 ratio (`object-fit: cover`),
so portrait or tightly cropped images work best. Set `focus` in `js/content.js`
to the point the photo should zoom into as it becomes the banknote, such as an
eye, a foot or a patch of skin, for example `'52% 58%'`.

## Banknotes (landscape, front and back)

| Note | Front | Back |
|---|---|---|
| 1 — Turtle — Protection | `turtle-front.png` | `turtle-back.png` |
| 5 — Thorny Devil — Collection | `thorny-front.png` | `thorny-back.png` |
| 10 — Chameleon — Camouflage | `chameleon-front.png` | `chameleon-back.png` |
| 20 — Gecko — Grip | `gecko-front.png` | `gecko-back.png` |
| 100 — Snake — Transformation | `snake-front.png` | `snake-back.png` |

The notes are shown at a 2.1 : 1 ratio and the artwork is fitted with `object-fit: contain`.
Banknotes appear upright in the columns, where the landscape artwork is turned 90°.
They also appear in the family composition, in the focused view (front and back)
and in the security demo.

## Security demo features

| File | What it is |
|---|---|
| `thread-frame-01.png` … `thread-frame-05.png` | Anima motion thread, five discrete states. Transparent, tall and narrow. |
| `watermark.png` | Watermark. It is multiplied into the light window, so dark = denser paper. Transparent or white background. |
| `register-front.png` | Left (front) half of the see-through register. Transparent. |
| `register-back.png` | Right (back) half of the see-through register. Transparent. |

Both register halves are drawn into the same square box. Export them on the same
canvas so they line up perfectly when the light reaches full strength.
