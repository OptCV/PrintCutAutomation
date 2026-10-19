# v0.3.1 - Enter defaults to 1 copy

If you already have v0.3 installed, replace only `src/quantities.ts`
with the file from this ZIP. No config changes, migrations, or dependency
installation are needed for this two-line behavioral correction.

Run `bun run selftest` and then `bun run plan`.

Expected at quantity prompt:
- Enter -> 1 copy
- `0` -> skip
- `1` -> 1 copy
- `5` -> 5 copies
- invalid -> reprompt

This fix does not alter the layer behavior from v0.3.
