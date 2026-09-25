# 🎭 Family Dum Charades Mobile Web App

A polished, mobile-first, touch-friendly **Dum Charades** web app designed for family gatherings, parties, and get-togethers on iPhone portrait screens. Built with pure HTML5, Vanilla CSS, and modular Vanilla JavaScript — zero build steps, 100% static, and deployable to GitHub Pages with full offline PWA support.

---

## ✨ Features

- **📱 Mobile-First iPhone UX**: Designed for one-handed portrait play, 56px+ touch buttons, high contrast, and smooth animations.
- **🔒 Turn-by-Turn Privacy Shield**: Ensures only the active player sees their prompt before acting; wipes prompt text before passing the phone.
- **⏱️ Dual Timers**:
  - **Preparation Phase** (Default 30s): Allows the actor to think and prepare before miming.
  - **Acting Phase** (Default 60s): Big bold **"ACT NOW!"** banner with progress bar and an instant secret peek feature.
- **🎯 19 Curated Categories & Difficulty Filters**:
  - Filter by multiple categories, select All, or trigger **Surprise Me Mode**.
  - Filter by Medium, Medium-Hard, Hard, or All.
- **📦 Smart Randomizer**: Avoids immediately repeating the same category when multiple categories are selected.
- **🔄 Local Persistence**: Saves used prompt IDs, player history, and user settings in browser `localStorage`.
- **📴 Offline PWA**: Installable to iOS / Android home screens. Works without internet once loaded via Service Worker cache.
- **🔊 Graceful Web Audio & Haptics**: Synthesized countdown ticks, time's up chime, success audio, and vibration support.

---

## 🚀 How to Run Locally

Because the app loads `data/prompts.json` and registers a `service-worker.js`, run it using any local static file server:

### Option 1: Python (Built-in)
```bash
cd c:/projects/family-dum-charades
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

### Option 2: Node.js `npx serve` or `http-server`
```bash
npx serve c:/projects/family-dum-charades
```

---

## 📋 How `data/prompts.json` Works & Adding More Prompts

Prompts are stored as a JSON array in `data/prompts.json`.

### Schema:
```json
[
  {
    "id": "sit-001",
    "category": "Funny Situations",
    "prompt": "Cutting onions and trying not to cry",
    "difficulty": "Medium",
    "status": "Keep"
  }
]
```

### Supported Categories:
1. Funny Situations
2. One-Word & Object Prompts
3. Bollywood People & Relations
4. Indian TV & Shows
5. Bollywood Dialogues
6. Bollywood Songs
7. Food, Grocery & Kitchen Items
8. Famous Places & Landmarks
9. Professions & Roles
10. Technology & Apps
11. Indian Weddings & Family
12. Sports & Games
13. Travel & Airport
14. Animals with a Twist
15. Brands & Products
16. Idioms & Phrases
17. Weather & Nature
18. Office & School Life
19. Celebrations & Holidays

### Replacing with Your Master Bank / Google Sheet:
1. In your Google Sheet, export columns: `id`, `category`, `prompt`, `difficulty`, `status`.
2. Convert the table to JSON (e.g. using online CSV-to-JSON or a quick export script).
3. Overwrite `data/prompts.json`.
4. Refresh the app!

---

## 🌐 How to Publish to GitHub Pages

1. Push this repository to GitHub.
2. In your GitHub repository:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
   - Select the `main` branch and `/ (root)` folder.
   - Click **Save**.
3. Your site will be live at `https://<username>.github.io/<repository-name>/`.
> **Note**: All asset paths (`./css/styles.css`, `./data/prompts.json`, `./js/...`) use relative `./` notation, ensuring seamless deployment on subpaths.

---

## 📴 Offline / PWA Installation

- **On iPhone / Safari**:
  1. Open the website in Safari.
  2. Tap the **Share** button (box with upward arrow).
  3. Tap **Add to Home Screen**.
- **On Android / Chrome**:
  1. Tap the three-dot menu.
  2. Tap **Install App** / **Add to Home Screen**.

Once loaded, the Service Worker caches `index.html`, stylesheets, scripts, icons, and `data/prompts.json` so the game works in offline airplane mode.

---

## 💾 Local Game State & Resetting

- **Used Prompts**: Saved in `localStorage['fdc_used_prompts']`.
- **Game History**: Saved in `localStorage['fdc_game_history']`.
- **Settings**: Saved in `localStorage['fdc_settings']`.

### How to Reset:
- **Reset Used Prompts only**: Tap `⚙️ Settings` > `🔄 Reset Used Prompts` (or tap the prompt when cards run out).
- **Reset Everything**: Tap `⚙️ Settings` > `🗑️ Reset All Data & Settings`.
