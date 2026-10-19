# Print/Cut Direct

A deterministic Bun + TypeScript production utility that controls VectorCraft
directly over VectorCraft's localhost JSON control channel.

**No Claude, LLM, or MCP client is used while processing a production job.**

```text
artwork files
     |
     v
Bun / TypeScript
  - filename dimensions
  - operator questions
  - bleed geometry
  - MaxRects nesting
  - panel splitting
  - registration geometry
     |
     v
manifest.json
     |
     v
VectorCraft JSON control channel
     |
     +--> PRINT PDF
     |
     +--> CUT PDF
```

## Output rules

For every panel, PRINT and CUT are exported from the same VectorCraft master
document.

### PRINT PDF

Visible:

- artwork on the `Print` layer
- registration marks on the `Registration` layer

Hidden:

- cut paths

### CUT PDF

Present:

- rectangular cut paths on the `Cut` layer
- the exact same marks on the `Registration` layer

**Absent entirely:** the `Print` layer and artwork, which are deleted from the
working document after the PRINT export and before the CUT export. The empty
starter `Layer 1` is deleted before either export.

For the PRINT PDF the `Cut` layer is hidden, not deleted. When `createLayers` is
true it can appear as a hidden optional-content layer; confirm with your RIP.

## Production defaults

The defaults can be changed in `config.json`.

- final PDF width: 48 in
- bleed: 0.125 in
- item gap: 0.5 in
- allow 90-degree rotation: yes
- registration circle diameter: 0.25 in
- registration offset from outer artwork: 0.25 in
- additional long-layout marks after 48 in
- additional mark spacing: 42 in
- cut stroke: 1 pt, CMYK 0/100/100/0

The operator is asked for maximum PDF width, maximum PDF length, bleed and
rotation for every batch.

The width and length limits are for the complete exported page, including the
registration marks.

## Bleed behavior

Filename/manual dimensions mean the FINISHED CUT size.

Example:

```text
logo_12x18.png
bleed = 0.125 in
```

Geometry:

```text
cut rectangle     = 12 x 18 in
artwork bleed box = 12.25 x 18.25 in
```

The renderer preserves source aspect ratio. To manufacture bleed from artwork
that does not already extend beyond the trim, it proportionally scales the
placed image to cover the bleed box and clips it to that box. It never
non-proportionally stretches the image.

## Filename dimensions

Supported examples:

```text
logo_12x18.png
logo_12.5x24.25.jpg
SampleB_35inch_26.25inch.png
sign 24 x 36 inches.pdf
```

If dimensions are missing, the operator is prompted. Detected dimensions can
also be overridden.

## Supported inbox extensions

The scanner currently accepts:

```text
PDF
PNG
JPG / JPEG
TIFF
BMP
GIF
WebP
SVG / SVGZ
AI
EPS
EMF / WMF
```

Whether an individual file imports faithfully is ultimately determined by the
installed VectorCraft build.

Phase 1 treats a PDF/AI source as page 1. Automatic multi-page expansion is not
included yet.

---

# Installation

## 1. Extract the project

Recommended location:

```text
D:\src\print-cut-direct
```

Open PowerShell in that directory.

## 2. Create the production workspace

Run these as TWO commands:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

then:

```powershell
.\scripts\setup-workspace.ps1
```

This creates:

```text
D:\PrintCut\
├── inbox\
├── jobs\
├── output\
├── archive\
├── error\
└── logs\
```

## 3. Install Bun dependencies

```powershell
bun install
```

There are no third-party runtime dependencies. The packages are TypeScript/Bun
development typings only.

## 4. Run the pure layout self-test

Before connecting to VectorCraft:

```powershell
bun run selftest
```

Expected:

```text
SELFTEST PASS
Generated 1 panel pair(s): 44.36" x 87"
```

This fixture reproduces the three-item 48 x 96-inch layout we already validated,
including 0.125-inch bleed and 0.25-inch registration marks.

## 5. Create your configuration

```powershell
Copy-Item .\config.example.json .\config.json
```

Open:

```text
config.json
```

The most important setting is:

```json
"vectorcraftExe": "C:/Program Files/VectorCraft/vectorcraft.exe"
```

