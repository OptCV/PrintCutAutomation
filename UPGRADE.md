# Upgrade to Print/Cut Direct v0.3

This version addresses the quantity default and PDF layer cleanup without changing
MaxRects, registration geometry, bleed, or the manifest structure.

## Installation

1. Extract the archive to `D:\src\print-cut-direct-v0.3` (a **new** folder).
2. Copy `config.json` from your working v0.2 project; **do not replace it** with
   `config.example.json` if it already has the correct executable path.
3. Run `bun install`, then `bun run selftest`, then `bun run doctor`.
4. `doctor` must report the `layer.delete` command as available.
5. Create a NEW batch name (for example `LayerTest03`) in `bun run plan`.
6. When the quantity prompt displays `[1]`, press **Enter** for one copy.
   Type **0** explicitly to omit a file.
7. Run `bun run render LayerTest03` after inspecting the manifest.
8. Open the PDFs in software that displays PDF layer membership, and verify the checklist below.

## PDF layer lifecycle

```text
file.new
  └── Layer 1 (empty; created by VectorCraft)
        ↓
create Print, Cut, Registration
        ↓
delete Layer 1
        ↓
PRINT export: Print visible, Registration visible, Cut hidden
        ↓
delete Print and all its artwork from the working document
        ↓
CUT export: Registration visible, Cut visible
```

With layered-PDF export (`"pdf": {"createLayers": true}`), expected:

- PRINT: artwork and Registration marks visible; no `Layer 1`.
- CUT: exactly `Registration` and `Cut`; **no** `Print` or `Layer 1`.
- Page dimensions and registration positions match precisely.

The PRINT PDF may still contain the hidden Cut layer when `createLayers=true`.
That is unchanged and is not the same as a hidden Print layer in the CUT PDF.

## Safety behavior

The renderer inspects the live VectorCraft layer tree before each export and
throws an error rather than exporting an unexpected layer structure. It never
attempts to delete the last remaining layer or customer art on a layer it did
not create. A failed render can leave partial output files; use a new batch
name, or intentionally remove partial files before retrying.

## No workspace migrations

Keep using the same `D:\PrintCut` inbox, jobs, archive and output folders.
Use a new batch ID because existing output files are protected against overwrite.
