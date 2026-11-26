# Working on Iron Basin

Read [spec.md](spec.md) before changing the game. Keep the spec and the in-game field manual in sync with changes to rules, costs, timers, or controls.

## Make and verify a change

- Work in the GitHub checkout for `bishoppawn1/RTS`. Check the current branch, remote, and working tree before editing. Preserve other contributors’ changes.
- Keep the game playable as a static site from the repository root. Use relative asset URLs so it runs under the GitHub Pages project path.
- Put game rules in `sim.js`, movement routing in `navigation.js`, rendering in `art.js` and `world.js`, and input and HUD behavior in `main.js`.
- Run `node --test tests/game.test.cjs` and check changed scripts with `node --check`. Extend the regression tests when changing an interaction or simulation rule they do not exercise.
- Serve the repository with `python3 -m http.server 8000 --bind 127.0.0.1`. Exercise the changed behavior through the game controls. For camera or map changes, check marker alignment, viewport bounds, zoom, and click-to-center.

## Deliver the change

After each completed change, review the diff, commit the related files together, and push to the GitHub repository. Follow the user’s requested branch or review process. The current Pages source is the root of `main`.

Check the Pages deployment for the pushed commit. Open the live game and verify the changed behavior or compare the served assets with the tested revision. Report the commit, live URL, checks run, and any outstanding issue. Respect explicit requests for local-only work or a draft.
