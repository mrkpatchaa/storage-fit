# Storage Fit

Storage Fit is a dependency-free browser tool for planning boxes and organizers inside drawers, shelves and cupboards.

## What it does

- Models your home as Room → Furniture → Storage space, while keeping reusable items in one shared library.
- Supports opt-in true 3D stacking with per-item rules: stay upright, may sit on another item, and may support items above.
- Generates practical maximal layouts with different optimization goals.
- Shows front, top, side and a draggable solid 3D view, with step-by-step assembly playback.
- Lets you drag, rotate, duplicate and remove items in a layout.
- Models blocked zones such as rails, hinges and unusable corners.
- Detects leftover rectangles, suggests saved items that fit them, and can fill one with a made-to-measure bin plus its 3D-print file.
- Imports public IKEA/product URLs when product metadata is available, previews the result before saving, and detects existing catalog items by SKU or canonical product URL.
- Finds every storage space where a selected organizer can physically fit, using the same clearance, orientation, obstacle and divider rules as the planner.
- Saves plans, builds inventory-aware shopping lists, prints/exports layouts, and backs up/restores all browser data.
- Turns saved plans into a shortlist: rename them, add notes, mark a chosen plan, and compare up to three side-by-side.
- Measures hands-free: say each storage's width, depth and height, and it is filled in, verified and the next one opened.
- Prints drawer labels whose QR code opens that storage's layout in 3D on a phone.
- Saves or shares a picture of a layout, and shares compact read-only links.
- Works offline once opened, installs as an app, and follows the system's light or dark theme.

## Run locally

No build step or package install is required.

    python3 -m http.server 8080

Then open http://localhost:8080/.

Using a local web server is preferable to opening index.html directly because browser storage and cross-origin behavior are more predictable.

## Light and dark themes

The **Theme** menu next to the title offers **Auto**, **Light** and **Dark**. Auto follows the system setting and switches live when it changes; a Light or Dark choice is remembered on this device (it is a viewing preference, so it is not part of backups). The share viewer follows the same setting.

Colours are CSS custom properties in `styles.css`: the light values keep the original look exactly, and dark values apply to the screen only, so printed plans, checklists and labels always print in their light colours. Storage drawings keep a light "paper" floor in both themes. Dark-theme text meets the WCAG AA contrast ratio of 4.5:1, which the smoke tests check. `theme.js` runs before the stylesheet, so pages open in the right theme without a flash.

## Offline and install

Storage Fit works without a connection once it has been opened online. A small service worker (`sw.js`) caches the planner, the share viewer, the 3D renderer, styles and icons. Online, every file still comes from the network first, so a new deploy is picked up on the next load, and each response refreshes the cache. Offline, or when a weak connection has not answered within four seconds, the cached copy is served, and any other page falls back to the planner. Product imports and every other cross-origin request bypass it.

With `manifest.webmanifest`, browsers that support it can install Storage Fit as a standalone app (Add to Home Screen on phones, Install app in Chrome and Edge). Planner data stays in the same browser storage, so installing does not move or copy it.

Service workers need `https://` or `localhost`; opening `index.html` from the file system skips them. The worker is only registered by top-level pages, so the smoke-test page's frames never install it.

## Project structure

    .
    ├── index.html        Application shell
    ├── styles.css        Application styles
    ├── app.js            Planner, optimizer, import and persistence logic
    ├── view3d.js         3D renderer shared by the planner and the share viewer
    ├── qr.js             Dependency-free QR code encoder for drawer labels
    ├── sw.js             Offline cache (service worker)
    ├── manifest.webmanifest, icon.svg, icon-192.png, icon-512.png   Install metadata and icons
    ├── share.html        Read-only shared-plan viewer
    ├── share.js          Shared-plan viewer logic
    ├── tests/
    │   ├── smoke.html             Browser smoke tests
    │   ├── run-browser-smoke.sh   Headless-Chrome runner used by CI
    │   ├── service-worker-test.js Offline-cache tests (plain Node, no dependencies)
    │   └── qr-test.js             QR encoder tests against an independent encoder's output
    └── README.md

The project intentionally remains plain HTML, CSS and JavaScript with no framework and no bundler.

## Tests

Start the local server and open:

http://localhost:8080/tests/smoke.html

CI runs the same page headlessly with `bash tests/run-browser-smoke.sh` (set `CHROME_BIN` when Chrome is not on `PATH`, for example `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` on macOS), and runs the offline-cache and QR tests with `node tests/service-worker-test.js` and `node tests/qr-test.js`.

The smoke suite loads the real application through a test-only API and checks IKEA measurement parsing, article-number extraction, unit conversion, URL sanitization, backup validation, 3D collision detection, and full-footprint stack support. It snapshots and restores localStorage so the test page does not replace your planner data.

## Data and backups

Application state lives in browser localStorage. Use Data & portability → Backup all data before changing browser, device or deployment origin.

A plan export is different from a full backup:

- Plan export contains one selected layout and its exact placements.
- Full backup contains the complete application state.

## Smart product import

Product import runs in the browser. It first tries the public product page. If that request is blocked **or succeeds without usable width/depth/height**, Storage Fit also tries the public r.jina.ai reader and merges any missing measurements into the preview. This matters for retailer pages that return a partial JavaScript shell with a title/reference but omit the measurement section from the fetched HTML. Complete direct-page imports still use a single request.

Structured product metadata is preferred before text scraping. Storage Fit reads normal JSON-LD width/depth/height fields **per axis**, so mixed unit declarations are normalized correctly, and it can also recover dimensions from schema.org `additionalProperty` / `PropertyValue` entries such as Width, Depth and Height (including common localized labels). It also accepts coherent composite triplets such as `Dimensions: 38 × 76 × 30 cm` and mixed-unit values such as `38 cm × 760 mm × 0.3 m`, including triplets whose missing shared unit is carried separately in `unitCode` / `unitText` or exposed through a product `size` field. When the retailer explicitly declares another axis order—such as `Product Dimensions (L × W × H): 76 × 38 × 30 cm`—Storage Fit maps the values back to its internal **Width × Depth × Height** order instead of silently swapping width and depth. Common full axis names are recognized in English, French, German, Spanish, Italian, and Dutch. Unlabeled triplets retain the normal W×D×H interpretation. Complete axis-specific dimensions take precedence over composite metadata. Package-prefixed properties are ignored.

Prices are normalized across common retailer number formats before the preview is shown. Values such as `1 299`, `1.299,00`, and `1,299.00` all resolve to the same numeric price. Smart Import applies this to JSON-LD offers (including aggregate/nested price fields), product-price meta tags, and reader text; `DH` / `DHS` are normalized to `MAD`, while `€` and `$` map to `EUR` and `USD`.

Reader parsing then acts as the text fallback. It treats product measurements as a coherent set rather than taking the first width, depth, and height independently. When markdown headings are available it prefers product/measurement sections and ignores package/packaging sections, preventing shipping dimensions from being mixed with the organizer's real dimensions. Retailer markup and access policies can change, so imported dimensions should always be reviewed before purchasing.

## Deployment

The repository is static and can be hosted as-is on GitHub Pages, Cloudflare Pages, Netlify, Vercel static hosting, or a conventional web server.


## Stacking model

Stacking is deliberately conservative:

- It is disabled by default.
- An item must explicitly allow being stacked.
- The supporting item must explicitly allow items above it.
- The upper item must be fully supported by one lower item; bridging across multiple boxes is not allowed.
- Horizontal fit tolerance still applies to boxes sharing the same height range.
- Vertical faces may touch, which is required for physical stacking.
- Storage height, blocked zones and true 3D box collisions are enforced.

When stacking is enabled, **Best use of space** is scored by usable storage volume instead of floor coverage. Front, side and 3D views render each item's true elevation.


## Saved-plan decision workspace

Saved plans are more than bookmarks:

