# Mahjon 🌊 — American Mahjong PWA

A premium, statically-hosted American Mahjong (2026 card) web app. Play against smart AI opponents locally or connect with friends in real-time via serverless WebRTC. Designed with a clean, relaxing ocean/beach theme and fully optimized as a Progressive Web App (PWA) for complete offline play (ideal for airplanes and travel).

**Product goal:** Mahjon should feel calm and readable on a phone first — large tiles, clear actions, nothing clipped off-screen — while teaching the game *as you play*. Learning is not a one-time tutorial; help is available at every step. Scoring is for fun (no cash settlements).

The digitized **2026 hand card** lives in [`docs/2026-hand-card.md`](docs/2026-hand-card.md).

---

## Key Features

- 🌊 **Aesthetics**: Premium beach-themed layout featuring sunlit lagoon wave animations, sand driftwood borders, and beautiful sea glass panels.
- 🧠 **Learn at every step**: Hover or long-press any tile to identify it (Crak, Bam, Dot, Winds, Dragons, Flowers, Jokers). Open **Help** and the **Hand Card** from the menu, tutorial, Charleston, and live game. Contextual “What’s this?” explainers cover the Charleston and turn rules without leaving the flow.
- 🌐 **WebRTC Multiplayer**: Real-time peer-to-peer multiplayer with zero servers. Host a room, share a 5-letter room code, and play directly.
- 🤖 **AI Opponents**: Play against AI players with Easy, Medium, or Hard difficulty levels powered by custom heuristic-based hand evaluators. Adjustable play speed (Slow → Max).
- ✈️ **Offline Mode (PWA)**: Completely installable as an app on desktop or mobile. Play fully offline against AI while traveling.
- 📖 **Interactive Tutorial**: Step-by-step learning mode that walks through suits, honors, the Charleston passing phase, claims, and winning combinations.
- 📋 **In-game hand card**: View all 72 winning hands in the 2026 card configuration anytime from the board or Charleston.
- 🔄 **Joker Swapping**: Full interactive swap support to exchange natural tiles from hand for exposed jokers.

---

## Design principles

1. **Phone-first readability** — Primary targets: iPhone 14+ and Pixel-class Android. Tiles and controls stay large enough to tap; content must not fall under browser chrome or safe-area insets.
2. **Teach in context** — If a player wonders “what is this?”, the answer is one hover, long-press, Help, or Card tap away — including during Charleston and mid-hand.
3. **Ocean theme, calm UI** — Lagoon colors, sand accents, sea-glass panels. Prefer clarity over chrome clutter.
4. **Offline-capable** — Single-player vs AI works after first load with no network.

---

## Getting Started

### Prerequisites

You need [Node.js](https://nodejs.org/) (v18 or higher) and `npm` installed.

### Quick Start (Local Development)

1. Clone or copy the directory and navigate into it:
   ```bash
   cd mahjon
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```

4. Open the displayed local URL (typically `http://localhost:5173`) in your browser.

---

## Playing Offline (PWA Installation)

### Desktop (Chrome/Edge/Safari)
1. Open the hosted URL in a supported browser.
2. Click the **Install** icon in the URL address bar (or select "Add to Applications" or "Install Mahjon" in the browser menu).
3. The app is now launcher-accessible from your Applications folder and runs completely offline.

### Mobile (iOS / Android)
- **iOS**: Open in Safari, tap the **Share** button, and select **Add to Home Screen**.
- **Android**: Open in Chrome, tap the menu dots, and select **Add to Home Screen** or **Install App**.

Once loaded once, the service worker caches all static assets, allowing you to play the single-player vs AI mode without any network connection (e.g., in Airplane Mode).

---

## How WebRTC Multiplayer Works

Because this is a static site with no central database server:
1. **Hosting**: The Host clicks **Online Multiplayer** -> **Create Room**, and receives a 5-letter Room Code.
2. **Joining**: Remote players enter the same Room Code and click **Join**.
3. **Signaling**: PeerJS cloud with a custom ICE stack (STUN + TURN, `iceCandidatePoolSize: 0`, retries). Gameplay then syncs peer-to-peer.
4. **AI Slots**: If you have fewer than 4 human players, the Host can start the game to automatically fill the remaining seats with local AI bots.
5. **Authority**: The Host processes turn advances and AI moves, then synchronizes state updates to all clients, ensuring absolute synchronization.