Using forward slashes in JSON avoids Windows backslash escaping mistakes.

Verify the executable:

```powershell
Test-Path "C:\Program Files\VectorCraft\vectorcraft.exe"
```

If it is elsewhere:

```powershell
Get-ChildItem "C:\Program Files" `
  -Recurse `
  -Filter "vectorcraft.exe" `
  -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty FullName
```

---

# VectorCraft direct-control doctor

Run:

```powershell
bun run doctor
```

The script will:

1. try to connect to `127.0.0.1:7979`
2. launch VectorCraft with `--control 7979` if nothing is listening
3. restrict VectorCraft reads/writes to `D:\PrintCut`
4. query `ui.inspect`
5. query the live `engine.commands` registry
6. verify every engine command required by this project
7. print the live parameter documentation for those commands

It does not modify artwork.

If VectorCraft is already open normally and the script cannot start a control
session, close VectorCraft and run `bun run doctor` again.

You can also start VectorCraft manually:

```powershell
& "C:\Program Files\VectorCraft\vectorcraft.exe" `
  --control 7979 `
  --automation-read-root "D:\PrintCut" `
  --automation-write-root "D:\PrintCut"
```

Then `bun run doctor` will attach to that session.

---

# Recommended production workflow

## Step A — drop artwork

Put the files for ONE batch in:

```text
D:\PrintCut\inbox
```

Example:

```text
A_12x18.png
B_18x24.jpg
SampleB_35inch_26.25inch.png
```

## Step B — plan only

```powershell
bun run plan
```

The program asks for:

- batch name
- maximum FINAL PDF width
- maximum FINAL PDF length
- bleed
- whether 90-degree nesting rotation is allowed
- confirmation/override of filename dimensions
- manual dimensions where needed
- number of copies of each file (`Enter` means 1; type `0` explicitly to skip)

It creates:

```text
D:\PrintCut\jobs\<batch>\manifest.json
```

**No VectorCraft artwork is created in PLAN mode.**

Review the manifest. It is the immutable geometry recipe for rendering.

## Step C — render the exact approved manifest

```powershell
bun run render Test1
```

Replace `Test1` with the batch ID.

This is deliberately separate from planning. VectorCraft consumes the exact
manifest you reviewed; it does not repack or ask the geometry questions again.

On success:

```text
D:\PrintCut\output\Test1\
├── Test1_P01_PRINT.pdf
└── Test1_P01_CUT.pdf
```

If the maximum length forces multiple panels:

```text
Test1_P01_PRINT.pdf
Test1_P01_CUT.pdf
Test1_P02_PRINT.pdf
Test1_P02_CUT.pdf
...
```

After every required output has been verified as non-empty, the source artwork
is moved to:

```text
D:\PrintCut\archive\Test1\
```

## Step D — combined mode

Once PLAN + RENDER is proven reliable:

```powershell
bun run process
```

That performs planning and immediately renders the resulting manifest.

## Step E — drop-folder mode

Once normal processing is proven:

```powershell
bun run watch
```

The watcher waits until inbox files stop changing before beginning the batch.
It still asks the production questions interactively.

---

# Nesting

The project uses a deterministic multi-start MaxRects search.

It tries four placement heuristics:

- Best Short Side Fit
- Best Area Fit
- Best Long Side Fit
- Bottom-Left

against five input orders:

- area
- largest side
- width
- height
- perimeter

The best result is chosen by:

1. fewest output panels
2. least occupied rectangular area
3. least combined used length

It is not a mathematical proof of globally optimal 2D packing, but it provides
a strong production-oriented result at very low computational cost.

---

# VectorCraft rendering details

For every page the script:

1. creates one CMYK VectorCraft document at the exact manifest page size
2. identifies the empty starter `Layer 1`, creates the `Print`, `Cut`, and `Registration` layers, then deletes `Layer 1`
3. places each requested copy on `Print`, using the same original source file
4. scales it proportionally to cover its exact bleed box
5. clips it to that bleed box
6. applies the manifest's 90-degree rotation when required
7. draws one exact rectangular trim/cut path per copy on `Cut`
8. draws 0.25-inch solid 100K circles on `Registration`
9. hides `Cut`, verifies there are exactly `Print`, `Cut`, and `Registration` layers, then exports PRINT
10. **deletes** `Print` and its artwork, enables `Cut`, and verifies that exactly `Cut` and `Registration` remain
11. exports CUT from the modified document, retaining identical cut and registration coordinates
12. waits for each PDF to finish writing
13. closes the unsaved temporary VectorCraft document

