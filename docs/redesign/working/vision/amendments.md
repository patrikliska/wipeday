# Orchestrator amendments to canon.md (apply on top of canon; same authority)

A1. Product badges (rescues the owner's resource icons and keeps the Rust feel).
- Every line has a `product` id. Reuse an existing resource or item id wherever it fits, so icons the
  owner already drew stay in use. Proposed mapping (the run-section writer finalises it; one icon per
  thing, no product shared by two lines): beachcomber -> timber (driftwood), campfire -> roast
  (smoked fish; the old meal item id), garden -> fibre, loom -> rope, workbench -> planks,
  kiln -> charcoal, furnace -> ingots, tannery -> leather, press -> fuel (oil drums),
  dock -> food (fish crates), generator -> new `battery`, radio_mast -> new `signal` (or another
  fitting existing id), shipbreaker -> plates, reactor -> new `cell`.
- The product icon is used in the shop row, in the floater that flies from the building into the
  Supplies counter ("+1.2k" with the ingot icon), and in the scene's drawn product. Supplies stays the
  only spendable run currency; products are never stocked or spent.
- Icon guidance changes accordingly: the product resource icons are "keep drawing", not "stop".

A2. The single biggest owner decision is "one run currency (recommended) vs Rust-style materials".
State it first, honestly, with the trade-off: one number at 390 px and a fast, zero-tutorial loop
versus the Rust feel of several stockpiles. Give a short fallback sketch if the owner insists on
materials (for example: 3-4 era materials that only gate era purchases, never ratios or chains), and
what it would cost (phases, UI, simulator).

A3. Everything is a PROPOSAL awaiting the owner's approval. Nothing in CLAUDE.md, docs/game-design.md,
docs/roadmap.md or docs/decisions.md changes until the owner approves; that rewrite is R0's first job.

A4. Section writers never contradict canon.md or these amendments. A needed change is listed under an
"Open questions" heading at the end of the section, with the reason.

A5. Dates: today is 2026-10-07. Season 1 of the current game started today (two players). The old
roadmap planned to announce its end around 2026-10-28 and end it around 2026-11-04; under the
redesign it simply keeps running on the old build until the R2 cut-over, whenever that lands.

A6. Style: plain, concise English matching docs/game-design.md and docs/roadmap.md (short sentences,
tables, "(proposal)" on names that need the owner's pass, no hype, no emoji). Ids in `snake_case`.
Reference other plan files by name instead of duplicating them.
