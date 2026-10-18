# lived — A language journal

A camera-and-transcript experience for capturing everyday moments while practicing a language. Built with Next.js, React, Tailwind CSS, and browser media APIs.

## Run locally

```bash
npm install
npm run dev
```

Open the localhost URL printed by Next.js. Camera and microphone access require browser permission and a secure context (`localhost` or HTTPS).

## Features

- Record video with audio or make a voice-only recording.
- Pause, resume, replay, download, and delete recordings during the current browser session.
- Transcribe finished recordings with Perceptron Mk1.5 audio transcription.
- Choose English, Spanish, French, or Japanese and select Perceptron after-recording feedback or browser-powered real-time transcription.
- Review the sample inline correction by selecting its highlighted word.

“After recording” sends audio to Perceptron Mk1.5 for transcription and grammar feedback when recording ends. “Real-time” uses browser speech recognition while you speak and sends recognized transcript text to Perceptron for grammar suggestions. Browser speech recognition support varies; the app reports an error when it is unavailable. Perceptron audio transcription supports recordings up to 7 minutes 30 seconds.

Recordings are held in memory for the current page session and are not persisted after leaving the app.

## Perceptron setup

Copy `.env.example` to `.env.local` and set `PERCEPTRON_API_KEY` to your Perceptron API key. The key is used only by server-side API routes; do not expose it through a `NEXT_PUBLIC_` variable. Restart the development server after changing the environment file.