- Rename a plan to something meaningful.
- Add a short note such as “best for socks” or “buy only if on sale.”
- Mark one saved plan as the **Chosen** plan.
- Select two or three plans and compare utilization, item count, stacking, estimated cost, and item mix side-by-side.
- Opening a saved plan restores the fit settings that were active when it was saved.
- Saving an edited saved plan creates a new revision and records its immediate parent. Saved-plan cards and the compare view show **Based on …** so near-duplicate versions remain traceable. If the parent is later renamed, the live name is shown; if it is deleted, the child keeps the original parent-name snapshot and marks the source as removed.
- Plans with lineage expose a **Family** action. It groups the immediate parent, current plan, and direct child revisions in one modal, keeps removed parents visible as placeholders, and lets you open any live family member directly.
- The family view can also promote any Current family member directly to **Chosen**. If another family member is already marked Installed, Storage Fit compares the physical layouts first: label-only / metadata-only revisions transfer the Installed marker to the new plan, while moves, reorientations, organizer swaps, additions, or removals still warn and return the storage to the installation queue.
- Revisions also show a compact **Δ vs parent** summary: organizers added/removed, moved, reoriented or relabeled, plus utilization-point change and additional units to buy. When both plans have a comparable single-currency purchase total, the cost delta is shown too. Duplicate organizers are deterministically best-matched by type and geometry; the app does not pretend individual physical copies have persistent identities.
- **Review changes** expands a revision in place with side-by-side Top views of the saved parent and child snapshots. Unchanged placements stay neutral; removed, modified, and added placements are highlighted separately. The previews use each saved plan’s own storage snapshot and clearance settings, so historical revisions remain visually comparable even if the live storage changes later.
- Saved-plan geometry is converted when you switch between cm, mm, and inches, so plan comparisons remain dimensionally consistent.


## Smart Import workflow

Smart Import is review-first:

1. Paste a public product URL.
2. Storage Fit reads whatever metadata the retailer exposes.
3. Review the detected title, dimensions, price, reference, image, retailer, and source.
4. If the product already exists, choose **Update existing** or deliberately **Add as new**.
5. Fine-tune physical stacking/orientation rules in the normal item editor.

Duplicate matching prefers normalized SKU/article numbers and falls back to canonical product URLs with tracking parameters, URL fragments, and trailing slashes removed. The item library can also be searched by name, SKU, or retailer.

Retailer pages and cross-origin policies can change, so automatic import remains best-effort. The app never adds an imported item until you explicitly confirm it.

## Drawer QR labels

Once a storage space has a chosen plan, its contents can be found again without opening the planner: stick a label on the drawer and scan it.

- **Install queue → Print drawer labels** prints one label for every storage space with a chosen plan, in Room → Furniture → Storage order.
- **Selected layout → Drawer label** prints a label for the layout that is open.

Each label shows the Room → Furniture → Storage path, the plan name, the placement purposes (or the organizer mix when nothing is labelled), and a QR code. Scanning it with a phone camera opens the read-only share viewer for that exact layout, titled with the storage path, in 3D. The link is the same self-contained share link as **Share link**: the plan travels inside the URL fragment and nothing is uploaded. Because the share viewer is cached for offline use, a phone that has opened Storage Fit before can show the layout even without a connection.

QR codes use error-correction level M, which tolerates scuffed stickers, and fall back to level L for long plans when that gives a smaller code. Because share links are compressed, a typical drawer plan fits in a version-10 to version-16 code (57 to 81 modules), which scans well printed about 4 cm wide. A plan whose link is too long for any QR code gets a note to use Export instead.

The encoder (`qr.js`) is written from the QR Code specification with no dependencies. Its tests compare whole symbols, across sizes up to version 40, with the output of an independent encoder.

## Paste manual dimensions

Storage and organizer editors both have **Paste dimensions…** for measurements copied from notes, retailer specs, or a message.

Accepted examples include:

- `81 × 40 × 47 cm`
- `Dimensions (L × W × H): 76 × 38 × 30 cm`
- `Width 38 cm · Depth 76 cm · Height 30 cm`
- `38 cm × 760 mm × 0.3 m`
- `810 × 400 × 470` while the project unit is mm

Explicit units are converted independently into the current project unit, so one compact triplet can mix mm, cm, m, and inches. A single explicit unit still applies to the whole triplet, preserving forms such as `38 × 76 × 30 cm`. If units differ, every value must either declare its own unit or obtain a missing unit from structured metadata; Storage Fit does not guess an ambiguous partial mix. If the pasted triplet has no unit at all, Storage Fit assumes the current project unit. Explicit axis-order labels are honored using the same order-aware parser as Smart Import.

Pasting only fills the Width / Depth / Height form fields. It does not save anything until **Save** is pressed, so the measurements remain review-first.

## Printable measurement worksheet

**Print measurement worksheet** creates a whole-home field sheet from the current Room → Furniture → Storage hierarchy.

For every storage space it shows the currently saved Width × Depth × Height for reference and leaves dedicated blanks to record fresh measured Width / Depth / Height values. Existing blocked-zone and divider counts are included as prompts, with extra note space for rails, hinges, lips, tracks, posts, sloped backs, or other real-world obstructions.

The worksheet is read-only: printing it does not mark measurements as verified or change project data. After measuring, enter or paste the corrected dimensions into the normal storage editor and press **Save**.

## Measurement verification

Each storage editor can be marked **Measured** after you physically check its usable inside Width / Depth / Height and modeled constraints.

Storage Fit records a fingerprint of the physical geometry—not the storage name or room location. The state then behaves as follows:

- **Not measured** — no physical verification has been recorded.
- **Measured** — current dimensions, blocked zones, and dividers still match the verified geometry.
- **Needs recheck** — a physical dimension, blocked-zone geometry, or divider geometry changed after verification.

Renaming a storage, moving it to another piece of furniture, or switching the project between cm / mm / inches does not invalidate measurement verification. Duplicated or structure-synced storage spaces do not inherit another compartment's physical verification.

A stale storage can be physically checked again and **Reconfirm measured**. Current verification can also be cleared explicitly. The printable measurement worksheet shows the same verification state beside each space.

The main workspace also includes **Measurement coverage**. It summarizes current / recheck / not-measured counts for the whole home and lists only unfinished field checks. Rechecks are ordered before never-measured spaces, then sorted by their full Room → Furniture → Storage path. **Open next** jumps directly to the next storage editor without changing any verification state.

Inside the storage editor, **Save measured & next** closes the field-work loop: it saves the visible storage name, furniture, Width / Depth / Height, applies the same constraint clamping as normal **Save**, marks the resulting physical geometry as measured, then opens the next unfinished measurement. If that was the final pending space, the button becomes **Save measured** and stays on the current storage. Width, depth, and height must all be greater than zero before a storage can be verified.

Plain **Save** remains available and does not mark anything measured.

## Voice measuring

Measuring a whole home means holding a tape measure while typing on a phone. **🎙 Measure by voice** in **Measurement coverage** turns the measurement queue into a hands-free walkthrough:

1. Storage Fit opens the first storage still to measure (rechecks first, as in the coverage list) and reads its Room → Furniture → Storage path aloud.
2. Say the inside size, for example “sixty seven by twenty six by thirteen” or “60 wide, 45 deep, 16 high”. The values fill the storage editor and are read back.
3. Say **save** (or yes, ok, oui) to save the dimensions, mark the storage **Measured**, and move to the next one. Say the size again to correct it, **skip** to leave a storage for later, **repeat** to hear the prompt again, or **stop** to end.

Spoken numbers can be digits or words (“eight hundred and ten”, “sixty point five”, “forty and a half”), with “by”, “times” or no separator at all. Unit words (centimetres, millimetres, metres, inches) are converted per value into the project unit; with no unit, the project unit is assumed. Axis words such as width / depth / height or wide / deep / high put each value in its place in any order.

Nothing is saved until you confirm, and the same Save / Skip / Stop actions are on screen if the room is too noisy. Prompts are spoken with listening paused, so the planner never hears itself. Skipped storages stay in the measurement queue.

Voice input uses the browser’s speech recognition, available in Chrome, Edge and Safari; other browsers show a short explanation instead. Some browsers send audio to their speech service to recognise it.

## Home hierarchy

Storage spaces are organized as:

Room → Furniture → Storage space

Examples:

- Bedroom → Wardrobe → Left drawer
- Kitchen → Pantry → Upper shelf
- Entryway → Console → Bottom drawer

The sidebar focuses on one room/furniture context at a time, while the main storage picker can jump directly to any compartment using its full breadcrumb. A furniture-level progress indicator shows how many of its storage spaces already have saved plans.

Existing V17 data migrates automatically into **Home → Unassigned furniture**, so introducing hierarchy does not require manual reassignment. Rooms or furniture that still contain children cannot be deleted until those children are moved or removed.


## Owned inventory and purchase optimization

Each item can store an **Owned quantity** independently from its layout **Max**:

- **Max** limits how many copies the optimizer may place.
- **Owned quantity** says how many copies you already have available for a candidate layout.

The shopping list reports **Use / Own / Buy**, and totals only the additional units that need to be purchased.

The **Cheapest to implement** optimization goal ranks layouts conservatively:

