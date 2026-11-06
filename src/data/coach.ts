/**
 * Spoken coaching lines for the hands-free trainer (read by the Hebrew / English voice, and shown
 * on screen). The trainer never praises an attempt it could not verify.
 */
export const COACH = {
  pass: { he: 'מצוין!', en: 'Excellent!' },
  passAfterHelp: { he: 'יפה מאוד, הצלחת!', en: 'Very good, you got it!' },
  low: { he: 'לא מדויק. הקשיבו שוב ונסו שוב.', en: 'Not quite. Listen again and try again.' },
  unclear: { he: 'לא זיהיתי את המילה. הקשיבו שוב ונסו שוב.', en: "I didn't recognize the word. Listen again and try again." },
  silent: { he: 'לא שמעתי אתכם. דברו קרוב יותר לטלפון.', en: "I didn't hear you. Speak closer to the phone." },
  chunks: { he: 'בואו נפרק את זה לחלקים.', en: "Let's break it into parts." },
  tip: { he: 'טיפ:', en: 'Tip:' },
  skipHint: { he: 'אפשר לדלג על המילה בכפתור הדילוג.', en: 'You can skip this word with the skip button.' },
  unchecked: {
    he: 'במכשיר הזה אין זיהוי דיבור, ולכן ההגייה לא נבדקת. השוו את עצמכם לדובר.',
    en: "This device can't recognize speech, so your pronunciation isn't checked. Compare yourself with the speaker.",
  },
  paused: { he: 'לא שומעים אתכם, אז עצרתי. לחצו על הכפתור כדי להמשיך.', en: "I can't hear you, so I paused. Tap the button to continue." },
} as const;

export type CoachLine = keyof typeof COACH;
