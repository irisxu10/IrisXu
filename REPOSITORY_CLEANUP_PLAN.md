# Repository cleanup plan: `irisxu10/IrisXu`

*Audit date: 2026-11-12. This is a plan only: nothing has been deleted, moved, renamed or committed. Every step below waits for the owner's approval.*

**Repository:** `https://github.com/irisxu10/IrisXu`, local at `~/Desktop/IrisXu/IrisXu/`.

**Public site:** GitHub Pages, built from branch `main`, folder `/` (root), with the default Jekyll build (there is no `.nojekyll`).

**Main public URLs:**

- Portfolio: `https://irisxu10.github.io/IrisXu/iris_workz/index.html`
- One Object prototype: `https://irisxu10.github.io/IrisXu/iris_workz/mdp/one-object/` (shared with classmates for participant testing)
- `https://irisxu10.github.io/IrisXu/` itself returns **404**, because there is no `index.html` at the repository root. That is unchanged by this plan; see §6.

**Summary:**

- **Nothing in the repository is broken.**
- The cleanup is mainly about removing **four archived One Object versions that became public on `main` today** (when PR #3 was merged), and about stopping macOS system files from being committed.
- The portfolio and the active prototype should not move: their URLs are already in use.

---

## 1. Current repository structure

```text
IrisXu/                                   (tracked: 227 files; .git = 169 MB)
├── .DS_Store                             macOS system file (TRACKED by mistake)
├── .vscode/settings.json                 Live Server port 5501 (tracked)
├── .claude/                              Claude Code settings (ignored by your global gitignore; not in Git)
└── iris_workz/                           ← the published website lives here
    ├── .DS_Store                         macOS system file (TRACKED by mistake)
    ├── index.html                        portfolio home page (p5.js and matter.js canvas)
    ├── about.html, writings.html         portfolio pages (writings = "coming soon" placeholder, linked in nav)
    ├── artworks.html, projects.html      "coming soon" placeholders (NOT linked from anywhere)
    ├── mdp.html                          MDP projects overview page
    ├── style.css, header.js, footer.js, nav-data.js, project-data.js,
    │   home.js, sketch.js, ball.js, iris-letter.js      shared portfolio code and data
    ├── assets/                           45 images, 1 font, 1 video (144 MB; handpose.mp4 is 75 MB)
    └── mdp/
        ├── artquest.html, catletter.html, coffee.html,
        │   cono.html, exposure.html      MDP project detail pages (linked)
        ├── playground.html               "coming soon" placeholder (NOT linked)
        ├── one-object/                   ★ canonical One Object V5 project (84 files, 21 MB)
        ├── one-object-v4/                archived One Object 4.1.0   (25 files)
        ├── one-object-v4.0/              archived One Object 4.0.0   (25 files)
        ├── one-object-v3/                archived One Object 3.0.0   (22 files)
        ├── one_object_three_encounters_v2.html   archived single-file 4.1.0 + Stage 1 (120 KB)
        └── PROJECT_HANDOFF.md            old handoff (5 Nov), superseded by one-object/PROJECT_HANDOFF.md
```

**Not found:** there is **no separate "thesis research website"** in this repository. The thesis research material lives inside `mdp/one-object/`: `RESEARCH_PROTOCOL.md`, `PROJECT_HANDOFF.md`, `research/screenshots/` and `examples/`. There is also no root `README.md`.

## 2. Active projects and entry points

| Project | Entry point | Public URL | Status |
|---|---|---|---|
| Portfolio website | `iris_workz/index.html` | `/IrisXu/iris_workz/index.html` | Active. The navigation (`nav-data.js`) links Archive, About and Writings. |
| MDP overview | `iris_workz/mdp.html` | `/IrisXu/iris_workz/mdp.html` | Active; linked through `project-data.js` (`mdp.html#catletter`). |
| MDP project pages | `iris_workz/mdp/{artquest,catletter,coffee,cono,exposure}.html` | `/IrisXu/iris_workz/mdp/…` | Active; linked from `mdp.html` and `project-data.js`. |
| One Object / Many Encounters V5 | `iris_workz/mdp/one-object/index.html` | `/IrisXu/iris_workz/mdp/one-object/` | Active; the canonical development project. |
| External projects | `XXU_Artcenter/CT2`, `XXU_Artcenter/Dev4_Coffee` | another repository | Linked from `mdp.html`, `coffee.html` and `project-data.js`. Not part of this repository. |

### The canonical One Object project is confirmed

`iris_workz/mdp/one-object/` is version `5.0.0-beta.1`, the newest by content as well as by name.

| Required | Present | Evidence |
|---|---|---|
| Four interactive material conditions | ✅ | `src/materials/{Structural,Gel,Plastic,Silicone}Material.js` plus `src/physics/*Body.js`; `registry.js` marks all four `full` |
| Researcher Mode | ✅ | `src/ui/ResearcherPanel.js`, four sections |
| Participant interface | ✅ | `index.html`, `src/ui/ExhibitionUI.js`, `translations.js` (English and Chinese) |
| Session logging and export | ✅ | `src/research/{SessionLogger,ResearchSession,Exporter}.js`, schema v4 |
| Source and assets | ✅ | no external assets needed; everything is in `src/` |
| Tests and documentation | ✅ | `tests/` (**76 of 76 pass**, re-run during this audit); README, CHANGELOG, PROJECT_HANDOFF, RESEARCH_PROTOCOL |
| Published correctly | ✅ | `git diff origin/main -- iris_workz/mdp/one-object` shows 0 differences; the live URL passed 12 of 12 checks today |

**Archived versions compared with the canonical project.** Contents were compared, not just names.

| Item | Version inside | Unique content not in `one-object/`? |
|---|---|---|
| `one-object-v4/` | 4.1.0 | **No.** Every file exists in `one-object/` in a newer form; for example `Simulation.js` differs by 30 lines of later additions. |
| `one-object-v4.0/` | 4.0.0 | No. It is an earlier state of v4; 7 files differ from v4 (styles, renderer, UI). |
| `one-object-v3/` | 3.0.0 | One file, `src/rendering/ObjectRenderer.js`. It is the V3 renderer, replaced by the filament renderer in V4. Not used at runtime; historical value only. |
| `one_object_three_encounters_v2.html` | 4.1.0 + Stage 1, single file | Its features (Stage 1 proximity and dwell) were merged into `one-object/` in 4.2.0. Historical value only. |
| `mdp/PROJECT_HANDOFF.md` | 5 Nov | Superseded by `one-object/PROJECT_HANDOFF.md`. |

## 3. Dependency checks

Each check below was run for every candidate item:

- **References:** a search of every `.html`, `.js` and `.css` file for each path.
- **Links:** the navigation data (`nav-data.js`, `project-data.js`), `header.js` and `footer.js`.
- **Live URLs:** the HTTP status of each URL.
- **Git and backups:** whether the item is in git history, and whether it is in the tarball backup.

| Item | Referenced by site pages? | Linked in nav? | Live URL now | In git history | In external backup* |
|---|---|---|---|---|---|
| `mdp/one-object-v3/` | no (only its own files) | no | 200 | yes | yes |
| `mdp/one-object-v4/` | no | no | 200 | yes | yes |
| `mdp/one-object-v4.0/` | no | no | 200 | yes | yes |
| `mdp/one_object_three_encounters_v2.html` | no | no | 200 | yes | yes |
| `mdp/PROJECT_HANDOFF.md` | no | no | 200 | yes | yes |
| `artworks.html`, `projects.html` | no (`header.js` mentions them only in a comment) | no | 200 | yes | no |
| `mdp/playground.html` | no (`mdp.html` links to the `#playground` anchor, not this file) | no | 200 | yes | no |
| `writings.html` | **yes** (`nav-data.js`, `index.html`, `mdp.html`) | **yes** | 200 | yes | no |
| `assets/C0.png` (5.4 MB), `assets/G.jpg` (2.5 MB), `assets/Dev4_SelfPortrait-2 copy.jpg` (648 KB) | **no**, by any page or script | no | 200 | yes (since Jul 2025) | no |
| `.DS_Store`, `iris_workz/.DS_Store` | no | no | — | yes | — |

\*The external backup is `~/Desktop/IrisXu/one-object-backups/one-object-pre-consolidation-2026-11-12.tar.gz` (182 KB). It is verified to contain `one-object-v3/`, `-v4/`, `-v4.0/`, `one_object_three_encounters_v2.html` and `PROJECT_HANDOFF.md`. The original V2 is also in git commit `9a361d3`.

**Documentation cross-references.** `one-object/{README,CHANGELOG,PROJECT_HANDOFF}.md` mention the archived folders 5 times, for example `../one-object-v4/`. These are text references, not runtime dependencies, so the prototype keeps working if the folders are removed. The text should then point to the archive tag (step 3 of §10).

## 4. Inventory by category

### A — KEEP / ACTIVE

| Path | Why |
|---|---|
| `iris_workz/index.html`, `about.html`, `writings.html`, `mdp.html` | Live, linked pages |
| `iris_workz/style.css`, `header.js`, `footer.js`, `nav-data.js`, `project-data.js`, `home.js`, `sketch.js`, `ball.js`, `iris-letter.js` | Loaded by the pages above |
| `iris_workz/assets/` (all except the 3 in E) | Referenced by pages or `project-data.js`; `handpose.mp4` is used by `mdp.html` |
| `iris_workz/mdp/{artquest,catletter,coffee,cono,exposure}.html` | Linked MDP project pages |
| `iris_workz/mdp/one-object/` (entire folder) | Canonical active prototype; its public URL has been shared |
| `.vscode/settings.json` | Sets Live Server to port 5501, which the documented local preview URL relies on. Tiny and harmless. |

### B — KEEP / REFERENCE (inside active folders, valuable, not needed at runtime)

| Path | Why |
|---|---|
| `mdp/one-object/research/screenshots/` (20 MB) | Verified reference images for Gel, Silicone, Plastic and Phase 06; documentation evidence for the thesis |
| `mdp/one-object/examples/` | Example data exports (synthetic) for analysis scripts and reviewers |
| `mdp/one-object/tests/` | Development tests; needed to change the code safely |
| `mdp/one-object/*.md` | Project documentation and research protocol |

### C — ARCHIVE (remove from public `main`, preserved elsewhere)

| Path | Reason | Backup status | Impact of removing from `main` |
|---|---|---|---|
| `iris_workz/mdp/one-object-v3/` | Superseded 3.0.0 prototype; only unique file is a replaced renderer | Git history (`91b1790` onward), the prototype branch, tarball, and the proposed tag | Its public URL (live only since today, linked nowhere) returns 404; no site page affected |
| `iris_workz/mdp/one-object-v4/` | Superseded 4.1.0 | same | same |
| `iris_workz/mdp/one-object-v4.0/` | Superseded 4.0.0 | same | same |
| `iris_workz/mdp/one_object_three_encounters_v2.html` | Superseded single-file 4.1.0 + Stage 1 | same, plus `9a361d3` | same |
| `iris_workz/mdp/PROJECT_HANDOFF.md` | Superseded by `one-object/PROJECT_HANDOFF.md` | same | same |

**Recommended way to archive:** remove the items from `main` with `git rm`, and keep them reachable through a **Git tag** created first (`archive/one-object-versions-2026-11-12`, at today's `main`), plus the existing tarball. A tag keeps the exact files in GitHub, with a browsable link, without keeping them on the public website. A separate branch or a private repository would also work but adds upkeep.

### D — SAFE TO DELETE

| Path or item | Reason | Backup status | Impact |
|---|---|---|---|
| `.DS_Store` (repository root) | macOS Finder metadata; no content | not needed | none; stop tracking it and add it to `.gitignore` |
| `iris_workz/.DS_Store` | same | not needed | none |
| Local branch `one-object-v5` (only on this Mac, never pushed) | Prepared for publishing; its content (`a09387e`) is identical to what is now on `main` | its content is on `main` | none (local only) |
| Remote branches `prototype/homepage-identity-navigation`, `prototype/homepage-shared-surface`, `redesign/floating-archive` | Fully merged into `main` (0 commits ahead); last updated in July | every commit is in `main`'s history | none on the website. **Optional**: deleting them only tidies the branch list; if in doubt, keep them. |

### E — NEEDS YOUR DECISION

| Path | Question | My suggestion |
|---|---|---|
| `iris_workz/artworks.html`, `iris_workz/projects.html` | "Coming soon" placeholders, linked nowhere, but their URLs are live. Do you plan to use them? | Keep if planned; otherwise remove (both are in git history). |
| `iris_workz/mdp/playground.html` | "Coming soon" placeholder; the playground entry links to an external site instead. | Same as above. |
| `iris_workz/assets/C0.png`, `G.jpg`, `Dev4_SelfPortrait-2 copy.jpg` (8.5 MB total) | Used by no page. Are they originals or alternates you still need? | Keep a copy outside the repository, then remove (they stay in git history either way). |
| `prototype/homepage-soft-glass-atmosphere` | Your working branch. It is now fully merged into `main`, which is 3 merge commits ahead with no content difference. | Keep working on it and merge to `main` with pull requests, or work on `main` directly; choose one way. |
| `mdp/one-object/research/screenshots/` | 20 MB of PNG files are public. Is that acceptable? | Keep (useful thesis evidence). Only reconsider if repository size becomes a problem. |
| Repository-root 404 (`/IrisXu/`) | Should the root redirect to the portfolio? | Optional: a tiny root `index.html` that redirects to `iris_workz/index.html`. It changes no existing URL. |

## 5. Generated, cache and OS files (`.gitignore`)

There is **no `.gitignore` in the repository**. The `.claude/` folder is ignored only through your personal global gitignore, which other machines won't have. Proposed `.gitignore`:

```gitignore
# macOS
.DS_Store
# editor / tools (keep .vscode/settings.json tracked for the Live Server port)
.claude/
# dependencies, logs, test output (none today; prevents accidents)
node_modules/
*.log
# local data exports (participant data must never be committed)
research-session-*.json
```

Do not ignore `examples/*.json`; those files are intentional and synthetic. The `research-session-*.json` pattern matches only real exports from the page, so participant data downloaded into the repository by mistake can never be committed.

## 6. Dependency and broken-link risks

| Risk | Level | Notes |
|---|---|---|
| Removing the C items breaks a page | **None found** | No page, script or stylesheet references them. |
| Someone bookmarked an archived URL | Very low | Live only since today's merge, and linked nowhere. |
| One Object docs mention `../one-object-v4/` and similar | Low (text only) | Update to the archive tag in the same commit. |
| Removing the E placeholders | Low | Their URLs would 404; nothing links to them. |
| Removing the E assets | Low | No references found. Keep a copy outside the repository first in case they are originals. |
| Moving `iris_workz/` or `mdp/one-object/` | **High, not recommended** | Every portfolio URL and the shared prototype URL would break. |

## 7. GitHub Pages deployment risks

- **Pages builds `main`** with Jekyll. Two rules: never add files or folders whose names start with `_` (Jekyll hides them), and never put `{{` or `{%` in Markdown or HTML files (that can fail the **whole** site build). Neither occurs today. Adding an empty `.nojekyll` file at the repository root would remove both risks; it is optional and changes no URLs.
- **Merging the working branch publishes everything on it.** That is how the archives reached `main` today (PR #3). Before merging a pull request, check its "Files changed" tab.
- **Pages rebuilds after every push to `main`** (about 1–4 minutes). Participants testing at that moment may get a mix of old and new files; avoid pushing during scheduled test sessions.
- **Case sensitivity:** Pages paths are case-sensitive and macOS is not. All 90 relative references in `one-object/` were verified with exact case.

## 8. Recommended future structure (minimal change, URLs preserved)

```text
IrisXu/
├── README.md                    NEW: what lives where, public URLs, how to preview
├── .gitignore                   NEW (see §5)
├── .nojekyll                    optional (see §7)
├── index.html                   optional: redirect to iris_workz/index.html (fixes the root 404)
├── .vscode/settings.json
└── iris_workz/                  PUBLIC PORTFOLIO (paths unchanged)
    ├── *.html, *.js, style.css, assets/
    └── mdp/
        ├── *.html               MDP project pages
        └── one-object/          ONE OBJECT PROTOTYPE + THESIS RESEARCH (unchanged path)
            ├── index.html, src/            prototype
            ├── tests/                      development tests
            ├── RESEARCH_PROTOCOL.md, PROJECT_HANDOFF.md, research/, examples/   research documentation
            └── README.md, CHANGELOG.md

Historical archives → Git tag `archive/one-object-versions-2026-11-12` (+ the existing tarball); not on the live site.
```

This keeps the six concerns you listed separate without moving anything that has a public URL:

- **Public portfolio:** `iris_workz/`
- **One Object prototype:** `mdp/one-object/src`
- **Research documentation:** `mdp/one-object/*.md` and `research/`
- **Development tests:** `mdp/one-object/tests`
- **Historical archives:** the tag
- **Thesis research website:** none exists yet. If you build one later, give it its own folder, for example `iris_workz/thesis/`.

No build tools are added.

## 9. Git and GitHub status at the time of the audit

| | |
|---|---|
| Current branch | `prototype/homepage-soft-glass-atmosphere`, in sync with its remote |
| Uncommitted changes and untracked files | none (apart from this new plan file) |
| Remote branches | `main`, `prototype/homepage-soft-glass-atmosphere`, `prototype/homepage-identity-navigation`, `prototype/homepage-shared-surface`, `redesign/floating-archive`. **All are fully merged into `main`.** |
| Local-only branches | `one-object-v5` (redundant); local `main` is stale at `9443286`, which is harmless (update it with `git pull` on `main` if you use it) |
| Open pull requests | none (PR #3 merged today) |
| Old One Object versions on remote `main` | **yes**: `one-object-v3/`, `-v4/`, `-v4.0/`, `one_object_three_encounters_v2.html`, `mdp/PROJECT_HANDOFF.md` (all publicly reachable) |
| Active One Object folder | published correctly; identical to local; live URL verified |
| Tracked OS files | `.DS_Store` and `iris_workz/.DS_Store` |

## 10. Step-by-step cleanup plan (each step waits for your approval)

Each step is one small commit, pushed by you from VS Code. Nothing is force-pushed and no history is rewritten.

1. **Freeze today's state** (no files change): `git tag archive/one-object-versions-2026-11-12 origin/main`, then `git push origin archive/one-object-versions-2026-11-12`. The archives can then be browsed on GitHub through that tag forever.
2. **Repository hygiene:** add `.gitignore` (§5) and run `git rm --cached .DS_Store iris_workz/.DS_Store`. The files stay on your Mac and Git stops tracking them.
3. **Archive the old One Object versions (C):** `git rm -r iris_workz/mdp/one-object-v3 iris_workz/mdp/one-object-v4 iris_workz/mdp/one-object-v4.0 iris_workz/mdp/one_object_three_encounters_v2.html iris_workz/mdp/PROJECT_HANDOFF.md`. In the same commit, update the 5 references in `one-object/*.md` to point to the tag. This also removes the local copies from your working folder; they remain in the tag, in Git history and in the tarball. If you want local copies too, copy them next to the tarball first.
4. **Your decisions (E):** apply whatever you choose for the placeholders, unused assets, root redirect and `.nojekyll`.
5. **Optional branch tidy-up (D):** delete the local `one-object-v5` (`git branch -d one-object-v5`) and, if you wish, the three merged remote branches on GitHub (Branches page → delete; GitHub can restore deleted branches for a while).
6. **Add a root `README.md`** listing the projects, public URLs and the local preview command.
7. **Verify after each push:**
   - `npm test` in `one-object/` (76 tests);
   - the portfolio pages and the prototype URL return 200, and the removed URLs return 404;
   - the live One Object check (four conditions, HTTPS, mobile);
   - the portfolio home page loads without console errors.

Steps 1, 2 and 6 are risk-free. Step 3 is the only one that removes anything from the public site. Steps 4 and 5 depend on your answers.
