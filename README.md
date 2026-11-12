# IrisXu

Portfolio and MDP project work of Iris Xu, published with GitHub Pages from the `main` branch.

## Structure

```text
IrisXu/
├── iris_workz/                     portfolio website (all public pages live here)
│   ├── index.html                  home page
│   ├── about.html, writings.html   portfolio pages
│   ├── mdp.html                    MDP projects overview
│   ├── *.js, style.css             shared navigation, footer, home-page canvas and styles
│   ├── assets/                     images, video and font used by the pages
│   └── mdp/
│       ├── artquest.html, catletter.html, coffee.html, cono.html, exposure.html
│       │                           MDP project pages
│       └── one-object/             One Object / Many Encounters — active thesis prototype
└── .vscode/settings.json           Live Server on port 5501 (local preview)
```

## Projects

| Project | Path | Public URL |
|---|---|---|
| Portfolio | `iris_workz/index.html` | https://irisxu10.github.io/IrisXu/iris_workz/index.html |
| MDP projects | `iris_workz/mdp.html` and `iris_workz/mdp/*.html` | https://irisxu10.github.io/IrisXu/iris_workz/mdp.html |
| One Object / Many Encounters (V5) | [`iris_workz/mdp/one-object/`](iris_workz/mdp/one-object/) | https://irisxu10.github.io/IrisXu/iris_workz/mdp/one-object/ |

One Object / Many Encounters is an interactive research prototype with four material conditions, a Researcher Mode and a session data export. Its documentation, research protocol and tests are inside the project folder. Start with [`iris_workz/mdp/one-object/README.md`](iris_workz/mdp/one-object/README.md).

## Local preview

The pages use relative paths and need a local web server (ES modules do not load from `file://`):

- **VS Code Live Server:** open this folder and click **Go Live**, then visit `http://127.0.0.1:5501/iris_workz/index.html`.
- **Python:** run `python3 -m http.server 8000` in this folder, then visit `http://localhost:8000/iris_workz/index.html`.

To run the prototype's tests (Node 18 or later): `cd iris_workz/mdp/one-object && npm test`.

## Archives

Earlier One Object versions (3.0, 4.0, 4.1 and the single-file 4.1 build) are no longer on the live site. They are preserved in the Git tag `archive/one-object-versions-2026-11-12` and in Git history.