- fewer unpriced units to buy is always preferred;
- when both layouts use the same single currency, known purchase totals are compared directly;
- currencies are never silently converted;
- when currencies differ, the planner falls back to fewer units to buy, then better space utilization.

A saved plan's purchase estimate uses the current item inventory, so if you later buy more organizers the plan can immediately show fewer remaining purchases.

The item catalog also shows a live stock commitment status against actionable chosen plans. For each organizer, Storage Fit distinguishes **owned**, **committed**, **unallocated**, and **short** quantities. Installed plans always count as committed; non-installed chosen plans count only while their saved plan is current, matching the whole-home procurement rules. Stale chosen plans are excluded until they are reviewed and revalidated.

## Whole-home procurement

Each storage space can have one **chosen plan**. Choosing a different plan for the same storage replaces that storage's winner without affecting choices elsewhere.

The **Home shopping list** aggregates every chosen plan, sums each organizer type across rooms/furniture/storage spaces, and applies owned inventory **once globally**. Example: if three chosen compartments need 7 of the same organizer and you own 2, the home project correctly reports **Buy 5**.

The project workspace shows:

- number of chosen storage spaces;
- total organizers required;
- owned units reused;
- total additional purchases by currency;
- one aggregated row per organizer with Use / Own / Buy;
- product links only where more units are needed.

The project list can be exported as `storage-fit-home-shopping.json`. Existing V19 single-choice data migrates automatically into the matching storage's chosen-plan slot in V20.

## Project execution

The home shopping list now has an execution state between “need to buy” and “owned”:

- **Need** is the quantity required after applying existing owned inventory.
- **Purchased** tracks units already ordered or paid for but not yet received.
- **Left** is what still needs to be purchased.
- **Receive purchases** moves all currently marked purchased units into the item's owned inventory in one action.
- Each organizer row has a receipt quantity field plus **Receive ×N** and **Receive all ×N**, so a delivery of any size can be recorded in one action. Partial receipts increase Owned only by the received amount and keep the rest marked Purchased/in transit.
- Purchased rows include a **Preview receipt impact** disclosure. It follows the quantity currently entered in that row, compares it with **Receive all** when useful, and lists the exact storage spaces that would become Ready or Waiting. The preview is read-only and updates immediately as the receipt quantity changes and after every real partial receipt.
- When two or more organizer types are in transit, **Receive a mixed delivery** lets you enter the quantities that physically arrived across multiple rows, preview their combined Ready/Waiting impact, and commit the entire delivery once. Batch quantities are temporary UI state and default to zero.
- The top-level **When purchases arrive** simulation uses the same receipt limits as the real actions. It separates purchased units from receivable units and calls out anything blocked by the 999-unit owned-inventory safety cap instead of treating impossible stock as available.
- Every receipt path—single row, mixed delivery, or receive-all—creates a local recovery checkpoint before mutating purchased/owned inventory.

This distinction prevents in-transit items from being counted as physically available too early. Purchase progress persists across reloads and backups.

When at least one unit is marked purchased, the shopping list also shows a **When purchases arrive** preview before inventory changes. It dry-runs receipt against the current install queue, shows the exact storage spaces that would become Ready or Waiting as earlier plans begin reserving shared stock, and checks whether a different install order could make even more spaces Ready after receipt. The preview never changes owned quantities or install order; **Receive purchases** remains the explicit inventory action, and any better order can be applied afterward with **Find more Ready**.

Project status moves through:

1. items still need to be purchased;
2. all required purchases are marked bought;
3. purchases are received into inventory;
4. the chosen project reports **Ready to install**.

Deleting an item that is still referenced by a saved plan is blocked to avoid silently breaking saved layouts.

V21 migrates V20 automatically and preserves existing chosen plans and owned inventory.


## Installation dashboard

Chosen plans now become an inventory-aware **Install queue**.

Storage Fit allocates physically owned organizers across the queue and labels each chosen storage as:

- **Ready now** — every organizer required by that plan can be allocated from current owned inventory;
- **Waiting for inventory** — at least one required organizer is still unavailable;
- **Installed** — the exact chosen plan has been marked installed.

Queue order matters when several storage spaces compete for limited stock. Moving a storage up or down changes which ready plan receives those organizers first. A waiting plan does not reserve partial inventory, so another fully satisfiable plan may still become ready.

Installed plans reserve the inventory they consume before the rest of the queue is evaluated. Changing the chosen plan for a storage automatically invalidates stale installed status.

Purchased-but-not-received items are intentionally excluded from readiness. They only become installable inventory after **Receive purchases** moves them into Owned quantity.

The home shopping JSON export is version 3 and includes the install queue, order, readiness status, and any missing organizer quantities. V22 migrates V21 automatically and preserves shopping progress, chosen plans, and owned inventory.


## Repeated furniture and compartments

Real furniture often repeats the same geometry, so Storage Fit can now clone structure instead of making you re-enter it.

### Storage spaces

For any selected storage space:

- **Duplicate** creates one fresh structural copy.
- **Repeat…** creates 1–20 additional copies in one action.
- Repeated names are numbered automatically: `Drawer` → `Drawer 2`, `Drawer 3`, etc.
- Existing numeric suffixes continue naturally and preserve padding: `Drawer 07` → `Drawer 08`.

Dimensions, blocked zones, and custom dividers are copied. Every copied constraint receives a new internal ID, so editing a clone never mutates the source.

### Furniture

**Duplicate** on furniture creates a new furniture entry in the same room and copies all of its child storage spaces, including their blocked zones.

Structural clones intentionally start fresh:

- no saved plans are copied;
- no chosen-plan status is copied;
- no shopping/install progress is copied;
- no installed status is copied.

This makes it fast to model repeated wardrobes, kitchen cabinets, drawer units, or matching bedside furniture without falsely marking the new structure as already planned or installed.

### Correct drifted fresh copies

If repeated compartments were copied and one definition is later corrected, **Copy saved structure to N** can push the selected storage's saved physical definition to drifted fresh siblings in the same furniture.

It copies:
- width, depth, and height;
- blocked zones;
- custom dividers.

It preserves each target's:
- storage ID;
- name;
- furniture/location.

The action deliberately skips two groups:
- fresh siblings that already match the source exactly;
- any sibling that has saved plans, a chosen plan, or Installed state.

Protected siblings are never overwritten automatically, even if their geometry differs. A recovery checkpoint is created before the batch update, and the button refuses to copy unsaved dimension edits from the form: save the source storage first so the propagated structure is explicit.

This closes the loop for repeated furniture: **Duplicate / Repeat…** creates fresh copies, structure sync corrects safe drift before planning, and **Apply to matching** can then propagate a finished layout once the compartments are structurally identical.


## Propagate one layout to matching compartments

Repeated compartments can now share one finished layout.

From any generated layout, **Apply to matching** finds fresh sibling storage spaces in the same furniture that have the exact same structural geometry:

- same width, depth, and height;
- same blocked-zone geometry;
- blocked-zone names and internal IDs do not need to match.

The action saves and chooses the current layout for the source storage and every eligible matching sibling in one pass. The copied plans keep the same optimizer settings, stacking mode, and exact placements, while each target gets its own storage snapshot, breadcrumb, plan ID, and signature.

For safety, propagation skips any target that already has saved, chosen, or installed work. Compartments in another piece of furniture are never targeted automatically, even if their dimensions happen to match.

This pairs with **Duplicate** / **Repeat…**: model one drawer, clone the structure, optimize once, then apply the chosen layout to all fresh identical siblings.


## Custom dividers

Not every storage space needs purchased boxes. Storage Fit can now model physical dividers inside a drawer, shelf, or compartment.

For any storage space you can add:

- **Vertical dividers** — run from front to back.
- **Horizontal dividers** — run from left to right.

Each divider has:

- position from the relevant inside edge;
- physical thickness;
- physical height.

Dividers are first-class storage geometry. The optimizer treats them as thin walls, so boxes cannot cross through them. Stacking, fit tolerance, manual editing, leftover-space detection, and usable-space calculations all respect divider geometry automatically.

Views use a separate visual language:

- red hatched shapes = blocked furniture zones such as rails or hinges;
- blue solid shapes = intentional custom dividers.

Dividers are preserved through:

- full backups/restores;
- cm/mm/in unit conversion;
- storage duplication and bulk Repeat…;
- furniture duplication;
- saved-plan storage snapshots;
- structural matching for **Apply to matching**.

Structural propagation requires divider geometry to match too, so a drawer with a divider at 30 cm will not be treated as identical to one with the same divider at 31 cm.

V23 migrates V22 automatically; existing storage spaces simply start with no dividers.


