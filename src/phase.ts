/**
 * The build phase the project is currently in (CLAUDE.md section 11).
 *
 * `pnpm assets check` fails only for assets needed up to and including this
 * phase, so the owner is never nagged about art for unbuilt features.
 */
export const CURRENT_PHASE = 0;
