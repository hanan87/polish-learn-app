# Polski od zera – פולנית מאפס / Polish from Zero

A mobile-first PWA for learning Polish from zero, for **Hebrew** speakers (RTL, vocalized Hebrew transcription) and **English** speakers (LTR, English respelling).

- 8 units, 104 items: pronunciation, politeness (Pan/Pani vs ty), numbers & time, restaurant, shopping, transport, emergencies, small talk
- Stressed-syllable highlighting, articulation tips, backchaining (units 5–8 hand-checked syllables and transcriptions)
- Speaker gender + first name: gendered phrases (Zgubiłem / Zgubiłam, gotowy / gotowa, Chciałbym / Chciałabym) and roleplays adapt, with a note showing the other form
- Hands-free audio mode (driving / walking): meaning → slow → normal → you repeat, auto-scored, Wake Lock keeps the screen on
- 4 mini stories with tap-to-inspect words, an ending decoder (kawa → kawę) and comprehension questions
- 60-second Speed Blitz with combos and a saved personal record; optional haptic feedback
- "Dla Kasi": a personal dedication screen (canvas night sky, animated angel SVG, Web Audio music box)
- Speech engine: Polish TTS (normal / 0.6× / backchaining), recording + speech recognition, voice comparison, Levenshtein scoring
- Lesson engine with 5 skill stages: learn & shadow, listening & minimal pairs, reading, writing with a Polish keyboard, active-recall speaking
- Spaced repetition, per-word and per-sound weakness tracking, personalized 8-exercise reinforcement, personal dictionary
- Voice roleplay: 4 real-life scenarios
- Standalone single-file `index.html` download and JSON backup/restore
- Light / dark / device theme; built-in microphone diagnostic in Settings

## Development

```bash
npm install
npm run dev
npm run build
```

```bash
npm test          # unit + data-integrity tests (Vitest)
npm run test:e2e  # end-to-end QA in installed Chrome with a fake microphone (Playwright)
```

`npm run build` type-checks, builds the standalone single-file app and then the PWA into `dist/`. Pushing to `main` deploys to GitHub Pages.