## Placement purposes and contents

A layout can now describe not only **where organizers go**, but **what each individual organizer is for**.

In **Edit layout**:

1. select a placed organizer in Top view;
2. enter a purpose such as `Socks`, `Cables`, `Belts`, or `First aid`;
3. repeat for any other placement, including identical organizer types.

Placement purposes belong to the exact placement, not the catalog item type. Four identical boxes can therefore carry four different purposes.

Purposes are shown in:

- Top view;
- the layout detail panel;
- saved-plan cards;
- side-by-side plan comparison;
- the installation queue;
- printed plan sheets.

They are preserved in:

- saved plans;
- **Apply to matching** propagation;
- plan JSON export;
- full browser backups.

The single-plan JSON export is version 2 and adds an explicit `contents` list while keeping labels on each placement. It also includes custom dividers in the storage snapshot.

Relabeling a placement counts as a real plan change: V24 uses a label-aware saved-plan signature while leaving the optimizer's geometry deduplication unchanged. Existing V23 saved plans migrate automatically with blank labels where none existed.


## Practical handling rules

Some layouts fit mathematically but are awkward to use. Items now support handling rules that distinguish hard physical constraints from soft access preferences.

### Keep floor orientation

**Keep floor orientation** prevents a 90° footprint rotation.

- An upright 30 × 20 × 10 organizer stays 30 × 20 on the floor instead of also trying 20 × 30.
- If the item may tip, each physical attitude still gets one non-rotated footprint.
- The manual Rotate 90° action obeys the same rule.

### Highest stack level

An optional **Highest stack level** limits how high that item itself may be placed.

- Level 1 = floor only.
- Level 2 = floor or directly above one supporting item.
- Level 3 = up to two supporting levels below it.
- Blank = no item-specific level limit.

A blank limit stays blank across reloads, and the limit only applies to items that can sit on another item: unticking **Can sit on another item** clears it, and a leftover value on such an item is not treated as a handling-rule change for saved plans. Level 1 on a stackable item means it never leaves the floor, so the item editor says so instead of letting stacking fail silently.

Older versions saved a limit of 1 for every item after a reload, which quietly kept stackable items on the floor. The first time this version opens a project (or restores an older backup), it clears a limit of 1 from every item that may sit on another item, together with the copies kept in saved plans and distribution work, so those plans stay Current. It does this only once: a limit of 1 chosen afterwards is kept.

This is a hard placement rule and is enforced by both optimizer search and manual editing. It works in addition to **Can sit on another item** and the global **Enable stacking** switch.

### Prefer near the front

**Prefer near the front** is a soft accessibility preference. The inside front edge of a storage space is `Y = 0`.

Front-priority items remain allowed anywhere they physically fit, but layouts placing them closer to the front receive a better access score.

A new **Easiest access** optimization goal makes that score the primary ranking criterion, then falls back to utilization and layout simplicity. The other optimization goals also use access as a secondary tie-breaker when front-priority items are present.

Proposal cards can show **Easy reach** for the best access-scoring variants.

### Search curation

For repeated quantity mixes, Storage Fit now ranks geometry variants before keeping the curated subset. This helps preserve genuinely useful front-loaded arrangements instead of whichever equivalent variants happened to be discovered first.

V25 migrates V24 automatically. Existing items default to:
- floor rotation unlocked;
- no front priority;
- no maximum stack level.


## Saved-plan health and revalidation

Saved plans now remember the physical assumptions they were validated against.

Each saved plan captures:

- storage width, depth and height;
- blocked-zone and divider geometry;
- the dimensions of every organizer used by the layout;
- relevant organizer handling rules such as orientation, stacking, support, access preference and stack-level cap;
- the layout's own clearance, tolerance and upright settings.

Storage Fit continuously compares those snapshots with current data and assigns one of three health states:

- **Current** — nothing relevant changed and the saved layout remains valid.
- **Review** — something changed, but the exact saved layout still physically works. The plan can be **Revalidated** in one click.
- **Invalid** — the saved layout no longer works with current geometry or organizer rules. It must be opened and edited/regenerated before it can be trusted again.

Examples of **Review**:
- a drawer becomes wider without disturbing the layout;
- a front-access preference changes while placements still fit;
- a divider moves in a way that does not touch the saved layout.

Examples of **Invalid**:
- a new hinge/blocked zone overlaps an organizer;
- a storage dimension shrinks past a saved placement;
- an organizer's dimensions change so the saved orientation no longer matches;
- stack/support rules no longer allow a saved stacked placement.

### Safety in execution

A stale non-installed chosen plan is intentionally conservative:

- it does not consume install-queue inventory;
- it cannot be marked installed;
- it is excluded from whole-home shopping quantities/costs;
- the project summary reports that a chosen plan needs review.

This prevents buying organizers or starting installation from outdated assumptions.

Already-installed plans remain recorded as installed. If their source assumptions later change, the install queue shows a warning instead of erasing real-world completion.

Newly choosing a stale saved plan is blocked until it is Current again. A **Review** plan can become Current via **Revalidate**; an **Invalid** plan must be rebuilt or edited.

### Migration and export

V26 migrates V25 automatically. Existing saved plans receive a baseline snapshot from the current storage/item definitions on first V26 load, so they begin Current rather than being falsely flagged.

Whole-home shopping JSON moves to version 4 and includes:

- health state/reasons for every chosen plan;
- count of stale chosen plans;
- install-queue health and reasons.

Full backups preserve validation snapshots and timestamps.


## Local recovery checkpoints

Storage Fit now keeps a small local recovery journal for destructive actions.

Before the app performs a destructive change, it snapshots the entire current planner state. Recovery currently covers:

- restoring a full backup;
- restoring another recovery checkpoint;
- deleting a room;
- deleting furniture;
- deleting a storage space;
- deleting an item;
- deleting a saved plan;
- deleting a blocked zone;
- deleting a custom divider.

The **Data & portability → Recovery** section shows the newest checkpoints first and keeps the latest **8**.

Each checkpoint includes:
- timestamp;
- reason;
- complete planner state;
- storage-space count;
- item count;
- saved-plan count.

### Reversible restores

Restoring a checkpoint first creates a new checkpoint of the current state, then performs the restore. This makes recovery itself reversible.

Recovered state goes through the normal startup migration/normalization path after reload, so an older checkpoint can be restored after future app upgrades.

### Legacy pre-restore recovery

Older versions kept one hidden `*-pre-restore` emergency snapshot. V27 automatically imports any valid legacy snapshot it finds into the visible Recovery journal and removes the old hidden key.

### Local-only by design

Recovery history uses the stable browser key `storage-fit-recovery-v1`, separate from versioned planner state keys. This lets recovery survive future V28/V29 state migrations.

Recovery history is **not** included in manual backup files. Manual backups remain the portability mechanism for moving to another browser/device, while Recovery is for undoing mistakes on the current browser.

V27 migrates V26 automatically; planner data itself is unchanged.


## Manual layout editing 2.0

Top-view editing now supports precise hand-tuning after the optimizer finds a good starting layout.

### Configurable snap + grid

While editing, set a **Snap** step and optionally show a matching visual grid.

Dragging and keyboard movement both use the same snap step. The preference is stored with the planner state.

Snap defaults are unit-aware:

- cm → 0.5 cm
- mm → 5 mm
- in → 0.2 in

Changing units converts the current snap distance along with the rest of the project, so the physical editing resolution stays equivalent.

### Keyboard nudging

Select a placement in Top view and use:

- **Arrow keys** — move one snap step;
- **Shift + Arrow** — move five snap steps.

Every nudge is validated immediately. A move that would cause a collision, leave the usable storage bounds, hit a blocked zone/divider, or break stack support is rejected and reverted.

### Change elevation explicitly

Selected placements now have:

- **Move to floor**
- **Stack on support**

These actions search for the nearest valid destination while preserving the organizer's orientation and purpose label.

**Stack on support** uses the same real stacking rules as the optimizer:

- global stacking must be enabled;
- the selected item must be allowed to sit on another item;
- the support item must allow items above;
- full-footprint support is required;
- maximum stack-level rules still apply;
- moving a support cannot leave dependent items floating.

If no valid destination exists, the existing placement is preserved.

### Consistent editing model

Dragging, keyboard nudging, rotation, duplication, floor moves, and stacking all use the same collision/support validation path. There is no manual-edit loophole around optimizer constraints.

V28 migrates V27 automatically and adds only manual-editor preferences; saved-plan geometry and project data remain compatible.


## Read-only share links

Any selected layout can now be shared without exporting or exposing the rest of the planner.

