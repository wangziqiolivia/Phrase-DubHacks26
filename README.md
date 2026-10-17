# lived — A language journal

A camera-and-transcript experience for capturing everyday moments while practicing a language. Built with Next.js, React, Tailwind CSS, and browser media APIs.

## Run locally

```bash
npm install
npm run dev
```

Open the localhost URL printed by Next.js. Camera and microphone access require browser permission and a secure context (`localhost` or HTTPS).

## Current prototype

- Record video with audio or make a voice-only recording.
- Pause, resume, replay, download, and delete recordings during the current browser session.
- Use browser speech recognition for live transcription when the browser supports it.
- Change the recognition language and choose how visible sample language feedback should be.
- Review the sample inline correction by selecting its highlighted word.

Live language feedback is illustrative sample content, not AI-generated. The app does not currently connect to an AI or transcription service, and browser speech recognition support varies. When speech recognition is unavailable, the recording still works and the interface explains that no transcript was captured.

Recordings are held in memory for the current page session and are not uploaded or persisted after leaving the app.
