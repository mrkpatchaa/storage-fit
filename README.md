# Storage Fit

Storage Fit is a dependency-free browser tool for planning boxes and organizers inside drawers, shelves and cupboards.

## What it does

- Models your home as Room → Furniture → Storage space, while keeping reusable items in one shared library.
- Supports opt-in true 3D stacking with per-item rules: stay upright, may sit on another item, and may support items above.
- Generates practical maximal layouts with different optimization goals.
- Shows front, top, side and draggable 3D views.
- Lets you drag, rotate, duplicate and remove items in a layout.
- Models blocked zones such as rails, hinges and unusable corners.
- Detects leftover rectangles and suggests saved items that fit them.
- Imports public IKEA/product URLs when product metadata is available, previews the result before saving, and detects existing catalog items by SKU or canonical product URL.
- Finds every storage space where a selected organizer can physically fit, using the same clearance, orientation, obstacle and divider rules as the planner.
- Saves plans, builds inventory-aware shopping lists, prints/exports layouts, and backs up/restores all browser data.
- Turns saved plans into a shortlist: rename them, add notes, mark a chosen plan, and compare up to three side-by-side.

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

The smoke suite loads the real application through a test-only API and checks IKEA measurement parsing, article-number extraction, unit conversion, URL sanitization, backup validation, 3D collision detection, and full-footprint stack support. It snapshots and restores localStorage so the test page does not replace your planner data.

## Data and backups

Application state lives in browser localStorage. Use Data & portability → Backup all data before changing browser, device or deployment origin.

A plan export is different from a full backup:

- Plan export contains one selected layout and its exact placements.
- Full backup contains the complete application state.

## Smart product import

Product import runs in the browser. It first tries the public product page and can fall back to the public r.jina.ai reader when direct cross-origin access is blocked. Retailer markup and access policies can change, so imported dimensions should always be reviewed before purchasing.

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
- The family view can also promote any Current family member directly to **Chosen**. If another family member is already marked Installed, Storage Fit warns before switching and clears the old Installed marker so the revised physical plan returns to the installation queue.
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

This distinction prevents in-transit items from being counted as physically available too early. Purchase progress persists across reloads and backups.

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

Dimensions and blocked zones are copied. Every blocked zone receives a new internal ID, so editing a clone never mutates the source.

### Furniture

**Duplicate** on furniture creates a new furniture entry in the same room and copies all of its child storage spaces, including their blocked zones.

Structural clones intentionally start fresh:

- no saved plans are copied;
- no chosen-plan status is copied;
- no shopping/install progress is copied;
- no installed status is copied.

This makes it fast to model repeated wardrobes, kitchen cabinets, drawer units, or matching bedside furniture without falsely marking the new structure as already planned or installed.


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

The encoded plan is stored in the URL fragment (`#p=...`). URL fragments are handled by the browser and are not included in normal HTTP page requests to the server.

Opening a shared link does not import, overwrite, or write planner data. The standalone viewer never uses `localStorage`.

### Reliability

Share payloads are validated before encoding and again by the viewer. Damaged or malformed links show an error instead of rendering partial data.

To avoid unreliable oversized URLs, Storage Fit limits generated share links to approximately 12,000 characters. Very large plans should use the existing JSON **Export** instead.

CI syntax-checks both `app.js` and the standalone `share.js` viewer.


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

Compatible spaces are ranked with the tightest valid geometry first. Each result shows the Room → Furniture → Storage breadcrumb, usable dimensions, the orientation that fits, and any modeled constraints.

The item editor also has **Used in plans**. It lists every saved plan that already contains the organizer, shows how many copies each plan uses, marks plans that are currently **Chosen** or **Installed**, and lets you open the exact plan directly. This is especially useful before editing or deleting a library item because you can see its impact across the home instead of getting only a generic dependency warning.

From that list, **Edit layout** opens the saved plan directly in Top-view edit mode with one affected copy already selected. The existing replacement, coordinate, alignment, stacking, labeling, undo/redo and drag controls are immediately available. Storage Fit keeps the current saved-plan behavior: saving an edited layout creates a new saved plan rather than silently overwriting the original, so the existing decision remains available until you deliberately remove it.

**Room in plans** answers a different inventory question: which current saved layouts can accept **one additional copy** of this organizer on the floor? It checks the actual saved placements, the saved plan’s wall-clearance and fit-tolerance settings, and the live storage’s blocked zones/dividers. Stale or invalid saved plans are skipped. **Add copy** opens an editable copy of the plan with the suggested organizer already placed and selected; saving creates a new plan, preserving the original. This search is intentionally floor-only for now, so it does not claim unused stacking capacity.

Each matching plan can also **Calculate extras**. Storage Fit then searches the remaining floor geometry for the maximum number of additional identical copies that fit around the fixed saved placements. Normal cases report an exact maximum; large searches fall back to an explicit **at least N** lower bound. **Add packing** opens an editable copy with the entire suggested extra packing inserted in one step, so it can be adjusted and saved as a new plan without modifying the original.

If the item has **unallocated owned stock**, the same result also enables **Add N owned**. Storage Fit takes only as many placements as can be covered by currently unallocated owned copies, opens them in the editable plan copy, and leaves the remaining capacity untouched. This is a planning action only: it does not decrement Owned quantity or mark inventory as physically moved; stock becomes committed only when the resulting plan is deliberately chosen.

Each compatible result can also **Calculate capacity**. Storage Fit searches for the maximum number of identical copies that can sit on the storage floor while respecting the same wall clearance, fit tolerance, blocked zones, dividers and allowed orientations. Capacity is calculated on demand so opening the whole-home finder stays fast. The search is bounded for browser responsiveness; normal cases report an exact maximum, while unusually large/dense cases are labeled as **at least N** rather than pretending an incomplete search is exact.

After capacity is calculated, **Open packing** turns the returned arrangement into a normal Storage Fit layout. It opens directly in the existing layout detail workspace, so the packing can be inspected in Top / Front / Side / 3D, manually edited, labeled, printed, exported, shared, or saved as a plan. Exact-capacity results are identified as an exact floor maximum; bounded searches are identified as the best packing found before the search cap.

**Open space** jumps directly to that compartment so planning can continue without hunting through the hierarchy.

The lookup intentionally answers a structural question: whether the organizer fits the storage geometry when empty. It does not treat unused area inside an existing saved layout as available space. Leftover-space suggestions remain the right tool for filling gaps inside a particular layout.

No state migration is required; the app remains on V28.