Use **Share link** from the selected-layout toolbar. Storage Fit copies a URL to the standalone `share.html` viewer.

The shared viewer is intentionally read-only and shows:

- Front, Top, Side, and 3D views;
- storage and usable dimensions;
- utilization;
- organizer mix;
- placement purpose labels;
- blocked zones and custom dividers;
- stacked placement elevation.

### Privacy scope

A share link contains only the selected plan data needed to render that one layout:

- storage geometry;
- usable geometry after clearance;
- physical blocked/divider geometry;
- organizer names used by the layout;
- exact placements and labels;
- unit, optimization label, stacking flag, and utilization.

It does **not** include:

- rooms or other furniture/storage spaces;
- the full item library;
- prices or product URLs;
- owned inventory;
- shopping/purchase progress;
- saved-plan history;
- recovery checkpoints;
- other plans.

The encoded plan is stored in the URL fragment. New links use `#z=...`: the plan's JSON compressed with deflate, which makes links about half as long (a typical drawer plan went from 755 to 397 characters). Older `#p=...` links, which hold the JSON uncompressed, still open. Browsers without the Compression Streams API create `#p=` links; very old browsers that cannot decompress show a message asking to update. URL fragments are handled by the browser and are not included in normal HTTP page requests to the server.

Opening a shared link does not import, overwrite, or write planner data. The standalone viewer never uses `localStorage`.

### Reliability

Share payloads are validated before encoding and again by the viewer. Damaged or malformed links show an error instead of rendering partial data.

To avoid unreliable oversized URLs, Storage Fit limits generated share links to approximately 12,000 characters. Very large plans should use the existing JSON **Export** instead.

CI syntax-checks both `app.js` and the standalone `share.js` viewer.


## Save a picture

**Picture** in the selected-layout toolbar turns the layout into a 1200-pixel-wide PNG for messages or notes: the Room → Furniture → Storage path, dimensions and utilization, the 3D view from the current camera angle, the organizer legend with counts, and the placement purposes. On phones and other browsers that support sharing files, it opens the system share sheet; elsewhere the PNG is downloaded. The picture always uses the light colours, whatever the theme.

## Furniture constraint templates

Blocked zones can now be created from common furniture patterns instead of entering every rectangle manually.

The **Blocked zones** section includes four templates:

### Side runners · pair

Creates mirrored left/right full-depth runner zones.

You enter:
- runner width from each side;
- runner height.

Useful for drawer slides, side rails, or side hardware that consumes usable width.

### Rear obstruction · full width

Creates one full-width blocked strip anchored to the inside back edge.

You enter:
- obstruction depth;
- obstruction height.

Useful for rear pipes, back lips, cable channels, drawer backs, or other full-width rear interference.

### Front lip / track · full width

Creates one full-width blocked strip anchored to the inside front edge.

You enter:
- lip/track depth;
- obstruction height.

Useful for sliding-door tracks, drawer-front hardware, or a raised front lip.

### Corner posts / notches · four

Creates four symmetric corner blocked zones.

You enter:
- corner width;
- corner depth;
- corner height.

Useful when a drawer or cabinet has repeated corner posts, clips, or molded notches.

### Safety and editing

Templates clamp generated dimensions to the selected storage space. For example, each side runner can use at most half the storage width.

Every generated rectangle is a normal blocked zone:
- it receives its own fresh ID;
- it can be renamed or edited immediately;
- it participates in optimizer collision checks;
- it appears in Top / Front / Side / 3D views;
- it survives unit conversion, cloning, backups, and recovery;
- it becomes part of saved-plan structural health, so adding or changing a template can correctly mark an older plan Review or Invalid.

Template defaults are unit-aware:
- cm → 1 cm
- mm → 10 mm
- in → 0.4 in

No state migration is required because templates generate the same blocked-zone records the app already understands.


## Mirror an entire layout

Manual editing now includes two whole-layout transforms:

- **Mirror L↔R** — reflects every placement across the usable storage width.
- **Mirror F↔B** — reflects every placement across the usable storage depth.

The transform preserves:

- organizer type;
- organizer orientation and dimensions;
- elevation / stack level;
- purpose labels;
- item counts.

Only X or Y placement coordinates are reflected.

### All-or-nothing validation

Mirroring never forces an invalid result.

Storage Fit builds the full reflected layout first, then validates it against the current storage:

- usable bounds and fit tolerance;
- blocked zones;
- custom dividers;
- organizer collisions;
- stacking support;
- maximum stack-level rules;
- storage height.

If any mirrored placement is invalid, the entire operation is rejected and the original layout remains untouched.

This is useful when a layout is geometrically symmetric but the real furniture is not: for example, a left/right reflection that would hit one side's hinge or runner simply does not apply.

### Paired furniture workflow

Mirroring pairs naturally with the existing duplication tools:

1. duplicate/repeat matching compartments or furniture;
2. optimize one side;
3. open the layout in **Edit layout**;
4. mirror left↔right or front↔back;
5. save/apply the reflected version where appropriate.

Mirroring is a manual-layout operation only and introduces no new state schema. The app remains on V28.


## Manual edit Undo / Redo

Manual layout editing now has a session-scoped history with **Undo** and **Redo**.

Undo/Redo covers successful changes to the active proposal, including:

- dragging a placement;
- keyboard nudging;
- rotating an organizer;
- moving an organizer to the floor;
- stacking an organizer on a support;
- duplicating or removing an organizer;
- mirroring the whole layout;
- editing a placement purpose label;
- adding an organizer from a leftover-space suggestion;
- resetting the proposal back to its original optimizer result.

### Keyboard shortcuts

While editing and not focused inside a form field:

- **Ctrl/Cmd + Z** — Undo
- **Ctrl/Cmd + Shift + Z** — Redo
- **Ctrl/Cmd + Y** — Redo

The toolbar also has explicit **Undo** / **Redo** buttons.

### History semantics

- one completed drag creates one history step, not one step per pointer movement;
- identical snapshots are ignored;
- invalid/rejected edits never enter history;
- after Undo, making a new edit discards the old Redo branch;
- history is capped at the latest **60** snapshots;
- Reset proposal is itself undoable;
- finishing the edit session clears the temporary history.

The history is deliberately not persisted in backups or planner state. It is an editing-session safety tool; the finished layout remains the normal source of truth.


## Replace an organizer in a manual layout

Manual editing can now swap a selected placement to another item from the organizer library.

The **Replace organizer** picker:

1. keeps the placement's purpose label;
2. tries the target organizer in the exact current position first;
3. tries every orientation allowed by the target item's upright / rotation rules;
4. if the exact spot does not work, searches for the nearest valid floor or stacked position;
5. rejects the replacement if no valid result exists.

Replacement uses the same planner rules as every other edit:

- storage bounds and clearance;
- fit tolerance;
- blocked zones and dividers;
- organizer collisions;
- stacking permission;
- support-surface rules;
- maximum stack level;
- storage height;
- dependent items stacked above the replaced support.

If the target item has a layout **Max** and that quantity is already reached, it is shown as unavailable.

The replacement is one Undo/Redo history step, so the original organizer can be restored immediately.

This is useful when:
- a planned organizer is unavailable;
- you find a cheaper/smaller alternative;
- you want to compare two organizer types without regenerating the whole proposal;
- a support item needs to be changed while preserving the rest of the layout.

No state schema change is required; the app remains on V28.


## Print organizer labels

Placement purposes can now become physical labels for the actual organizers.

From any selected layout, **Print labels** builds an A4 cut-sheet containing one card for every placement that has a purpose label.

Each printed label includes:

- purpose / contents name;
- organizer type;
- placement number;
- organizer dimensions;
- stack elevation when relevant;
- storage-space name.

Only purposeful placements are included. Unlabeled duplicate boxes are intentionally skipped so the sheet stays useful instead of filling with generic labels.

The button is disabled until at least one placement has a purpose label.

Printing uses the existing hidden print surface, so **Print plan** and **Print labels** share the same browser-native print flow without changing project data.

No schema migration is required; the app remains on V28.


## Exact placement coordinates

Manual editing now exposes direct **X / Y / Z** measurements for the selected organizer.

Coordinate meaning:

- **X** — distance from the inside left edge of the usable storage space;
- **Y** — distance from the inside front edge;
- **Z** — elevation above the usable floor.

Typed values are treated as exact measurements rather than being rounded to the editing grid. They are rounded only to six decimal places for numeric stability.

The numeric input arrow steppers use the current manual **Snap** step for convenience, so the same editor can support both:
- exact typed measurements;
- quick snap-sized increments.

