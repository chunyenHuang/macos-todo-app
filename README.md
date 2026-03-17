# macos-todo

macOS menu bar todo app (Electron).

## Build

Install dependencies (including devDependencies for the build):

```bash
npm install
```

Build the app for macOS. Output goes to the `dist/` folder:

```bash
npm run build
```

This produces:

- `dist/Todos-1.0.0.dmg` – disk image for installation
- `dist/Todos-1.0.0-mac.zip` – zip of the app (e.g. for distribution)

To build only the unpacked `.app` (faster, no DMG):

```bash
npm run build:dir
```

Then use: `dist/mac-arm64/Todos.app` (or `dist/mac-x64/Todos.app` on Intel).

## Install

1. **From DMG:** Open `dist/Todos-1.0.0.dmg`, drag **Todos** to **Applications**.
2. **From zip:** Unzip `dist/Todos-1.0.0-mac.zip`, move **Todos.app** into **Applications**.
3. **From dir build:** Copy `dist/mac-arm64/Todos.app` (or `mac-x64`) into **Applications**.

Open **Todos** from Applications (or Spotlight). It runs in the menu bar (no dock icon).

## Run at startup

The app is already configured to open at login. The first time you run the built app, macOS may ask for permission to add it as a Login Item; accept to have it start when you log in. It opens as **hidden** (menu bar only, no window until you click the icon).

To change this later:

- **System Settings → General → Login Items** – add/remove **Todos** or disable “Open at login”.
