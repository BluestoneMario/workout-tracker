# Deploying Workout Tracker to your iPhone

This folder is a Progressive Web App (PWA). To install it on your iPhone you need to:

1. Host the folder on a public HTTPS URL.
2. Open that URL in **Safari** on your iPhone (it must be Safari — Chrome / Firefox on iOS cannot install PWAs).
3. Tap **Share → Add to Home Screen**.

Below is the recommended path using GitHub Pages (free, no build step).

---

## GitHub Pages setup

**Live URL (once deployed):** https://bluestonemario.github.io/workout-tracker/
**Repository:** https://github.com/BluestoneMario/workout-tracker
**GitHub username:** BluestoneMario

### One-time setup

```bash
# 1. Configure Git identity (skip if already done)
git config --global user.name "BluestoneMario"
git config --global user.email "lennarthellwig@yahoo.de"

# 2. Navigate to the PWA folder
cd "/Users/lennart.hellwig/Documents/Claude Code Personal/Workout Tracker PWA"

# 3. Initialise Git and make the first commit
git init
git add .
git commit -m "Initial commit — Workout Tracker PWA"
git branch -M main

# 4. Connect to GitHub and push
git remote add origin https://github.com/BluestoneMario/workout-tracker.git
git push -u origin main
```

Then in the repo's **Settings → Pages**, set source to `main` branch, root `/`. GitHub Pages will go live ~60 seconds later.

**Authentication note:** GitHub does not accept your account password for `git push`. Use a Personal Access Token instead. Generate one at: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). Tick the `repo` scope. Paste the token when Git asks for your password.

### Updating the app

```bash
cd "/Users/lennart.hellwig/Documents/Claude Code Personal/Workout Tracker PWA"
git add .
git commit -m "describe what you changed"
git push
```

The live site updates within ~60 seconds of a successful push.

**Important:** whenever you change `index.html` or `sw.js`, bump `APP_VERSION` in `sw.js` (e.g. `"1.0.0"` → `"1.0.1"`). This causes the service worker to invalidate the old cache on users' devices so they pick up the new version automatically.

---

## Installing on iPhone

Once your app is live at the HTTPS URL above:

1. Open the URL in **Safari** on the iPhone.
2. Wait for the page to finish loading (~5 seconds). This is when the service worker installs and caches everything for offline use — including the Tabler icon font from jsDelivr.
3. Tap the **Share** icon (square with an up-arrow) at the bottom of Safari.
4. Scroll down and tap **Add to Home Screen**.
5. The name defaults to "Workout". Tap **Add**.

You now have an app icon on your home screen. Tapping it opens the tracker full-screen with no Safari chrome, just like a native app.

### Verifying offline works

After installing:

1. Open the app once while online so the service worker can cache everything.
2. Turn on Airplane Mode.
3. Re-open the app from the home screen — it should load fully and let you log sets.
4. Turn Airplane Mode off — your session data stays in place.

---

## Migrating your training history from desktop to iPhone

Your data lives in `localStorage` under the key `training_history`. It does not sync automatically across devices, but the built-in Export/Import buttons make one-time transfer easy.

### Steps

1. **On your desktop browser:** open the app (either the original HTML file or the deployed PWA URL), then click **Export JSON** in the workout view. This downloads a file like `training_history_2026-05-14.json`.

2. **Transfer the file to your iPhone** using one of:
   - **AirDrop:** right-click the downloaded file in Finder → Share → AirDrop → your iPhone. Accept on the iPhone.
   - **iCloud Drive:** move the file into iCloud Drive on the Mac; open Files on the iPhone and find it there.
   - **Email:** email it to yourself and open the attachment on the iPhone.

3. **On your iPhone in Safari:** open the deployed PWA URL, then tap **Import** (or **Import JSON** in the History view). Pick the JSON file you just transferred.

The app merges the imported sessions with any existing data — no duplicates, no data loss.

---

## Bumping the version when you update

Every time you change `index.html` or `sw.js`, edit the top of `sw.js`:

```js
const APP_VERSION = '1.0.1';  // increment this
```

This changes the cache name, causing the service worker to activate fresh and delete the old cache. Without this bump, users' devices will continue serving the old cached files.
