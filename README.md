# Storage Fit Planner

A dependency-free, browser-based storage layout optimizer.

Storage Fit Planner helps you model drawers, shelves, cupboards, and other storage spaces; add boxes/organizers; generate practical layouts; inspect them in multiple views; account for blocked zones and clearances; and turn chosen layouts into shopping plans.

## Features

- Multiple storage spaces with width, depth, and height
- Multiple items/organizers with optional quantity limits
- Automatic layout generation with several optimization goals
- Front, Top, Side, and draggable 3D views
- Editable layouts with collision checking
- Blocked zones for rails, hinges, pipes, and unusable areas
- Fit tolerance / minimum gap
- Leftover-space detection and item suggestions
- Saved plans
- Product metadata: price, currency, SKU, product URL, and image
- Smart product import from public product links, including IKEA-specific parsing
- Shopping lists, estimated totals, print view, and per-layout JSON export
- Full local-data Backup / Restore

## Run locally

No build step or package manager is required.

You can open `index.html` directly in a browser, or serve the directory with any static web server. For example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Data storage

Application data is stored in browser `localStorage` under the current app storage key.

Because `localStorage` is scoped to the browser origin, data stored while opening the app as a local file is separate from data stored on `localhost`, GitHub Pages, Cloudflare Pages, or another domain.

Use **Data & portability → Backup all data** before moving between origins, browsers, or devices. Use **Restore backup** on the new installation.

## Smart product import

Product import runs in the browser. It first tries the public product page directly and, when needed, falls back to a public text-reader endpoint. Retailers can change their pages or block browser requests, so imported dimensions and prices should still be reviewed before purchasing.

The rest of the planner works locally without a backend.

## Deploy

This repository can be deployed as a static site to services such as:

- GitHub Pages
- Cloudflare Pages
- Netlify
- Vercel static hosting
- Any ordinary web server

The app currently has no build dependencies.

## Repository structure

```text
.
├── index.html
├── README.md
└── .gitignore
```

## Development

For now, the application intentionally remains a single `index.html` file so it is easy to copy, host, and run offline. As the project grows, the HTML, CSS, and JavaScript can be split into separate source files without changing the user data format.
