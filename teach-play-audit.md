# Mahjon — Teach-while-play audit

**Status: ship-ready** for teach-play + Phases A/C polish + claim/MP/round blockers. Phase B remains human playtest on real devices.

---

## Decisions (answered)

1. **Courtesy / optional Charleston:** **Skip this pass** + **Skip rest → play**
2. **Hand-progress coaching:** Expert / Guided / Coach (default Guided)
3. **Audience:** Full game + teaching; multiplayer first-class
4. **MP disconnect:** Room + seat key; host AI-drives seat until rejoin

---

## Shipped

Teach-play P0/P1 + Settings teaching mode + MP rejoin.

### Phase A — PWA updates
- `registration.update()` on launch, tab focus, and every 30 minutes
- Non-blocking **New version — Reload / Later** banner
- Pull-to-refresh + Settings hard refresh unchanged
- Cache bumped to `mahjon-cache-v23`

### Pass 2 — UI/UX beauty (2026-07-12)
- Quieter mobile tools: **Card · Help · ···** (settings)
- Shorter claim coach + turn hints; Hand Card first on desktop toolbar
- Refined pills, opponents, discard pool, bottom glass, Draw CTA, selection glow
- Charleston display title

### Phase C — Polish
| ID | Item |
|----|------|
| T.3 | Max/instant speed under Advanced |
| P2.2 | Modal: `aria-modal`, focus trap, Escape; Help ignores overlay tap |
| P2.7 | Lobby uses shared menu CSS (no inline styles) |
| P2.5 | `prefers-reduced-motion`; soft Home Screen tip on return menu visits |
| P2.4 | Hand Card search/filter |
| T.5 | Removed unused charleston helpers, `tileName`, dead import |

### Ship blockers fixed (2026-07-12)
- Claim **Pass** no longer advances the turn; window waits for other claims / AI
- Mid-game disconnect → seat becomes AI until rejoin
- Join waits for accept/reject (not a blind 500ms)
- **New Round** keeps scores + rotates dealer
- Discard Mahjong removes the tile from the discard pile
- MP clients see “Waiting for host…” on round end
- Lobby blocks start while a human seat is offline

### Phase B — Playtest (you)
Still manual on phones + one MP table:
1. Guided / Expert / Coach
2. Skip this pass / Skip rest (solo + MP)
3. Rejoin room + seat key (confirm AI takeover while gone)
4. Tutorial → Start Playing
5. Pass on a claim, confirm AI can still pung
6. New Round → scores accumulate
7. Update banner after a deploy (optional)

### Phase D — Non-goals (unchanged)
No rules rewrite · keep tips/ClaimCoach/Hand Card in Charleston · Charleston not backdrop-dismissible

---

## How to rejoin mid-game

1. Note **Room** + **Seat key** (board + Settings).
2. Drop offline → host AI plays your seat; hand stays.
3. Multiplayer → Join with room + seat key.
4. Host restores human control + state.

---

*Track closed except Phase B playtest.*
