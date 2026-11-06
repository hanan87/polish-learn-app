# Polski od zera – פולנית מאפס / Polish from Zero

A mobile-first PWA for learning Polish from zero, for **Hebrew** speakers (RTL, vocalized Hebrew transcription) and **English** speakers (LTR, English respelling).

- 8 units, 100 items: pronunciation, politeness (Pan/Pani vs ty), numbers & time, restaurant, shopping, transport, emergencies, small talk
- Stressed-syllable highlighting, articulation tips, backchaining
- Speech engine: Polish TTS (normal / 0.6× / backchaining), recording + speech recognition, voice comparison, Levenshtein scoring
- Lesson engine with 5 skill stages: learn & shadow, listening & minimal pairs, reading, writing with a Polish keyboard, active-recall speaking
- Spaced repetition, per-word and per-sound weakness tracking, personalized 8-exercise reinforcement, personal dictionary
- Voice roleplay: 4 real-life scenarios
- Standalone single-file `index.html` download and JSON backup/restore

## Development

```bash
npm install
npm run dev
npm run build
```

`npm run build` type-checks, builds the standalone single-file app and then the PWA into `dist/`. Pushing to `main` deploys to GitHub Pages.