### Transactional validation

A coordinate change is tested on a cloned layout first.

It is accepted only if the resulting complete layout still satisfies:

- storage bounds and clearance;
- fit tolerance;
- blocked zones and dividers;
- organizer collisions;
- stacking permission/support;
- maximum stack level;
- dependent stacked items remaining supported.

Invalid coordinates are rejected and the existing layout remains unchanged.

Every successful coordinate change is a normal Undo/Redo history step.

No state schema change is required; the app remains on V28.


## Quick placement alignment

Manual editing now includes a **Quick align** control for the selected organizer.

Available alignments:

- **Left**
- **Horizontal center**
- **Right**
- **Front**
- **Depth center**
- **Back**

Edge alignment uses the current fit tolerance as the inset from the usable storage boundary. Center alignment uses the exact usable-space center.

Alignment changes only X or Y. It preserves:

- organizer type and orientation;
- dimensions;
- Z elevation;
- purpose label.

Like exact-coordinate editing, alignment is transactional. Storage Fit tests the complete candidate layout first against bounds, blocked zones, dividers, collisions, stack support, max stack level, and dependent stacked items.

If the aligned placement would be invalid, nothing changes. Every successful alignment is one Undo/Redo history step.

No state schema change is required; the app remains on V28.


## Mirror storage constraints

Storage geometry can now be mirrored independently of a layout.

The storage editor provides:

- **Mirror constraints L↔R**
- **Mirror constraints F↔B**

The transform mirrors all blocked zones and the relevant custom-divider positions:

- left↔right reflects blocked-zone X coordinates and vertical-divider positions;
- front↔back reflects blocked-zone Y coordinates and horizontal-divider positions;
- divider orientation, thickness and height remain unchanged;
- blocked-zone names, IDs and dimensions remain unchanged.

This is useful after duplicating paired furniture where rails, hinges, lips or notches appear on the opposite side.

Mirroring is applied to the same storage rather than creating new objects, so internal IDs are preserved. Mirroring twice on the same axis restores the original geometry.

A local Recovery checkpoint is created immediately before the transformation.

Because these are normal storage constraints, saved-plan health refreshes immediately: a previously saved plan can become Review or Invalid if the mirrored hardware conflicts with it.

No state schema change is required; the app remains on V28.

## Find compatible storage spaces

The item library now works in both directions.

After selecting an organizer, **Find spaces** checks every storage space in the home and lists the compartments where one copy can physically fit.

The lookup uses the planner’s real geometry rules:

- current wall-clearance setting;
- current fit tolerance;
- global upright setting plus the item’s own tipping/rotation rules;
- blocked zones;
- custom dividers;
- storage height.

Compatible spaces are ranked with the tightest valid geometry first. For each storage, the finder chooses the **most forgiving valid orientation** and shows an explicit **Fit margin**: the smallest remaining dimensional spare after wall clearance and horizontal fit tolerance, plus separate width/depth/height spare. This makes borderline measurement cases visible instead of reducing them to a binary “fits.” Each result also shows the Room → Furniture → Storage breadcrumb, usable dimensions, the chosen orientation, and any modeled constraints.

The same finder now explains **why every non-matching space fails**. If the closest allowed orientation is dimensionally too large, it shows the exact width/depth/height shortfall after the current fit tolerance. If the dimensions fit but blocked zones or dividers leave no legal floor position, it reports that separately. Near-miss rows can open the affected storage directly, so a measurement or modeled constraint can be reviewed instead of guessing from a generic “doesn’t fit.”

Each failure also gets read-only **Would fit if…** simulations when a single change is sufficient. Storage Fit can identify the maximum fit tolerance or wall clearance that would still work, detect when floor rotation or tipping would solve the fit, and name a specific modeled blocked zone/divider whose correction would unblock the space. These are diagnostics only: the finder never changes safety buffers, orientation rules, or furniture constraints automatically.

The item library also has a **Fit audit** for the whole project. It evaluates one copy of every organizer against every storage using the exact same geometry, clearance, fit-tolerance, orientation, blocked-zone and divider rules as **Find spaces**. The matrix distinguishes current fits, actionable near misses with simulated remedies, and hard misses; each organizer row can jump into its full finder, and each matrix cell can open the affected storage. The audit is derived on demand and stores no duplicate project state.

For larger projects, the audit can be focused without recomputing or persisting another model: search organizer names, limit columns to one room, or show only organizers with **no current fit**, a **near miss**, or a **hard miss**. Visible organizer counts and fit/near/miss pair totals are recalculated against the filtered storage scope, so a “no current fit” result in one room does not incorrectly use fits from another room.

The same room/search scope now produces four factual **Audit insights**: the organizer that fits the most visible spaces, the storage with the fewest current organizer fits, how many visible organizers have no current fit, and how many have at least one near-miss remedy. These cards use direct fit counts rather than a hidden score, and their buttons jump into the relevant organizer, storage, or focused audit view.

The item editor also has **Used in plans**. It lists every saved plan that already contains the organizer, shows how many copies each plan uses, marks plans that are currently **Chosen** or **Installed**, and lets you open the exact plan directly. This is especially useful before editing or deleting a library item because you can see its impact across the home instead of getting only a generic dependency warning.

From that list, **Edit layout** opens the saved plan directly in Top-view edit mode with one affected copy already selected. The existing replacement, coordinate, alignment, stacking, labeling, undo/redo and drag controls are immediately available. Storage Fit keeps the current saved-plan behavior: saving an edited layout creates a new saved plan rather than silently overwriting the original, so the existing decision remains available until you deliberately remove it.

**Room in plans** answers a different inventory question: which current saved layouts can accept **one additional copy** of this organizer on the floor? It checks the actual saved placements, the saved plan’s wall-clearance and fit-tolerance settings, and the live storage’s blocked zones/dividers. Stale or invalid saved plans are skipped. **Add copy** opens an editable copy of the plan with the suggested organizer already placed and selected; saving creates a new plan, preserving the original. This search is intentionally floor-only for now, so it does not claim unused stacking capacity.

Each matching plan can also **Calculate extras**. Storage Fit then searches the remaining floor geometry for the maximum number of additional identical copies that fit around the fixed saved placements. Normal cases report an exact maximum; large searches fall back to an explicit **at least N** lower bound. **Add packing** opens an editable copy with the entire suggested extra packing inserted in one step, so it can be adjusted and saved as a new plan without modifying the original.

If the item has **unallocated owned stock**, the same result also enables **Add N owned**. Storage Fit takes only as many placements as can be covered by currently unallocated owned copies, opens them in the editable plan copy, and leaves the remaining capacity untouched. This is a planning action only: it does not decrement Owned quantity or mark inventory as physically moved; stock becomes committed only when the resulting plan is deliberately chosen.

**Room in plans** also checks for one legal **stacked** copy when no floor position is available. A stack suggestion respects the saved plan’s stacking flag, the organizer’s `canBeStacked` / `maxStackLevel` rules, the supporting organizer’s `canSupportStack` rule, fit tolerance, clearance, obstacles/dividers, and the existing support chain. **Add copy** preserves the suggested Z coordinate and opens that stacked placement in the normal manual editor.

For saved plans with stacking enabled, **Calculate extras** now runs a bounded 3D search across both floor and legal stack positions. It reports the best packing as a floor/stack breakdown, calls the result an exact **maximum** only when the search exhausts the space (or reaches a safe usable-volume upper bound), and otherwise reports **at least N** when the node/copy cap is reached. **Add packing** and **Add N owned** preserve the returned Z coordinates and insertion order so stacked copies keep their support chain when opened in the manual editor. Plans without stacking continue to use the established floor-only capacity search.

Each compatible result can also **Calculate capacity**. With stacking off—or for organizers that cannot both stack and support another copy—Storage Fit uses the established floor-packing search. With stacking enabled for a stack-capable/supporting organizer, the same bounded 3D engine used by saved-plan extra capacity searches both floor and legal stack positions. Results show the floor/stack breakdown and only claim an exact maximum when the search proves it; capped searches are labeled **at least N**. Wall clearance, fit tolerance, blocked zones, dividers, allowed orientations, storage height and stack-level rules are all respected.

After capacity is calculated, **Open packing** turns the returned arrangement into a normal Storage Fit layout. It opens directly in the existing layout detail workspace, preserves any Z coordinates and the stacking setting used for the search, and can then be inspected in Top / Front / Side / 3D, manually edited, labeled, printed, exported, shared, or saved as a plan. The detail subtitle distinguishes **Exact floor maximum** from **Exact 3D maximum**, while bounded searches are identified as the best packing found before the search cap.

