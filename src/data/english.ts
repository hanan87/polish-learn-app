/**
 * English layer for units 1–4 (authored Hebrew-first). Merged into the items in data/index.ts.
 * The English phonetic respelling is generated from the Polish text (lib/polishPhonetics).
 */

export interface EnglishEntry {
  en: string;
  tip: string;
  note?: string;
}

export const UNIT_EN: Record<string, { title: string; subtitle: string; description: string }> = {
  u1: {
    title: 'Secrets of Polish Pronunciation',
    subtitle: 'Hard vs soft hissing sounds, ł vs l, w, and nasal vowels',
    description:
      'Before words come sounds. Here you learn to hear the hard sibilants (sz, cz, ż, rz – tongue back, lips rounded) versus the soft ones (ś, ć, ź – tongue forward, smiling lips), ł that sounds like English w, w that sounds like v, and the nasal vowels ą and ę.',
  },
  u2: {
    title: 'Real Polish Politeness & Introductions',
    subtitle: 'Greetings, thanks, sorry – and when to use Pan/Pani vs ty',
    description:
      'In Poland politeness is grammar. Strangers, officials and older people are addressed in the third person with Pan (sir) and Pani (madam). Only friends, family and children get ty (you). Getting this wrong sounds rude, so every item here is tagged with its register.',
  },
  u3: {
    title: 'Getting Around, Numbers, Days & Time',
    subtitle: 'Numbers 1–5, weekdays, directions and the time',
    description:
      'Meet one of the most important Polish sound rules: devoicing. A voiced consonant (w, rz, b, d) next to a voiceless one (t, p, k) or at the end of a word loses its voice. That is why wtorek sounds like "FTOH-rek", trzy like "tshih" and osób like "OH-soop".',
  },
  u4: {
    title: 'Restaurant, Café & Supermarket',
    subtitle: 'Ordering, paying and handling the checkout',
    description:
      'Rule one when ordering: do not say "I want" (chcę) – it sounds blunt. Say Poproszę ("I\'d like, please") plus the item. Waiters and cashiers are addressed with Pan/Pani; friends invite each other for coffee with ty.',
  },
};

