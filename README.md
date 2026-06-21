# Mahjon 🌊 — American Mahjong PWA

A premium, statically-hosted American Mahjong (NMJL 2026 rules) web app. Play against smart AI opponents locally or connect with friends in real-time via serverless WebRTC. Designed with a clean, relaxing ocean/beach theme and fully optimized as a Progressive Web App (PWA) for complete offline play (ideal for airplanes and travel).

---

## Key Features

- 🌊 **Aesthetics**: Premium beach-themed layout featuring sunlit lagoon wave animations, sand driftwood borders, and beautiful sea glass panels.
- 🌐 **WebRTC Multiplayer**: Real-time peer-to-peer multiplayer with zero servers. Host a room, share a 5-letter room code, and play directly.
- 🤖 **AI Opponents**: Play against AI players with Easy, Medium, or Hard difficulty levels powered by custom heuristic-based hand evaluators.
- ✈️ **Offline Mode (PWA)**: Completely installable as an app on desktop or mobile. Play fully offline against AI while traveling.
- 📖 **Interactive Tutorial**: Step-by-step learning mode that walks through suits, honors, the Charleston passing phase, claims, and winning combinations.
- 📋 **In-game NMJL card**: View all 72 winning hands in the 2026 card configuration with one click from the top bar.
- 🔄 **Joker Swapping**: Full interactive swap support to exchange natural tiles from hand for exposed jokers.

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
3. **Signaling**: Connection signaling is handled dynamically via the public PeerJS cloud. Once connected, all gameplay data synchronizes directly between peer browsers (Peer-to-Peer).
4. **AI Slots**: If you have fewer than 4 human players, the Host can start the game to automatically fill the remaining seats with local AI bots.
5. **Authority**: The Host processes turn advances and AI moves, then synchronizes state updates to all clients, ensuring absolute synchronization.