When a capacity packing uses stacking, Storage Fit also summarizes its **stack structure before opening it**: number of distinct stacks, tallest physical level, and proposed copies per level (for example `2 stacks · tallest level 3 · L1:2 / L2:2 / L3:1`). Saved-plan extra-capacity summaries include existing organizers as support bases when computing physical levels, while the layer counts themselves describe only the proposed additional copies. The same summary remains visible after **Open packing**.

Whole-home capacity also connects to owned inventory. After capacity is calculated, **Open N owned** becomes available when that organizer has unallocated owned stock. Storage Fit opens only a support-safe prefix of the packing, recomputes its floor/stack summary, and labels the detail as **Owned-stock packing: N of M capacity** (or **N of at least M found** for bounded searches). This is planning only: Owned quantity is not decremented and the layout is not automatically saved or chosen.

The same finder can **Plan owned distribution** across all compatible storage spaces. For a storage with a current chosen plan, it calculates only the remaining legal capacity around that chosen layout; for a storage without a chosen plan, it uses empty-space capacity; storages whose chosen plan is stale or invalid are skipped and called out for review. The allocator consolidates unallocated owned copies into the largest safe capacities first (fewest spaces), breaks equal-capacity ties toward tighter fits, and only calls the space count a true minimum when every relevant capacity result is exact. Each allocation can be opened directly: chosen-plan allocations become editable plan revisions, while unplanned-space allocations open as owned-stock capacity packings. The distribution remains a preview and does not reserve or decrement inventory.

Owned distributions are stored as **persistent work sessions** in normal app state/backups. Each allocation is tracked as **Pending**, **Opened**, or **Done**, so leaving the modal to edit one destination does not lose the rest of the plan. Reopening **Find spaces** restores the session and its progress. The session carries a safety fingerprint covering unallocated stock, organizer planning rules, fit/stack settings, storage geometry, and chosen-plan selection/layout/health; if any of those inputs change, the session is shown as **out of date** and its allocation actions are disabled until recalculation. Marking an allocation Done is workflow progress only—it does not decrement inventory or choose/save a plan.

**Open space** jumps directly to that compartment so planning can continue without hunting through the hierarchy.

The lookup intentionally answers a structural question: whether the organizer fits the storage geometry when empty. It does not treat unused area inside an existing saved layout as available space. Leftover-space suggestions remain the right tool for filling gaps inside a particular layout.

No state migration is required; the app remains on V28.

## Room progress overview

The workspace now includes a derived **Room progress** overview for whole-home projects.

Each room rolls its storage spaces into mutually exclusive execution states:

- **Plan** — no current saved plan exists yet.
- **Choose** — a current saved plan exists but no project plan is chosen.
- **Review** — the chosen plan is no longer current and needs revalidation, repair, or replacement.
- **Waiting** — the chosen plan is current but owned inventory is insufficient for that storage's install allocation.
- **Ready** — the chosen plan can be installed with currently available owned inventory.
- **Installed** — the chosen plan is marked installed.

The overview shows current-plan, chosen-plan, and installed counts per room plus a completion bar and state chips. **Focus room** selects the first unfinished storage in that room and brings it into the normal planning workspace.

For rooms in **Waiting**, the card also explains the current per-storage blockers using the same missing-item data as the install allocator, for example **Current install blockers: Left drawer — SOCKERBIT ×1 · Top shelf — divider ×1**. The quantities stay attached to each waiting storage instead of being summed into a room shopping total, because the install allocator commits inventory only to whole ready plans and a summed deficit could be misleading.

**Shopping / receiving** jumps to the first affected organizer in the whole-home shopping list. The wording is intentionally inventory-based rather than assuming every blocker still needs to be purchased: an organizer already marked purchased remains unavailable to installation until it is physically received.

Each room card also has an expandable **Show all N storage spaces** queue. The queue uses the same room priority order and gives every storage space its real next action:
- invalid chosen plan → **Repair**;
- reviewable chosen plan → **Revalidate**;
- current saved option without a chosen plan → **Choose plan**;
- unplanned storage → **Plan**;
- ready storage → **Install**;
- waiting storage → **View blocker** in Shopping / receiving;
- installed storage → **View installed**.

The queue reuses the existing saved-plan, planning, shopping, and install workflows. It is not a second task system and stores no completion state of its own.

When a room has waiting install work and its active entries are not already first in the global install order, the card also offers **Prioritize room**. Install order is the allocator’s tie-breaker for shared owned inventory: the action moves that room’s unfinished **Ready/Waiting** entries ahead of other unfinished active entries while preserving the positions of **Installed** and **Needs review** entries.

This can intentionally make more of the selected room ready at the expense of another room when both compete for the same owned organizer. The confirmation calls this out explicitly. It does **not** change plans, owned quantities, purchased quantities, or Installed status; it only changes `installOrder`, and the existing per-storage ↑/↓ controls remain available for manual adjustment.

Before the reorder is applied, Room progress now dry-runs the same install allocator against the proposed room-first order. The card shows a compact **Priority preview** such as **+1 Ready · 1 other space would wait**. The confirmation expands that into the exact hierarchy paths that would change from Waiting → Ready and Ready → Waiting. If order changes but the available stock already covers every active space, the preview explicitly reports that no readiness status would change.

The global Install queue’s ↑/↓ controls now use that same dry-run path. If an adjacent move would change any Ready/Waiting allocation, Storage Fit lists the exact spaces that would gain or lose readiness and asks for confirmation before saving the new order. If the move has no readiness effect, it remains a one-click reorder with no extra prompt.

The Install queue also offers **Find more Ready** when at least one active space is waiting. It searches alternative orders against the same owned-stock allocator, looking for an order that makes more unfinished storage spaces Ready without changing plans or inventory. Installed and Needs-review positions remain fixed; only active Ready/Waiting entries move.

For small/currently tractable sets the search is exhaustive, so a no-improvement result means no install order can make more spaces Ready with the current owned stock. The search has a responsiveness cap for larger projects; if that cap is hit, the UI says so and offers only the best better order found before the limit. Any proposed order is still previewed through the allocator and requires confirmation before it is saved.

When reordering alone cannot answer the inventory question, **Analyze stock** runs a second dry-run: it tests adding **one owned unit** of each genuinely scarce organizer type, reruns the install-order search, and keeps only item changes that increase the best Ready count found. Results show **+1 organizer → +N Ready**, whether that organizer is already marked purchased or still needs sourcing, and a direct **Shopping / receiving** jump.

This analysis is informational only. It never increments owned stock, marks an item purchased, changes install order, or claims that an item must be bought. A purchased organizer still counts as unavailable until it is physically received. Exact/capped search status is shown, and very large item sets are bounded with an explicit candidate-count notice.

If no **+1 organizer** change helps, the analysis now searches small multi-unit bundles as well. It starts at two added units and checks increasing total bundle sizes, so an uncapped exact result can report the **Smallest unlock bundle**. Examples include **+2 of one organizer** or **+1 Alpha +1 Beta** when neither single-unit change works alone.

The bundle search is intentionally bounded for responsiveness: by default it considers up to 8 scarce organizer types, up to 4 added units total, and up to 350 bundle scenarios. When those limits are hit, the UI says **Smallest bundle found** rather than claiming a global minimum, and reports the checked scope. Each bundle component keeps its own already-purchased vs still-to-source context and links back to Shopping / receiving.

Every useful one-unit or bundle result also has a **Show impact** disclosure. It compares the suggested hypothetical allocation with the best allocation achievable from current owned stock, lists the exact storage paths that would become Ready, and calls out any baseline-Ready storage that would become Waiting under the new best allocation. This is still a preview only: it does not receive stock or change install priority.

This also tightens the existing Home structure progress semantics: a storage counts as planned only when it has a **current usable saved plan** (or is already installed). Historical stale/invalid plans no longer inflate the planned count, and storage rows explicitly show **saved plan needs review** when appropriate.

The overview is fully derived from the existing plan, inventory, and install state. No new persistent room-status data or schema migration is required; the app remains on V28.

## Project next actions

The workspace now starts with a whole-home **Project next actions** coordinator. It reads the existing project state and ranks the work that can move the home forward without creating a second workflow system.

The priority order is:

1. invalid chosen plans that must be repaired, replaced, or unchosen;
2. chosen plans that still fit but need revalidation;
3. stale owned-stock distribution sessions;
4. current distribution sessions that are still in progress;
5. storage spaces with current saved options but no chosen plan;
6. storage spaces that still need a current plan;
7. purchased organizers waiting to be physically received;
8. remaining shopping;
9. chosen storage spaces that are ready to install.

