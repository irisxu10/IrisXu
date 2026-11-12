# Phase 06 — integration screenshots

Captured on 2026-11-12 from version **5.0.0-beta.1** in the automated browser QA run (`verify-p6`, 56 of 56 checks). The viewport is 1280 × 800 at device pixel ratio 2 unless the file name says otherwise.

## The same gesture in all four conditions

The gesture: press at the right edge, drag 0.4 R inward, hold 0.5 s, release.

| File | What it shows | Measured (% of in-form pixels changed vs rest) |
|---|---|---|
| `same-gesture-01-hold.png`, `-after-6s.png` | Structural: local filament deformation; back in shape later, with a memory trace | 26.4% while holding · 10.9% after 6 s |
| `same-gesture-02-hold.png`, `-after-6s.png` | Gel: volume flows away from the press; slow (still 53% at 0.25 s), then rest | 53.5% · 0.3% |
| `same-gesture-03-hold.png`, `-after-6s.png` | Plastic: edge folded over; after release a permanent bend and crease | 12.8% · **5.5%** (persists) |
| `same-gesture-04-hold.png`, `-after-6s.png` | Silicone: stretched membrane; overshoots, then exact rest | 54.9% · 0.4% |

## Other screenshots

| File | What it shows |
|---|---|
| `researcher-panel.png` | Researcher Mode during condition 04: active condition and state, Material properties, Behaviour & memory with live metrics, Encounter conditions |
| `reflection.png` | The five optional reflection questions |
| `phone-375x667.png` | Phone layout, condition 03 at rest |
| `touch-390-plastic-fold.png` | Emulated touch (390×844 at 3×): a finger drag folds the plastic edge |
