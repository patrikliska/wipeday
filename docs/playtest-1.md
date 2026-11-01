# Playtest 1: run 1 on a phone

R1's playtest (`docs/roadmap.md`, owner checklist). About 50 minutes of play, plus a few minutes
with the demo clock. Its answers decide whether the first minute slows (the Timber era's price,
within the N-assertions) and whether unmanned lines stay as they are or fall back to canon 19's
"lines run while Hustle > 0", which is held in reserve.

## Setup

1. On the PC: `pnpm web` (the client alone, in demo mode: the whole game runs in the browser).
2. Find the PC's address on the home network: `ipconfig`, the IPv4 address of the Wi-Fi or
   Ethernet adapter (for example `192.168.1.23`).
3. On the phone, on the same Wi-Fi: open `http://192.168.1.23:5173/?demo`. Vite already listens on
   the network (`host: true`); if the page does not load, allow Node through the Windows firewall
   for private networks.
4. Optional: "Add to Home Screen" for full screen. Sound is in Settings (☰, top right); it starts
   with the first tap.

Demo mode keeps nothing across a reload: **do not reload** mid-run (a reload is a new island).
The ✦ button top right opens the demo controls: pause, +1 h, +6 h, next 08:00, +1M supplies, New
island. Jumps move the game clock only; Hustle, flotsam and buffs keep real seconds.

To test with saving and a real welcome back instead: `pnpm dev` on the PC (the API and the client)
and log in on the phone as test player 1. State then lives in `var/` and survives reloads.

## What should happen (the simulator's run 1, 6 taps a second)

| Time | Beat |
| --- | --- |
| 0:00 | Dawn, the pine, "Tap the tree." Nothing else. |
| 0:01 | The drawer slides up: Beachcomber, 6. |
| about 0:10 | Stone Tools (60). |
| 0:33 | The Timber era (1.5k): a cabin, the outcrop, three new plots. |
| 0:47 | Mara, the first hand. The nav row (Island, Crew) slides in. |
| 3:00 | The first crate drifts in on the left: a flat 2 minutes of supplies. Missed, another every 3:00. |
| about 4:00 | Sorting Tables (1M): every line ×2. |
| about 5:45 | The Stone era (3M): the ore seam. |
| about 40-48 min | The Sheet Metal era (20B): the sulfur vent. |
| about 43-49 min | 50B made: yield 10. The Big Red comes in R4, so nothing happens yet; note the time. |

## What to try, and what to tell me

**The first minute.** Just play, no reading ahead. Too rushed, too slow, or right? Did you know
what to tap at every moment?

**Unmanned lines (the main question).** A line without a hand runs only while you tap: its bar
fills while you tap and stops when you stop ("Idle · tap to run"). Tap for 20 seconds, then stop
for 20 and watch the lines and the `/s` under the counter. Does it read? Does it feel fair or
fiddly? Did you understand why hiring a hand matters?

**The crown.** One orange thing at a time. Sometimes the crown sits on "Tap the …" even though
something is affordable: the game is saving for a better buy, shown first in the drawer with
"in 2s" or similar. Did that confuse you, or did you just keep tapping? Longest wait without
buying anything: was any stretch dead (the simulator's longest is about 10 minutes, around
Handcarts)?

**Flotsam.** Catch the 3:00 crate. Later ones: crates, Fuel Drums (Rally, all lines ×4 for a
minute), now and then an Adrenaline Kit (taps ×100 for 12 s). Did you see them arrive? Is 13
seconds enough? The Odds sheet: ☰ opens Settings, Odds is under How it works.

**Hold to work.** Hold a finger on the target: after a moment it counts 4 taps a second. Found
it without the hint? Comfortable?

**Away and back.** With a hand or two hired: ✦ → +1 h, then +6 h, then Next 08:00. Read the
welcome-back card each time and press Collect. Also try a jump with no hands hired. Clear?

**Night Shift and notifications.** In Settings (☰): Night Shift over, quiet hours 22:00-08:00. In
demo mode the switch is disabled with its reason; with `pnpm dev` it can be switched on.

**Everything else.**
- Where were you lost, even for a second?
- Does it look like a base you are building, or like a spreadsheet?
- Is the phone warm after 20 minutes? Any stutter (a screen recording helps)?
- Sound and vibration: too much, too little, any cue that grates?
- Anything that looked broken: a screenshot with the time.

Send the answers and screenshots (phone and, if you try it, desktop). Owner screenshots are bugs
with priority over new features (CLAUDE.md section 2).
