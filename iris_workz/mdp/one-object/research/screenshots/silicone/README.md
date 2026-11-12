# Silicone (condition 04) — reference screenshots

Captured on 2026-11-12 from version **5.0.0-alpha.4**, after the last source change, by an automated headless-Chrome session (`verify-sil`) using real mouse input. The images have not been edited.

- **Viewport:** 1280 × 800 at device pixel ratio 2, so the images are 2560 × 1600.
- **Settings:** Silicone defaults (stiffness 0.5, resistance 0.5, damping 0.75, recovery 0.5, maxDeformation 0.45) and seed 20261105.

| File | Moment | Measured in the same run |
|---|---|---|
| `silicone-01-rest.png` | At rest | Exact shared outline, static; in-form brightness 32.9 (Condition 01: 31.3) |
| `silicone-02-edge-stretch.png` | Holding a stretch pulled outward from the right edge | Grabbed region followed 65 px; peak strain 0.33; no folded triangles; 24% of in-form pixels changed |
| `silicone-03-center-stretch.png` | Holding a stretch that started at the centre | Followed 58 px; bands converge on the grab; 53% of pixels changed |
| `silicone-04-release-overshoot.png` | About 0.23 s after releasing the edge stretch | The stretched region has sprung about 15 px *past* rest (overshoot) |
| `silicone-05-recovering.png` | 0.7 s after releasing the centre stretch | Oscillation dying out; later returns to a pixel-identical rest |

The images show programmed, simulated behaviour; how the material *feels* to people is untested.
