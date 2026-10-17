# Capture Studio

A clean video + voice recording web app built with Next.js, Tailwind CSS v4, and shadcn-style UI kit components (Radix Slider + Dialog, CVA buttons, Lucide icons).

## Features

- **Main page** with a live recording stage
- **Video mode** — camera preview + microphone recording via `MediaRecorder`
- **Voice mode** — microphone-only with an animated waveform stage
- **Toggle button** to switch between Video and Voice modes
- **Help (?) button** in the header explaining how everything works
- **Sliders** — overlay opacity + mic meter boost
- **Semi-transparent floating window** over the stage with editable text (drag it anywhere, close/reopen, reset)
- **Takes library** — playback, download, and delete, all stored locally in the browser

> Note: I saw the `/add-plugin figma` prefix — there is no Figma plugin step available in this environment, so I built the UI directly in code with a Figma-clean aesthetic instead. If you connect a Figma file, I can match its tokens.

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL (e.g. http://localhost:3000).

## Notes

- Camera/mic require browser permission and a secure context (`localhost` or HTTPS).
- Recordings never leave the browser — no server upload.
