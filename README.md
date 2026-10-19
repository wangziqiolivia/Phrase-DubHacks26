# Phrase: Learn a New Language Anytime any Where

## Inspiration
We started from a problem: People want to learn new languages but it takes a long time to learn the language in the traditional way of using textbooks. It’s hard to start communicating with others, which is the actual purpose of language.

The traditional pathway is to learn the knowledge then use it. We propose a learning-by-doing approach. It imitates how toddlers naturally learn their native language: driven by curiosity and to express, they try, ask, and get the right way to say something from their parents.

It’s made to be user-expression-focused, than curriculum-focused.

## What it does
The main feature is an interaction interface where users can freely talk about anything (daily life, self-reflection, etc.) in imperfect language or even scattered words, and our Perceptron AI model will turn it into complete and accurate expressions and display it on the screen, with color-highlighted corrections.

Users can choose whether they want to see the feedback in real time or after recording stops. The former is designed for beginners who need more assistance and the latter is designed for advanced learners with fewer mistakes and are able to make complete expressions already.

Users can pause the recording and chat with a personal language tutor if you don’t know how to say something completely or want to ask questions. Users can ask in any language they are comfortable with and the tutor will give responses that match their language level.

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
