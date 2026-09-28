# Storage Fit

Storage Fit is a dependency-free browser tool for planning boxes and organizers inside drawers, shelves and cupboards.

## What it does

- Models multiple storage spaces and reusable items.
- Generates practical maximal layouts with different optimization goals.
- Shows front, top, side and draggable 3D views.
- Lets you drag, rotate, duplicate and remove items in a layout.
- Models blocked zones such as rails, hinges and unusable corners.
- Detects leftover rectangles and suggests saved items that fit them.
- Imports public IKEA/product URLs when product metadata is available.
- Saves plans, builds shopping lists, prints/exports layouts, and backs up/restores all browser data.

## Run locally

No build step or package install is required.

    python3 -m http.server 8080

Then open http://localhost:8080/.

Using a local web server is preferable to opening index.html directly because browser storage and cross-origin behavior are more predictable.

## Project structure

    .
    ├── index.html        Application shell
    ├── styles.css        Application styles
    ├── app.js            Planner, optimizer, import and persistence logic
    ├── tests/
    │   └── smoke.html    Browser smoke tests for core helpers
    └── README.md

The project intentionally remains plain HTML, CSS and JavaScript with no framework and no bundler.

## Tests

Start the local server and open:

http://localhost:8080/tests/smoke.html

The smoke suite loads the real application and checks IKEA measurement parsing, article-number extraction, unit conversion, URL sanitization and backup validation. It snapshots and restores localStorage so the test page does not replace your planner data.

## Data and backups

Application state lives in browser localStorage. Use Data & portability → Backup all data before changing browser, device or deployment origin.

A plan export is different from a full backup:

- Plan export contains one selected layout and its exact placements.
- Full backup contains the complete application state.

## Smart product import

Product import runs in the browser. It first tries the public product page and can fall back to the public r.jina.ai reader when direct cross-origin access is blocked. Retailer markup and access policies can change, so imported dimensions should always be reviewed before purchasing.

## Deployment

The repository is static and can be hosted as-is on GitHub Pages, Cloudflare Pages, Netlify, Vercel static hosting, or a conventional web server.
