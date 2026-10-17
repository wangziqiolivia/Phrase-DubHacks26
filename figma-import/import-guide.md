# Importing Capture Studio into Figma (via plugin)

I can't click inside your Figma app, but this folder prepares everything so you can import the coded UI in ~3 minutes.

## Recommended path: html.to.design plugin (imports the live page)

1. Pull this repo and run the app on your own machine (the plugin runs in _your_ browser, so it needs the page on _your_ localhost — it cannot reach my preview URL):
   ```bash
   git pull
   npm install
   npm run dev
   ```
   Open http://localhost:3000 and accept the camera/mic prompt state you want captured (deny = empty-state preview, allow = live preview).
2. In Figma, open your DubHacks file, then **Actions → Find more actions → Plugins → html.to.design → Open**.
3. Paste `http://localhost:3000`, set viewport to **Desktop 1440**, and hit **Import**.
4. Repeat at **Mobile 390** for the responsive variant.
5. The import lands as editable Figma layers next to your existing frames — move them where you want in the file.

## Design tokens

`design-tokens.json` (this folder) lists the exact colors, type scale, radii, shadows, layout, and per-component specs extracted from the code. Use it to create Figma color/text styles, or feed it to a tokens plugin (e.g. Tokens Studio: paste the `colors` object as a token set).

## Notes

- The floating note window is translucent and draggable in code; after import it arrives as a static glass panel — re-apply Figma's background blur + 55% opacity to make it feel native.
- The voice-mode waveform is canvas/live-meter driven; the import captures one frozen frame, which is the correct thing to design around.
- Camera/mic permission banners are browser chrome, not part of the design — crop or ignore them.
