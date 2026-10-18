# Credits

Everything here ships with the game; the credits panel (R2 Feel S5) lists the same lines.

## Fonts

- **Big Shoulders Display**, Copyright 2019 The Big Shoulders Project Authors, SIL Open Font
  License 1.1. `apps/web/public/fonts/BigShouldersDisplay-latin.woff2`, licence beside it.
- **Barlow**, Copyright 2017 The Barlow Project Authors, SIL Open Font License 1.1.
  `apps/web/public/fonts/Barlow-*.woff2`, licence beside them.

## Art

- The pixel scene is generated for this game with Retro Diffusion and finished by hand
  (`docs/redesign/art/README.md`, D190).

## Sound

The map is `packages/content/data/sounds.json5`; `pnpm sounds` builds the files into
`apps/web/public/sound/<pack>/`, each pack's `License.txt` beside its files.

- **Impact Sounds** by Kenney (https://kenney.nl/assets/impact-sounds), CC0 1.0.
- **Interface Sounds** by Kenney (https://kenney.nl/assets/interface-sounds), CC0 1.0.
- **RPG Audio** by Kenney (https://kenney.nl/assets/rpg-audio), CC0 1.0.
- Every other sound (the hire's whistle, the era's rise, the fuel drum's rev, and every cue until
  its file has loaded) is synthesised by the game (`apps/web/src/sound/voices.ts`).
