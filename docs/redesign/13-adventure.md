# 13. The AdVenture trilogy against Wipe Day (gap note, 2026-10-26)

**Status:** a one-page comparison for the owner's pick before R3 S2. The source is the owner's
research `adventure-trilogy-research.md` (beside this file) (AdVenture Capitalist, Communist and Ages, plus other
idle games' mechanics); the owner likes **AdVenture Communist and Ages** most. The mocks for the
pick are behind `?mock=` (`apps/web/src/hud/mocks/`, shots `mock_*`, the picks page
`preview/missions/index.html`). Nothing in this file is decided; the pick becomes a D-number.

## 1. What is already in

| AdVenture mechanic | Wipe Day | Note |
| --- | --- | --- |
| Exponential cost, linear output, growth 1.07-1.15 a unit | the 14 lines: growth 1.15 falling to 1.07; ×16 cost, ×4.75 output a rung | the AdCap run, `02` |
| Milestones ×2 at 25/50/100/200/300/400; "Everything" unlocks | per-line milestones; roster milestones at 25/100/250 all | same shape |
| Managers; bulk buy ×10/×100/Max | hands; bulk buy from the second hand | same |
| Angels: √ lifetime, +2% each, spendable | glass: fifth root; Glow `1 + 0.25√G` on glass ever; held glass buys nodes | friendlier: spending never lowers Glow |
| Cards (Researchers, Heroes) as the carried power; max level per rarity; duplicates pay currency | R3: 14 survivors with stars, 30 gear, shards from duplicates, three drop tiers with printed odds and pity | S1 built; the Album is S3 |
| Capsules from missions and rank-ups | Supply Drops from fells, badges, the Sealed Locker, quests, scrap, nukes | same sources, no money (D182) |
| Free capsules that stack to 2 (a return trigger) | fell drops: one an hour, three a day | the cap exists; it is not shown as a stacking slot |

## 2. What is different, and what is missing

| AdComm / Ages | Wipe Day today | Gap |
| --- | --- | --- |
| **Missions → rank-up.** N of N+3 missions complete the rank; each pays a capsule; rank-up is the reset | daily quests (three a day, R3 S2) and 64 badges; the nuke is crowned by a glass delta or a slowing run | **the run has no checklist**: nothing says "do these five and launch" |
| Rank-up itself gives no power; cards are all of it | the nuke pays glass: Glow and nodes; cards add on top | a balance setting (how much the cards carry), not a feature |
| Chain economy: a tier produces the tier below, costs fixed; the wall is the missions | one Supplies currency, costs rise | **do not take**: it restarts `10-balance.md` and the simulator; the missions spine works without it |
| Daily gifts in 5-day cycles; Special Ops tier track | nothing | small, fits beside the quests |
| Events twice a week with leaderboards; pass; paid capsules; "contains loot boxes" | excluded: no seasons (D128), friends never compete for stock (pillar 5), nothing for money before R9 (D182), odds printed and no blank pull (D181) | stays excluded |
| Expeditions as a sink for the main currency (Egg, Inc. ships) | the sea layer is parked in git (`07` 2.2) | later, when its trigger fires |

## 3. The three variants in the mocks

- **A. Daily quests** (the R3 plan, `12-feel.md` 9.2): three a day in the Logbook under "Today",
  the third pays a Supply Drop I and scrap. A daily rhythm; the run itself keeps the crown only.
- **B. Work Orders** *(name: proposal)*: eight orders per run, any five fuel the Kettle: the
  finished set lights the Big Red (it crowns it; it never locks it, pillar 3: the glass formula is
  unchanged). Each order pays a drop or scrap when claimed. A card at the top of the shop, never
  reordered (D186), shows the running order and the steps; a sheet lists them. Orders are
  predicates on the run, built with the badges' condition machinery (`achievements.json5`'s
  `when`), so the list is data. Wipe Day #N is the rank.
- **C. Both**: B's orders per run and A's three quests a day, the quests in the orders sheet
  under "Today" and in the Logbook.

**The postcard mock** shows the carried power in two columns, Glow (glass) and Crew (cards), for
the owner to say which should dominate: AdComm's answer is cards, Wipe Day's plan is Glow with
cards on top. The Blast Map (R5, R9) is built on glass, so the middle is the plausible setting.

## 4. What a pick changes

| Pick | R3 S2 | Simulator | Later phases |
| --- | --- | --- | --- |
| A | as planned | N19, N30 | none |
| B | quests become orders: `orders.json5` (a pool per era, a roll per run on the base's seed), `claim_order`, the card and sheet; scrap and boosts as planned | the casual's archetype claims orders; N1-N3 and N5-N7 re-measured; a new check: five orders are reachable in every run 1 | R4's crown rule 3 (the slowing run) is replaced by "the set is fuelled"; the Kettle's stages follow the steps |
| C | B plus the daily set | both | as B |

The recommendation is **C with B's orders doing the heavy lifting**: the orders give the run the
AdComm checklist the owner likes and make the Kettle legible from minute one; the daily set keeps
the morning check-in. Scrap stays about 5 a day for a casual (N19): the orders' scrap replaces the
badges' 1 per 5 for the most part, so the band holds.
