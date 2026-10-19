# Print/Cut Direct — MVP Specification

This is a deterministic Bun/TypeScript production script that controls
VectorCraft directly through its localhost JSON control interface.

There is no LLM, Claude, or MCP client in the production path.

1. Accept artwork such as PDF, PNG, JPG and JPEG, plus other supported formats.
2. Parse final dimensions from filenames when possible, including `12x18`,
   `12.5x24.25`, and `35inch_26.25inch`.
3. Ask the operator for dimensions when missing and allow overrides.
4. Treat requested dimensions as the finished CUT size.
5. Add operator-selected bleed outside the finished size without changing the cut rectangle.
6. Use rectangular cut paths in Phase 1.
7. Use 0.25-inch solid black registration circles.
8. Default final PDF width to 48 inches, but ask every batch.
9. Ask for maximum final PDF length and split into synchronized panels when needed.
10. Use multi-start MaxRects nesting with optional 90-degree rotation.
11. PRINT PDF: artwork + registration marks, cut paths hidden.
12. CUT PDF: cut paths + identical registration marks; Print layer and artwork physically deleted before CUT export.
13. PRINT/CUT page pairs use identical geometry.
14. Width and length limits apply to the complete PDF including registration marks.
15. Never alter source files.

16. Ask per-file quantities, default 1, 0 skips; nest each requested copy individually.
17. Working document has named layers `Registration`, `Print`, and `Cut`.
18. Optionally preserve named PDF layers; verify RIP behavior with hidden layers.

19. Blank quantity input / pressing Enter must yield exactly 1 copy; only explicitly entered 0 skips.
20. Every master PDF document starts with a disposable VectorCraft Layer 1, which is removed before output.
21. The CUT export must be generated after physically deleting the Print layer (not merely hiding it).
22. CUT document layer list before export must contain only Registration and Cut; refuse to export if not.
23. Registration and cut geometry may not be rebuilt or moved between PRINT and CUT exports.
