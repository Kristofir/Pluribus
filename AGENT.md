# Project instructions

Read `AGENTS.md`, `README.md`, and [the architecture contract](docs/architecture.md)
at the beginning of a session.

- Keep this a framework scaffold until product work is explicitly requested.
- Frontend code lives in `src/`; backend adapters live in `convex/`; framework-independent business code belongs in `core/` as features arrive.
- Identify affected architecture boundaries before implementation. Update the contract and decision log when an accepted boundary changes; discuss consequential departures rather than silently weakening checks.
- Read `convex/_generated/ai/guidelines.md` before changing backend code.
- Do not edit generated files by hand; use the Convex CLI.
- Use PascalCase source filenames and camelCase functions, methods and variables; preserve generated and framework-required filenames.
- Keep documentation succinct and human-readable. Use plain language and avoid unnecessary detail.
- Keep secrets out of source, logs, and `hackathon.md`. Never expose secrets through `VITE_` variables.
- Run `npm run check` and `npm run build` after changes; check affected behavior locally.
- Keep `hackathon.md` factual and current using the installed hackathon skill.
- Do not add product features, publish, commit, or push unless requested.