export const ITEM_EN: Record<string, EnglishEntry> = {
  // Unit 1
  'u1-01': { en: 'school', tip: 'sz is a hard hiss: curl the tongue tip back toward the palate and round the lips slightly – like a darker English "sh". ł sounds like English w: rounded lips, tongue does not touch the teeth.' },
  'u1-02': { en: 'chocolate', tip: 'cz is a hard, thick "ch": tongue tip raised and pulled back, lips pushed slightly forward. Heavier than the English "ch" in "cheese".' },
  'u1-03': { en: 'frog', tip: 'ż is a hard "zh" like the s in "measure": tongue pulled back as for sz, but with voice. Put a hand on your throat – you should feel it vibrate.' },
  'u1-04': { en: 'river', tip: 'rz sounds exactly like ż – there is no r in it at all! It is only historical spelling. Place the tongue as for ż and voice a "zh".', note: 'Even Poles mix up ż and rz in spelling – it is one of the most common spelling errors in the country.' },
  'u1-05': { en: 'groats / porridge', tip: 'Hard sz: tongue back, lips rounded – a deep, dark "sh". Compare right away with Kasia, where the sound is soft and "smiling".', note: 'kasza (buckwheat, barley groats and more) is a staple of Polish cooking.' },
  'u1-06': { en: 'Kasia (nickname for Katarzyna)', tip: 'ś (and si before a vowel) is a soft "sh": tongue tip behind the lower teeth, the middle of the tongue raised to the palate, lips spread in a smile. A thin sound, close to "shy".' },
  'u1-07': { en: 'aunt', tip: 'ć (and ci before a vowel) is a soft "ch": tongue pressed forward, its middle touching the front palate, lips smiling. Unlike cz: no lip rounding and no pulling back.' },
  'u1-08': { en: 'winter', tip: 'zi (= ź) is a soft "zh": same position as ś – tongue forward, smile – but voiced. It is neither an English z nor the hard ż.' },
  'u1-09': { en: 'summer', tip: 'Polish l is a clear l: the tongue tip touches the ridge behind the upper teeth. Do not confuse it with ł.' },
  'u1-10': { en: 'easily / easy', tip: 'ł is English w (as in "water"): round the lips and keep the tongue low, away from the teeth. Note: w after t loses its voice and sounds like f.' },
  'u1-11': { en: 'water', tip: 'Polish w is always v: upper teeth lightly on the lower lip. Never pronounce it as English w.' },
  'u1-12': { en: 'hand', tip: 'ę before k or g sounds like "en": say e, let air escape through the nose too and close with a light n. Polish r is rolled – the tongue tip trills against the gum ridge.' },
  'u1-13': { en: 'moustache', tip: 'ą is a nasal o: say o and let air flow through the nose as well, as if starting an n without closing it. Polish y is a "dark" i – say i with the tongue pulled slightly back.' },
  'u1-14': { en: 'I am going', tip: 'At the end of a word ę almost loses its nasality and sounds like a plain e. Do not say "EE-den" – just "EE-deh".' },
  'u1-15': { en: 'happiness / luck', tip: 'szcz = sz + cz in one go, both hard (tongue back, lips rounded). ść = ś + ć, both soft (tongue forward, smile). The whole secret is switching from "back" to "front" in the middle of the word.' },
  'u1-16': { en: 'beetle', tip: 'rz after ch loses its voice and sounds like sz. ą before sz is a nasal o. At the end, a hard szcz. Build the word backwards, step by step.', note: 'This is the famous word from the tongue twister "W Szczebrzeszynie chrząszcz brzmi w trzcinie" – every Polish child knows it, and every foreigner who manages it earns respect.' },
  // Unit 2
  'u2-01': { en: 'Good morning / Good day', tip: 'dzi/dź is a soft "j": tongue forward, smiling lips. Final ń is a soft n – like a tiny "ny". The y in bry is a dark i, tongue slightly back.', note: 'The safest greeting: right for any stranger, in a shop, an office, even an elevator. Used from morning until it gets dark.' },
  'u2-02': { en: 'Hi / Bye (between friends)', tip: 'cz at the start is hard (tongue back, lips rounded), then ść is soft (tongue forward, smile). Switching from hard to soft inside one word is the challenge.', note: 'Only for friends, family, children and younger people your age. Saying Cześć to an official or an older stranger is considered rude.' },
  'u2-03': { en: 'Good evening', tip: 'ó sounds exactly like u ("oo"). wie is a soft v with a light "y" after it. cz is hard – tongue back.' },
  'u2-04': { en: 'Goodbye', tip: 'dz is a smooth "dz" with no vowel inside. nia is a soft n with "y" – like Spanish ñ.', note: 'The polite goodbye. Friends say Cześć or Na razie ("for now").' },
  'u2-05': { en: 'Please / Here you are / Pardon?', tip: 'Final ę sounds like a plain e. sz is hard – tongue back. Short rolled r.', note: 'A magic multi-purpose word: "please" when asking, "here you are" when handing something over, and "yes?" when answering the phone or when you did not hear.' },
  'u2-06': { en: 'Thank you', tip: 'dzię = soft j + nasal e, which before k sounds like "en". The stress is on ku! Final ję is a plain e, not nasal.' },
  'u2-07': { en: 'Excuse me / I am sorry', tip: 'prz: rz after p loses its voice and sounds like sz – "psheh". The stress is on pra. Both hissing sounds here are hard: tongue back.' },
  'u2-08': { en: 'How are you? (to a man, formal)', tip: 'się = soft ś + e: a short, unstressed "shyeh". j sounds like English y.', note: 'Strangers are addressed in the third person: Pan (sir) for a man and Pani (madam) for a woman – with a third-person verb (ma, not masz). This is the right way to address any adult who is not a close friend.' },
  'u2-09': { en: 'How are you? (to a woman, formal)', tip: 'Pani – stress on pa. ni is a short, soft n.' },
  'u2-10': { en: "How are you? / How's it going? (to a friend)", tip: 'masz – hard sz at the end, round your lips. Here the address is second person (ty).', note: 'Second-person address – only for people you are "na ty" with: friends, family, children.' },
  'u2-11': { en: 'My name is {name}', tip: 'imię – soft m: "myeh", and final ę sounds like e. Also: a voiced consonant at the end of a word loses its voice – Dawid sounds like "DAH-veet".', note: 'The phrase uses the name you chose in Settings (in Latin letters). A more formal way to give your surname: Nazywam się… ("My name is…").' },
  'u2-12': { en: 'Nice to meet you', tip: 'ło – ł is English w: "woh", not l!' },
  'u2-13': { en: 'May I help you (sir)?', tip: 'czy opens a yes/no question – hard cz and dark y. ó = u. Final c = "ts".', note: 'Panu is the form "to the gentleman" (a case of Pan). For a woman: Czy mogę Pani pomóc?' },
  'u2-15': {
    en: "I'd like to introduce myself",
    tip: 'chc: a throaty h straight into a soft ch – "khch". ł is w. In the feminine chciałabym the standard stress falls on the third syllable from the end (chcia), because -bym is not counted. przed before st loses its voice: "pshet".',
    note: 'Chciał{bym|abym} ("I would like") is the polite way to ask for anything – much softer than chcę ("I want"). A man says chciałbym, a woman chciałabym.',
  },
  'u2-14': { en: 'Shall we switch to "ty" (first names)?', tip: 'prz = "psh". dź is soft – a "j" with a smile. ty = t followed by a dark y.', note: 'Switching from Pan/Pani to ty is a small ritual: usually the older, more senior person or the woman offers it, sometimes with a toast. Never switch to ty on your own.' },
  // Unit 3
  'u3-01': { en: 'one (1)', tip: 'Polish j is always English y. The stress is on je – the second-to-last syllable.' },
  'u3-02': { en: 'two (2)', tip: 'w after d stays voiced: "dvah". Do not put a vowel between d and w.' },
  'u3-03': { en: 'three (3)', tip: 'rz after t loses its voice and sounds like sz: "tshih" – not "trzee". The final y is dark.' },
  'u3-04': { en: 'four (4)', tip: 'Hard cz immediately followed by t – no vowel between them. Final y is dark.' },
  'u3-05': { en: 'five (5)', tip: 'ę before ć sounds like a soft "en". Final ć is a soft ch – tongue forward, smile.' },
  'u3-06': { en: 'Monday', tip: 'dzia – soft j, tongue forward. łek – ł like English w. The stress is on dzia, the second-to-last syllable, even in such a long word.', note: 'The Polish week starts on Monday. poniedziałek means "after Sunday" (niedziela).' },
  'u3-07': { en: 'Tuesday', tip: 'Devoicing! w before t (voiceless) becomes f. Say "FTOH-rek", not "VTOH-rek". This is a fixed rule: a voiced consonant adapts to the voiceless one after it.', note: 'wtorek comes from wtóry – "the second" (second day of the week).' },
  'u3-08': { en: 'Wednesday', tip: 'Soft ś: tongue forward and smile, a thin sound – definitely not sz. Then a rolled r right after.', note: 'środa = "middle" – the middle of the week.' },
  'u3-09': { en: 'Thursday', tip: 'Devoicing again: w after cz (voiceless) sounds like f – "CHFAR-tek". Hard cz.', note: 'czwartek comes from czwarty – "the fourth".' },
  'u3-10': { en: 'What time is it?', tip: 'ó = u. dzi – soft j. In fast speech the t of jest is barely heard.' },
  'u3-11': { en: 'Where is the train station?', tip: 'gdzie = g followed right away by soft dź: "gjeh", no vowel between g and dź. rz here sits between vowels, so it is voiced: "zh".' },
  'u3-12': { en: 'to the right', tip: 'w before p loses its voice: say a short f glued to the word – "fPRAH-voh".' },
  'u3-13': { en: 'to the left', tip: 'Here w before l (a voiced sound) stays v: "vLEH-voh". Compare with w prawo.' },
  'u3-14': { en: 'straight ahead', tip: 'Short rolled r. The stress is on pro.' },
  'u3-15': { en: 'bus / tram stop', tip: 'prz = "psh" (rz loses its voice after p). The stress is on sta.' },
  'u3-16': { en: 'today', tip: 'dzi – soft j. siaj – soft ś followed by "eye". Both syllables are "smiling".' },
  'u3-17': { en: 'tomorrow', tip: 'tr together, no vowel between them. Rolled r.' },
  // Unit 4
  'u4-01': { en: "I'd like a coffee, please", tip: 'The final ę in both words is a plain e. Hard sz. Stress on pro and on ka.', note: 'In Poland you do not tell a waiter "I want" (chcę) – it sounds rude. Say Poproszę + the dish.' },
  'u4-02': { en: 'What do you recommend (sir)?', tip: 'Polish c is always "ts", even at the start of a word: co = "tsoh", never "koh".', note: 'Waiters and waitresses are addressed as Pan/Pani. To a waitress: Co Pani poleca?' },
  'u4-03': { en: 'A table for two', tip: 'ó = u. The b at the end of osób loses its voice and sounds like p: "OH-soop". ch = a throaty h.' },
  'u4-04': { en: "I'll have pierogi", tip: 'mnie = m followed right away by soft n: "mnyeh". pie = p followed by "yeh".', note: 'pierogi (dumplings) are a national dish. ruskie = potato and cheese, z mięsem = with meat.' },
  'u4-05': { en: 'Sparkling or still water?', tip: 'Even in a long word the stress stays on the second-to-last syllable: wa. Here czy means "or".', note: 'The waiter will almost always ask you this when you order water.' },
  'u4-06': { en: 'Enjoy your meal!', tip: 'Hard cz at the end of the first syllable, then n right away. Stress on ne.' },
  'u4-07': { en: 'The bill, please', tip: 'ch = a soft throaty h. Stress on chu.', note: 'In a restaurant the bill does not come until you ask. A usual tip: about 10%.' },
  'u4-08': { en: 'Can I pay by card?', tip: 'pła = p followed by ł (English w). cić = two soft "ch" sounds with a smile. Final ą is a nasal o: a soft "tohn".' },
  'u4-09': { en: 'How much is it?', tip: 'Hard sz in the middle of the word, then t. Stress on tu.' },
  'u4-10': { en: 'Where is the milk?', tip: 'ml at the start of a word – no vowel between them. gdzie = "gjeh".' },
  'u4-11': { en: 'Do you need a bag (madam)?', tip: 'trz = "tsh" (rz loses its voice after t). The final y of torby is dark.', note: 'Shopping bags cost money. The cashier addresses you as Pani (or Pan to a man). Answer Tak, poproszę or Nie, dziękuję.' },
  'u4-12': { en: 'Keep the change', tip: 'trze = "tsheh". Hard sz in reszty.', note: 'The elegant way to tip in cash: hand over a note and say Reszty nie trzeba.' },
  'u4-13': { en: 'Do you feel like a coffee?', tip: 'ochotę – ch = throaty h, final ę = e. masz – hard sz.', note: 'Formally you would say: Czy ma Pan/Pani ochotę na kawę?' },
};
