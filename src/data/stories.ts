/**
 * Mini stories: short, funny beginner dialogues (6–8 lines). Every word is tappable; the glossary
 * gives its meaning and, when the ending changed because of Polish grammar (kawa → kawę,
 * mleko → mlekiem), the dictionary form plus a short explanation of why.
 * Each story ends with two comprehension questions that award XP.
 */

export interface Bi {
  he: string;
  en: string;
}

export interface GlossEntry {
  t: Bi;
  /** Dictionary form, when the word in the text is inflected. */
  base?: string;
  /** Why the ending changed (or another short grammar hint). */
  note?: Bi;
}

export interface StoryLine {
  speaker: string;
  polish: string;
  t: Bi;
}

export interface StoryQuestion {
  q: string;
  t: Bi;
  options: { polish: string; t: Bi; correct: boolean }[];
}

export interface Story {
  id: string;
  title: Bi;
  titlePl: string;
  blurb: Bi;
  lines: StoryLine[];
  glossary: Record<string, GlossEntry>;
  questions: [StoryQuestion, StoryQuestion];
}

const g = (he: string, en: string, base?: string, noteHe?: string, noteEn?: string): GlossEntry => ({
  t: { he, en },
  base,
  note: noteHe && noteEn ? { he: noteHe, en: noteEn } : undefined,
});
const L = (speaker: string, polish: string, he: string, en: string): StoryLine => ({ speaker, polish, t: { he, en } });
const o = (polish: string, he: string, en: string, correct = false) => ({ polish, t: { he, en }, correct });

/** Words shared by several stories. */
const COMMON: Record<string, GlossEntry> = {
  dzień: g('יום', 'day', undefined, 'Dzień dobry = יום טוב / שלום.', 'Dzień dobry = good day / hello.'),
  dobry: g('טוב', 'good'),
  nie: g('לא', 'no, not'),
  proszę: g('בבקשה / הנה', 'please / here you are'),
  dziękuję: g('תודה (אני מודה)', 'thank you (I thank)', 'dziękować', 'dziękować → dziękuję: הסיומת ‎-ę מסמנת "אני".', 'dziękować → dziękuję: the ending -ę marks "I".'),
  jest: g('נמצא / יש / הוא', 'is / there is', 'być', 'być (להיות) ← jest: הוא/היא/זה.', 'być (to be) → jest: he / she / it is.'),
  to: g('זה', 'this, it'),
  tu: g('כאן', 'here'),
  ale: g('אבל', 'but'),
  mój: g('שלי', 'my'),
  może: g('אולי', 'maybe'),
  w: g('ב־ (בתוך)', 'in'),
  i: g('ו־', 'and'),
  a: g('ו־ / ואילו', 'and / while'),
  tak: g('כן', 'yes'),
  z: g('עם', 'with'),
  dla: g('בשביל', 'for'),
  bardzo: g('מאוד', 'very'),
  gdzie: g('איפה', 'where'),
  ma: g('יש לו/לה', 'has', 'mieć', 'mieć (להיות בעל) ← ma: יש לו/לה. nie ma = אין.', 'mieć (to have) → ma: he / she has. nie ma = there is no.'),
};