Location-specific actions show the exact **Room → Furniture → Storage space** path for the first target and choose that first target deterministically by hierarchy path instead of incidental array order. Distribution actions also include the organizer name and first assigned destination.

Each action routes into the existing source-of-truth workflow: the affected saved-plan card, distribution session, Build a layout, shopping list, or install queue. **Revalidate** actions now land on the saved-plan card where the Revalidate control actually exists; invalid plans land on the same card so they can be opened, replaced, unchosen, or deleted. The coordinator itself does not choose plans, receive stock, buy items, or mark installations automatically.

When a priority category contains more than one target, the card also exposes an expandable **Show all N targets** queue. Every target keeps the same deterministic hierarchy ordering and has its own **Open** action, so the user can jump directly to any affected storage space, saved plan, install target, or distribution session instead of working through only the first item. The drill-down is UI-only and does not add persisted task state.

When every storage space has an installed chosen plan and no higher-priority work remains, the coordinator shows **Project complete**.

No schema migration is required; the app remains on V28.

## Printable project checklist

The **Project next actions** header also has **Print project checklist** for taking the whole-home plan away from the screen.

The print sheet is derived from the same live project state and includes:

- whole-home installed, chosen, and current-plan totals;
- one room section with every storage space in its normal priority order;
- the current storage status: Plan, Choose, Review/Repair, Waiting, Ready, Chosen, or Installed;
- the exact next action already used by the on-screen workflow;
- per-storage missing organizers for Waiting spaces;
- a Shopping / receiving table with global **Need / Purchased / Left** quantities after owned inventory is applied once across the project.

Installed rows print with a check mark; unfinished rows print with an empty checkbox so the sheet can double as a physical walkthrough checklist.

The printable view does not create or persist separate task state. Reprint it at any time to reflect the current saved plans, health, shopping progress, owned inventory, install allocation, and room status.

No schema migration is required; the app remains on V28.

## Whole-home distribution work dashboard

Persistent owned-stock distribution sessions are also surfaced in a whole-home **Distribution work** dashboard.

The dashboard gathers every organizer with a saved distribution session and shows:

- Pending / Opened / Done allocation progress across all sessions.
- Completed owned-copy counts versus the copies assigned by each distribution plan.
- **Out of date** sessions using the same safety fingerprint as the organizer-level **Find spaces** workflow.
- A direct **Resume** action that selects the organizer and reopens **Find spaces** with the saved session intact.
- The actual destination allocations inline, including assigned quantity, destination path, chosen-plan vs unplanned source, capacity certainty, and Pending / Opened / Done status.
- Direct **Open N here**, **Apply to project**, and **Mark done / Undo done** actions for current sessions, using the same underlying distribution data as the organizer-level workflow.
- **Review & recalculate** for stale work and **Review** for completed work.
- **Clear session** for removing workflow progress without changing owned inventory, saved plans, or chosen plans.

Sessions are ordered so stale work appears first, followed by in-progress, not-started, and completed work. Stale allocations remain visible for context but their direct actions are disabled until recalculation.

### Recalculate remaining work

Applying one distribution destination can legitimately change owned-stock commitments or the chosen plan for that storage. That makes the old safety fingerprint stale, but it no longer forces the entire workflow back to zero.

**Recalculate remaining** builds a fresh distribution from the current unallocated stock and current storage/plan state, then carries **Opened** or **Done** progress only onto allocations whose actual work is unchanged:

- same storage;
- same chosen-vs-unplanned source;
- same chosen plan when applicable;
- same assigned quantity;
- same assigned placement geometry.

Changed work returns to **Pending**. Unchanged destinations keep their progress. Allocations already absorbed by a newly chosen plan naturally disappear from the remaining-work calculation instead of being assigned again.

If no owned copies remain unallocated, **Finish distribution** closes the remaining-work session instead of leaving a permanently stale card.

### Apply an allocation to the project

A current allocation can also be committed directly with **Apply to project**.

For a destination that already has a chosen plan, Storage Fit creates a saved revision containing the exact assigned packing, preserves the source plan's settings and lineage, validates the resulting full layout, and makes that revision the chosen plan.

For an unplanned storage space, it creates a new saved plan from the exact assigned packing, validates it against the live storage, and chooses it.

The action goes through the normal chosen-plan and install-state rules. If it changes the physical layout of a storage that was marked installed, that storage is no longer treated as installed. After the new plan is chosen, Storage Fit immediately recalculates the distribution against the newly committed stock, preserving unchanged progress and removing the session entirely if no owned stock remains unallocated.

**Open N here** remains available when the packing should be inspected or manually adjusted before committing it.

### Apply the full distribution

When a current session has more than one destination, **Apply all N** can commit the whole distribution in one operation.

Before changing the project, Storage Fit prevalidates every destination:
- every allocation must still produce a valid live layout;
- each destination storage may appear only once;
- the total assigned copies may not exceed the organizer's currently unallocated owned stock.

If any destination fails preflight, no distribution plans are applied. If preflight succeeds, Storage Fit creates/chooses each validated plan, using the same lineage/settings and install-state rules as the individual action. A recovery checkpoint is created before the multi-space change.

After the batch is committed, remaining owned stock is recalculated exactly like the individual **Apply to project** flow. If all owned copies are now committed, the distribution session closes.

The dashboard does not create a second inventory system: **Done** is still workflow progress only. Inventory becomes committed only when a plan is chosen, including through **Apply to project** or **Apply all**.

No schema migration is required; the app remains on V28.

## Diversified layout search

**Find arrangements** explores placements depth-first and stops at a cap to keep the browser responsive. On its own, a capped depth-first search only varies the last few placements of the first arrangement it builds, so whole quantity mixes are never reached. For the default shelf (81 × 40 × 27 cm) with the three default boxes, that meant a top proposal of 94.4% floor use while a plain 4 × 3 grid of twelve small boxes (96.3%) was never proposed.

When the first pass is capped, Storage Fit now runs short extra passes in which each selected item type leads in turn, in both orders and with both floor orientations tried first. Their layouts are added to the first pass's results, never substituted for them, and a search that completes on its own runs no extra pass, so uncapped results are exactly what they were. The result message reports how many alternative item priorities were searched.

Variants of one quantity mix are also curated differently:

- when variants tie on the optimization goal, the most aligned arrangement (fewest distinct cut lines) is listed first;
- a variant is kept only if at least a third of its placements (and at least two) sit somewhere clearly different from every variant already kept. The same box, turned the same way and shifted by less than about a third of its size, counts as the same place, so near-copies that nudge a box or slide a row no longer fill the gallery.

The search remains deterministic, and Max quantities, blocked zones, dividers, fit tolerance and stacking rules apply to every pass.

## 3D view and assembly playback

The **3D** tab draws the storage as a solid, shaded scene instead of a see-through sketch:

- organizers are opaque boxes painted back to front, so nearer boxes hide what is behind them;
- the two far walls are drawn and the two near walls are left open, like a cut-away;
- blocked zones stay translucent red and dividers translucent blue;
- each organizer is named on its top face when that spot is visible, and the usable width, depth and height are captioned beside the drawing, with the front edge marked **Front**.

The camera is orthographic and is not mirrored: seen from the front, the storage's left is on your left and its front edge is nearest to you, which matches standing at the open drawer or shelf. Drag to turn it; the storage follows the pointer. **Reset view** returns to the default three-quarter view from the front right.

**▶ Assemble** plays the layout being loaded one organizer at a time: supports before the items stacked on them, and the back of each level before its front. A caption gives the current step with the organizer's distance from the left and from the front, and its height when stacked. Playback respects the reduced-motion preference by placing each organizer without the drop.

The renderer lives in `view3d.js` and is shared with the read-only share viewer, whose 3D tab can now be turned the same way.

## Printable custom bins

When a leftover rectangle is at least 3 cm on both sides, its card offers **Custom bin**. This creates a made-to-measure organizer that fills the rectangle and stands as tall as the tallest organizer already in the layout (limited by the usable height), adds it to the item library, and places it in the layout in edit mode. It is a normal item afterwards: it can be renamed, priced, saved in plans and listed in shopping.

The item editor has **Print file (STL)** for the selected item. It downloads a binary STL of an open-top bin with the item's outer Width × Depth × Height, converted to millimetres, with 1.6 mm walls and a 1.2 mm floor. The mesh is a closed, outward-facing surface, ready for a slicer. Items too small to leave a cavity are not exported.
