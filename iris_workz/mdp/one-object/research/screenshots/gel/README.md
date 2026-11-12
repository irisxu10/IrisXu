# Gel (condition 02) — reference screenshots

Captured on 2026-11-12 from version **5.0.0-alpha.3** (volumetric Gel refinement), after the last source change, by an automated headless-Chrome session (`verify-gel2`) using real mouse input. The images have not been edited.

- **Viewport:** 1280 × 800 at device pixel ratio 2, so the images are 2560 × 1600.
- **Settings:** Gel defaults (viscosity 0.6, pressure 1.0, recovery 0.5, flow 0.7) and seed 20261105.

| File | Moment | Measured in the same run |
|---|---|---|
| `gel-01-rest.png` | At rest (interface faded in) | Exact shared outline, no motion; in-form brightness 32.1 (Condition 01: 31.3) |
| `gel-02-center-press.png` | About 1.2 s into a press held at the exact centre | 51% of in-form pixels changed vs rest; interior moved about 25 px; contour swelled +6.8 px; compressed ring around a cleared dimple |
| `gel-03-center-drag.png` | During a slow curved drag that started near the centre | Indenter lags the pointer by about 12 px; flow trace along the path; 57% of in-form pixels changed |
| `gel-04-edge-press.png` | About 1.2 s into a press on the right edge | Edge dented about 33 px; far side expanded about 8 px |
| `gel-05-recovery.png` | 0.45 s after releasing the centre press | Still flowing back; the gel later returned to a pixel-identical rest |

The images show programmed, simulated behaviour; how the material *feels* to people is untested.
The earlier Phase 03 screenshots (boundary-only gel) are in git commit `25a8e64`.