export const STORIES: Story[] = [
  {
    id: 'kawa-dla-kota',
    title: { he: 'קפה בשביל החתול', en: 'Coffee for the cat' },
    titlePl: 'Kawa dla kota',
    blurb: { he: 'תומק מזמין קפה עם חלב… למי בדיוק?', en: 'Tomek orders coffee with milk… for whom exactly?' },
    lines: [
      L('Kelnerka', 'Dzień dobry! Co podać?', 'יום טוב! מה להגיש?', 'Hello! What can I get you?'),
      L('Tomek', 'Poproszę kawę z mlekiem.', 'אבקש קפה עם חלב.', 'A coffee with milk, please.'),
      L('Kelnerka', 'Dużą czy małą?', 'גדול או קטן?', 'Large or small?'),
      L('Tomek', 'Małą. To dla mojego kota.', 'קטן. זה בשביל החתול שלי.', "Small. It's for my cat."),
      L('Kelnerka', 'Kot pije kawę?!', 'החתול שותה קפה?!', 'The cat drinks coffee?!'),
      L('Tomek', 'Nie! Kot pije mleko, a ja piję kawę.', 'לא! החתול שותה חלב, ואני שותה קפה.', 'No! The cat drinks milk, and I drink coffee.'),
      L('Kelnerka', 'Aha! Więc kawa dla Pana i mleko dla kota.', 'אה! אז קפה בשבילך (אדוני) וחלב בשביל החתול.', 'Aha! So coffee for you, sir, and milk for the cat.'),
      L('Tomek', 'Dokładnie! Kot dziękuje.', 'בדיוק! החתול מודה.', 'Exactly! The cat says thank you.'),
    ],
    glossary: {
      co: g('מה', 'what'),
      podać: g('להגיש', 'to serve'),
      poproszę: g('אבקש', "I'd like (please)"),
      kawę: g('קפה', 'coffee', 'kawa', 'kawa → kawę: אחרי poproszę (מה אני מבקש?) הסיומת ‎-a הופכת ל-‎-ę – יחסת מושא.', 'kawa → kawę: after poproszę (what do I ask for?) the ending -a becomes -ę – the accusative.'),
      mlekiem: g('חלב', 'milk', 'mleko', 'mleko → mlekiem: אחרי z ("עם") שם העצם מקבל ‎-em / ‎-iem – יחסת כלי.', 'mleko → mlekiem: after z ("with") the noun takes -em / -iem – the instrumental.'),
      dużą: g('גדול', 'large', 'duża', 'duża → dużą: שם התואר מתאים ל-kawę, ולכן גם הוא מקבל ‎-ą.', 'duża → dużą: the adjective agrees with kawę, so it also takes -ą.'),
      czy: g('או (בשאלה)', 'or (in a question)'),
      małą: g('קטן', 'small', 'mała', 'mała → małą: מתאים ל-kawę (יחסת מושא, נקבה).', 'mała → małą: agrees with kawę (feminine accusative).'),
      mojego: g('שלי', 'my', 'mój', 'mój → mojego: אחרי dla ("בשביל") באה יחסת קניין.', 'mój → mojego: dla ("for") takes the genitive.'),
      kota: g('חתול', 'cat', 'kot', 'kot → kota: אחרי dla מוסיפים ‎-a – יחסת קניין.', 'kot → kota: after dla add -a – the genitive.'),
      kot: g('חתול', 'cat'),
      pije: g('שותה', 'drinks', 'pić', 'pić (לשתות) ← pije: הוא/היא שותה.', 'pić (to drink) → pije: he / she drinks.'),
      mleko: g('חלב', 'milk'),
      ja: g('אני', 'I'),
      piję: g('אני שותה', 'I drink', 'pić', 'pić → piję: אני שותה – הסיומת ‎-ę מסמנת "אני".', 'pić → piję: I drink – the ending -ę marks "I".'),
      aha: g('אה!', 'aha'),
      więc: g('אז', 'so'),
      kawa: g('קפה', 'coffee'),
      pana: g('אדוני', 'sir (you)', 'Pan', 'Pan → Pana: אחרי dla – יחסת קניין.', 'Pan → Pana: after dla – the genitive.'),
      dokładnie: g('בדיוק', 'exactly'),
      dziękuje: g('מודה', 'thanks (he thanks)', 'dziękować', 'dziękuję = אני מודה; dziękuje (בלי ę) = הוא מודה.', 'dziękuję = I thank; dziękuje (no ę) = he thanks.'),
    },
    questions: [
      { q: 'Co pije kot?', t: { he: 'מה החתול שותה?', en: 'What does the cat drink?' }, options: [o('Mleko.', 'חלב.', 'Milk.', true), o('Kawę.', 'קפה.', 'Coffee.'), o('Wodę.', 'מים.', 'Water.')] },
      { q: 'Jaką kawę zamawia Tomek?', t: { he: 'איזה קפה תומק מזמין?', en: 'Which coffee does Tomek order?' }, options: [o('Małą, z mlekiem.', 'קטן, עם חלב.', 'A small one, with milk.', true), o('Dużą, bez mleka.', 'גדול, בלי חלב.', 'A large one, without milk.'), o('Dwie duże.', 'שניים גדולים.', 'Two large ones.')] },
    ],
  },
  {
    id: 'pierogi-babci',
    title: { he: 'הפירוגי של סבתא', en: "Grandma's pierogi" },
    titlePl: 'Pierogi babci',
    blurb: { he: 'אצל סבתא פולנייה אי אפשר להגיד "די".', en: 'At a Polish grandma’s you cannot say "enough".' },
    lines: [
      L('Babcia', 'Kuba, jesteś głodny?', 'קובה, אתה רעב?', 'Kuba, are you hungry?'),
      L('Kuba', 'Trochę, babciu.', 'קצת, סבתא.', 'A little, Grandma.'),
      L('Babcia', 'Proszę, tu są pierogi. Jedz!', 'בבקשה, הנה פירוגי. תאכל!', 'Here, there are pierogi. Eat!'),
      L('Kuba', 'Mmm, są pyszne! Dziękuję.', 'ממ, הם טעימים! תודה.', "Mmm, they're delicious! Thank you."),
      L('Babcia', 'Jeszcze jeden talerz?', 'עוד צלחת אחת?', 'One more plate?'),
      L('Kuba', 'Nie, dziękuję. Już nie mogę.', 'לא, תודה. אני כבר לא יכול.', "No, thank you. I can't any more."),
      L('Babcia', 'Nie ma „nie mogę”! Jedz, jedz!', 'אין דבר כזה "לא יכול"! תאכל, תאכל!', 'There is no "I can\'t"! Eat, eat!'),
      L('Kuba', 'Babciu, ratunku!', 'סבתא, הצילו!', 'Grandma, help!'),
    ],
    glossary: {
      kuba: g('קובה (שם)', 'Kuba (a name)', undefined, 'Kuba הוא כינוי חיבה ל-Jakub (יעקב).', 'Kuba is the nickname for Jakub (Jacob).'),
      jesteś: g('אתה / את', 'you are', 'być', 'być (להיות) ← jesteś: אתה/את.', 'być (to be) → jesteś: you are.'),
      głodny: g('רעב', 'hungry', undefined, 'לאישה אומרים głodna – שם התואר מתאים למגדר.', 'To a woman: głodna – the adjective agrees with gender.'),
      trochę: g('קצת', 'a little'),
      babciu: g('סבתא', 'Grandma', 'babcia', 'babcia → babciu: כשפונים ישירות למישהו, ‎-a הופכת ל-‎-u – יחסת קריאה.', 'babcia → babciu: when you call someone directly, -a becomes -u – the vocative.'),
      są: g('יש (רבים)', 'there are', 'być', 'być → są: הם / הן.', 'być → są: they are.'),
      pierogi: g('פירוגי (כיסונים)', 'pierogi (dumplings)'),
      jedz: g('תאכל!', 'eat!', 'jeść', 'jeść (לאכול) ← jedz: צורת ציווי.', 'jeść (to eat) → jedz: the imperative.'),
      mmm: g('ממ', 'mmm'),
      pyszne: g('טעימים', 'delicious', 'pyszny', 'pyszny → pyszne: רבים, מתאים ל-pierogi.', 'pyszny → pyszne: plural, agrees with pierogi.'),
      jeszcze: g('עוד', 'more, still'),
      jeden: g('אחד', 'one'),
      talerz: g('צלחת', 'plate'),
      już: g('כבר', 'already', undefined, 'już nie = כבר לא.', 'już nie = not any more.'),
      mogę: g('אני יכול', 'I can', 'móc', 'móc (לייכול) ← mogę: אני יכול/ה.', 'móc (to be able) → mogę: I can.'),
      ratunku: g('הצילו!', 'help!', 'ratunek', 'ratunek (הצלה) ← ratunku: בקריאה לעזרה משתמשים ביחסת קניין.', 'ratunek (rescue) → ratunku: a cry for help uses the genitive.'),
    },
    questions: [
      { q: 'Co je Kuba?', t: { he: 'מה קובה אוכל?', en: 'What is Kuba eating?' }, options: [o('Pierogi.', 'פירוגי.', 'Pierogi.', true), o('Zupę.', 'מרק.', 'Soup.'), o('Chleb.', 'לחם.', 'Bread.')] },
      { q: 'Czy Kuba chce jeszcze jeden talerz?', t: { he: 'האם קובה רוצה עוד צלחת?', en: 'Does Kuba want another plate?' }, options: [o('Nie, już nie może.', 'לא, הוא כבר לא יכול.', 'No, he cannot any more.', true), o('Tak, bardzo.', 'כן, מאוד.', 'Yes, very much.'), o('Tak, dwa talerze.', 'כן, שתי צלחות.', 'Yes, two plates.')] },
    ],
  },
  {
    id: 'gdzie-jest-bilet',
    title: { he: 'איפה הכרטיס?', en: 'Where is the ticket?' },
    titlePl: 'Gdzie jest bilet?',
    blurb: { he: 'ביקורת כרטיסים ברכבת, ואולה מחפשת בכל מקום.', en: 'A ticket check on the train, and Ola searches everywhere.' },
    lines: [
      L('Konduktor', 'Dzień dobry, bilety do kontroli!', 'יום טוב, כרטיסים לביקורת!', 'Good morning, tickets please!'),
      L('Ola', 'Dzień dobry. Mój bilet… gdzie jest mój bilet?', 'יום טוב. הכרטיס שלי… איפה הכרטיס שלי?', 'Good morning. My ticket… where is my ticket?'),
      L('Konduktor', 'Nie ma pani biletu?', 'אין לך כרטיס, גברתי?', "You don't have a ticket, madam?"),
      L('Ola', 'Mam! Ale nie wiem, gdzie.', 'יש לי! אבל אני לא יודעת איפה.', "I do! But I don't know where."),
      L('Konduktor', 'Może w kieszeni?', 'אולי בכיס?', 'Maybe in your pocket?'),
      L('Ola', 'Nie… Może w torbie? Też nie…', 'לא… אולי בתיק? גם לא…', 'No… Maybe in the bag? Not there either…'),
      L('Konduktor', 'Proszę pani, bilet jest w pani ręce!', 'גברתי, הכרטיס ביד שלך!', 'Madam, the ticket is in your hand!'),
      L('Ola', 'Och! Przepraszam bardzo!', 'אוי! סליחה רבה!', "Oh! I'm so sorry!"),
    ],
    glossary: {
      bilety: g('כרטיסים', 'tickets', 'bilet', 'bilet → bilety: רבים – מוסיפים ‎-y.', 'bilet → bilety: plural – add -y.'),
      do: g('ל־ / אל', 'to'),
      kontroli: g('ביקורת', 'inspection', 'kontrola', 'kontrola → kontroli: אחרי do הסיומת ‎-a הופכת ל-‎-i – יחסת קניין.', 'kontrola → kontroli: after do, -a becomes -i – the genitive.'),
      bilet: g('כרטיס', 'ticket'),
      pani: g('גברת / את (בנימוס)', 'madam / you (polite)', undefined, 'Pani = פנייה מנומסת לאישה, והפועל בגוף שלישי.', 'Pani = polite "you" for a woman, with the verb in the third person.'),
      biletu: g('כרטיס', 'ticket', 'bilet', 'bilet → biletu: אחרי nie ma ("אין") – יחסת קניין, מוסיפים ‎-u.', 'bilet → biletu: after nie ma ("there is no") – the genitive, add -u.'),
      mam: g('יש לי', 'I have', 'mieć', 'mieć → mam: יש לי.', 'mieć → mam: I have.'),
      wiem: g('אני יודעת', 'I know', 'wiedzieć', 'wiedzieć (לדעת) ← wiem: אני יודע/ת.', 'wiedzieć (to know) → wiem: I know.'),
      kieszeni: g('כיס', 'pocket', 'kieszeń', 'kieszeń → kieszeni: אחרי w ("בתוך") – יחסת מקום.', 'kieszeń → kieszeni: after w ("in") – the locative.'),
      torbie: g('תיק', 'bag', 'torba', 'torba → torbie: אחרי w – יחסת מקום: ‎-ba הופכת ל-‎-bie.', 'torba → torbie: after w – the locative: -ba becomes -bie.'),
      też: g('גם', 'also, either'),
      ręce: g('יד', 'hand', 'ręka', 'ręka → ręce: אחרי w – יחסת מקום: ‎-ka הופכת ל-‎-ce.', 'ręka → ręce: after w – the locative: -ka becomes -ce.'),
      och: g('אוי', 'oh'),
      przepraszam: g('סליחה', 'sorry'),
    },
    questions: [
      { q: 'Gdzie jest bilet?', t: { he: 'איפה הכרטיס?', en: 'Where is the ticket?' }, options: [o('W ręce Oli.', 'ביד של אולה.', "In Ola's hand.", true), o('W torbie.', 'בתיק.', 'In the bag.'), o('W kieszeni.', 'בכיס.', 'In the pocket.')] },
      { q: 'Kto szuka biletu?', t: { he: 'מי מחפש את הכרטיס?', en: 'Who is looking for the ticket?' }, options: [o('Ola.', 'אולה.', 'Ola.', true), o('Konduktor.', 'הכרטיסן.', 'The conductor.'), o('Babcia.', 'סבתא.', 'Grandma.')] },
    ],
  },
  {
    id: 'parasol',
    title: { he: 'המטרייה', en: 'The umbrella' },
    titlePl: 'Parasol',
    blurb: { he: 'יום שמשי בקרקוב… לכמה דקות.', en: 'A sunny day in Kraków… for a few minutes.' },
    lines: [
      L('Marek', 'Jaka ładna pogoda!', 'איזה מזג אוויר יפה!', 'What lovely weather!'),
      L('Ania', 'Tak, ale biorę parasol.', 'כן, אבל אני לוקחת מטרייה.', "Yes, but I'm taking an umbrella."),
      L('Marek', 'Parasol? Przecież jest słońce!', 'מטרייה? הרי יש שמש!', "An umbrella? But it's sunny!"),
      L('Ania', 'To jest Kraków. Tu pogoda szybko się zmienia.', 'זו קרקוב. כאן מזג האוויר משתנה מהר.', 'This is Kraków. The weather changes fast here.'),
      L('Marek', 'Bez sensu. Idziemy!', 'אין בזה היגיון. הולכים!', 'Nonsense. Let’s go!'),
      L('Marek', 'Ojej… pada deszcz!', 'אוי ואבוי… יורד גשם!', 'Oh no… it’s raining!'),
      L('Ania', 'Mówiłam! Chodź pod mój parasol.', 'אמרתי לך! בוא מתחת למטרייה שלי.', 'I told you! Come under my umbrella.'),
      L('Marek', 'Dziękuję. Masz zawsze rację.', 'תודה. את תמיד צודקת.', 'Thanks. You are always right.'),
    ],
    glossary: {
      jaka: g('איזה', 'what (a)', 'jaki', 'jaki → jaka: נקבה, מתאים ל-pogoda.', 'jaki → jaka: feminine, agrees with pogoda.'),
      ładna: g('יפה', 'nice', 'ładny', 'ładny → ładna: נקבה, מתאים ל-pogoda.', 'ładny → ładna: feminine, agrees with pogoda.'),
      pogoda: g('מזג אוויר', 'weather'),
      biorę: g('אני לוקחת', 'I take', 'brać', 'brać (לקחת) ← biorę: אני לוקח/ת.', 'brać (to take) → biorę: I take.'),
      parasol: g('מטרייה', 'umbrella'),
      przecież: g('הרי', 'but, after all'),
      słońce: g('שמש', 'sun'),
      kraków: g('קרקוב', 'Kraków'),
      szybko: g('מהר', 'fast'),
      się: g('(את) עצמו', '(itself)', undefined, 'zmienia się = משתנה (פועל חוזר).', 'zmienia się = changes (reflexive verb).'),
      zmienia: g('משנה', 'changes', 'zmieniać', 'zmieniać → zmienia: הוא/היא משנה.', 'zmieniać → zmienia: he / she / it changes.'),
      bez: g('בלי', 'without'),
      sensu: g('היגיון', 'sense', 'sens', 'sens → sensu: אחרי bez ("בלי") – יחסת קניין, מוסיפים ‎-u. Bez sensu = אין בזה היגיון.', 'sens → sensu: after bez ("without") – the genitive, add -u. Bez sensu = nonsense.'),
      idziemy: g('הולכים', "we go / let's go", 'iść', 'iść (ללכת) ← idziemy: אנחנו הולכים.', 'iść (to go) → idziemy: we go.'),
      ojej: g('אוי ואבוי', 'oh no'),
      pada: g('יורד', 'falls', 'padać', 'pada deszcz = יורד גשם.', 'pada deszcz = it is raining.'),
      deszcz: g('גשם', 'rain'),
      mówiłam: g('אמרתי', 'I said', 'mówić', 'mówić → mówiłam: זמן עבר של אישה. גבר אומר mówiłem.', 'mówić → mówiłam: past tense, said by a woman. A man says mówiłem.'),
      chodź: g('בוא!', 'come!', 'chodzić', 'chodzić → chodź: צורת ציווי.', 'chodzić → chodź: the imperative.'),
      pod: g('מתחת', 'under'),
      masz: g('יש לך', 'you have', 'mieć', 'mieć → masz: יש לך.', 'mieć → masz: you have.'),
      zawsze: g('תמיד', 'always'),
      rację: g('צדק', 'right', 'racja', 'racja → rację: מושא ישיר – ‎-a הופכת ל-‎-ę. Mieć rację = לצדוק.', 'racja → rację: direct object – -a becomes -ę. Mieć rację = to be right.'),
    },
    questions: [
      { q: 'Co bierze Ania?', t: { he: 'מה אניה לוקחת?', en: 'What does Ania take?' }, options: [o('Parasol.', 'מטרייה.', 'An umbrella.', true), o('Kawę.', 'קפה.', 'A coffee.'), o('Bilet.', 'כרטיס.', 'A ticket.')] },
      { q: 'Jaka jest pogoda na końcu?', t: { he: 'מה מזג האוויר בסוף?', en: 'What is the weather like at the end?' }, options: [o('Pada deszcz.', 'יורד גשם.', 'It is raining.', true), o('Jest słońce.', 'יש שמש.', 'It is sunny.'), o('Pada śnieg.', 'יורד שלג.', 'It is snowing.')] },
    ],
  },
];