The script validates the manifest again before any rendering begins.

It refuses to overwrite existing production output.

---

# First acceptance test

Use three simple files:

```text
A_12x18.png
B_18x24.jpg
C_8x10.png
```

Run:

```powershell
bun run plan
```

Suggested values:

```text
batch: DirectTest1
max width: 48
max length: 60
bleed: 0.125
rotation: yes
```

Review:

```text
D:\PrintCut\jobs\DirectTest1\manifest.json
```

Then:

```powershell
bun run render DirectTest1
```

Verify the two PDFs in production software by overlaying them.

Check:

- physical page dimensions are identical
- registration circles are exactly 0.25 in
- registration mark coordinates match perfectly
- cut rectangles equal requested finished dimensions
- artwork extends by the requested bleed
- PRINT has no visible cut lines
- CUT has no artwork imagery
- split page pairs remain synchronized

---

# Important safety characteristics

- VectorCraft listens only on the configured localhost control port.
- The launched VectorCraft process is given explicit automation read/write roots.
- Source artwork is never saved over.
- Geometry comes from TypeScript, not an AI decision.
- A reviewed `manifest.json` can be rendered later without re-answering questions.
- Existing production PDFs are never silently overwritten.
- Inputs are archived only after every expected output exists and is non-empty.

See `SPEC.md` for the authoritative Phase 1 requirements.

## Version 0.3 — Explicit default quantity and clean CUT exports

- The quantity prompt visibly defaults to `[1]`. Pressing **Enter** yields exactly one copy.
- Typing `0` explicitly skips the input; invalid, fractional, or out-of-range quantities prompt again.
- `layer.delete {ids}` removes the empty original `Layer 1` **before both exports**.
- After the PRINT PDF is written, the renderer **deletes the Print layer and its artwork** before exporting CUT.
- Immediately before exports the renderer checks the live VectorCraft layer tree and refuses an unsafe structure:
  - PRINT document: `Registration`, `Print`, `Cut` (Cut hidden)
  - CUT document: `Registration`, `Cut` only
- The CUT PDF should contain no Print layer even when PDF layer preservation is enabled.
- New self-tests cover blank-quantity behavior and a mock VectorCraft layer-deletion lifecycle.

**Important:** this version requires VectorCraft's `layer.delete` command; `bun run doctor`
checks its availability. The self-test validates command sequencing locally, but the final
PDF layer contents still need to be visually verified on your VectorCraft installation.

## Version 0.2 — Quantity and named layers

- Each input prompts for a **number of copies**, default `1`; use `0` to skip.
- Every copy has a unique `id` and `copyIndex` in the manifest and gets its own cut path.
- Copies enter MaxRects independently and can rotate separately to save material.
- The VectorCraft master document uses exact layer names: `Registration`, `Print`, `Cut`.
- `config.json` now has:

```json
"pdf": { "createLayers": true, "preserveEditing": false }
```

VectorCraft's PDF exporter supports layer-aware output, but this must be
checked in the resulting PDFs and against your RIP/cutter. As of v0.3.1, the
renderer physically deletes the Print layer before CUT export; it is no longer
only hidden. If your cutter needs a flat PDF, set `"createLayers": false`.

Use a fresh batch name for each upgrade test to avoid overwriting prior
output and manifests.

Files assigned quantity 0 are tracked as skipped inputs and archived with the batch
when the job succeeds, so the folder watcher does not rediscover them.

## v0.3.1 quantity prompt fix

Bun on Windows may return `null` when the user presses Enter at a terminal
`prompt()`. The v0.3 implementation interpreted `null` as cancel.
Now both blank input and `null` select **1** by default, while entering **0**
explicitly skips the source. Values outside 0–1000 or non-integers are reprompted.
The change is limited to `src/quantities.ts` and related tests.