/** Voice for each story character: Marek reads the men, Zofia the women. */
export const SPEAKER_VOICE: Record<string, 'f' | 'm'> = {
  Kelnerka: 'f',
  Tomek: 'm',
  Babcia: 'f',
  Kuba: 'm',
  Konduktor: 'm',
  Ola: 'f',
  Marek: 'm',
  Ania: 'f',
};

export const speakerVoice = (speaker: string): 'f' | 'm' => SPEAKER_VOICE[speaker] ?? 'f';

/** Lower-case word without surrounding punctuation – the glossary key. */
export function wordKey(token: string): string {
  return token
    .toLocaleLowerCase('pl-PL')
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

export function lookupWord(story: Story, token: string): GlossEntry | undefined {
  const key = wordKey(token);
  return story.glossary[key] ?? COMMON[key];
}

/** Splits "kawa" vs "kawę" into the shared stem and the two different endings. */
export function splitEnding(base: string, form: string): { stem: string; baseEnd: string; formEnd: string } {
  const b = base.toLocaleLowerCase('pl-PL');
  const f = form.toLocaleLowerCase('pl-PL');
  let i = 0;
  while (i < b.length && i < f.length && b[i] === f[i]) i++;
  return { stem: form.slice(0, i), baseEnd: base.slice(i), formEnd: form.slice(i) };
}

export function getStory(id: string): Story | undefined {
  return STORIES.find((s) => s.id === id);
}
