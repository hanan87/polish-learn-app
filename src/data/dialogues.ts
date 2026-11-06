import type { Formality } from './types';

/**
 * Interactive voice roleplay scenarios. Each turn: the Polish partner says a line (auto-played),
 * the learner picks one of 2–3 replies and must then SAY it; the conversation advances once the
 * pronunciation passes. Syllables and transcriptions are generated from the Polish text.
 *
 * Text may contain learner templates (lib/personalize): {masculine|feminine} and {name}. Partner
 * lines use them to address the learner (Pan/Pani), replies use them for the learner's own gender.
 */

export interface Bilingual {
  he: string;
  en: string;
}

export interface RoleplayOption {
  polish: string;
  t: Bilingual;
  correct: boolean;
  feedback: Bilingual;
}

export interface RoleplayTurn {
  line: { polish: string; t: Bilingual };
  options: RoleplayOption[];
}

export interface Roleplay {
  id: string;
  title: Bilingual;
  setting: Bilingual;
  partner: Bilingual;
  register: Formality;
  turns: RoleplayTurn[];
}

const ok = (polish: string, he: string, en: string, fbHe: string, fbEn: string): RoleplayOption => ({
  polish,
  t: { he, en },
  correct: true,
  feedback: { he: fbHe, en: fbEn },
});
const no = (polish: string, he: string, en: string, fbHe: string, fbEn: string): RoleplayOption => ({
  polish,
  t: { he, en },
  correct: false,
  feedback: { he: fbHe, en: fbEn },
});
const line = (polish: string, he: string, en: string) => ({ polish, t: { he, en } });

export const ROLEPLAYS: Roleplay[] = [
  {
    id: 'warsaw-cafe',
    title: { he: 'בית קפה בוורשה', en: 'A café in Warsaw' },
    setting: {
      he: 'נכנסתם לבית קפה ליד כיכר העיר העתיקה בוורשה. הבריסטה לא מכירה אתכם – לכן מדברים ברשמיות.',
      en: 'You walk into a café near the Old Town Square in Warsaw. The barista does not know you, so keep it formal.',
    },
    partner: { he: 'הבריסטה', en: 'Barista' },
    register: 'formal',
    turns: [
      {
        line: line('Dzień dobry! Co podać?', 'יום טוב! מה להגיש?', 'Good morning! What can I get you?'),
        options: [
          ok('Poproszę kawę z mlekiem.', 'אבקש קפה עם חלב.', "I'd like a coffee with milk, please.", 'מושלם: Poproszę המנומס ואחריו ההזמנה.', 'Perfect: the polite Poproszę followed by your order.'),
          no('Cześć, chcę kawę.', 'היי, אני רוצה קפה.', 'Hi, I want coffee.', 'Cześć מתאים רק לחברים, ו-chcę ("אני רוצה") נשמע גס מול בריסטה.', 'Cześć is only for friends, and chcę ("I want") sounds blunt to a barista.'),
        ],
      },
      {
        line: line('Dużą czy małą?', 'גדול או קטן?', 'Large or small?'),
        options: [
          ok('Dużą, proszę.', 'גדול, בבקשה.', 'Large, please.', 'נכון! dużą מתאים ל-kawa (נקבה).', 'Right! dużą agrees with kawa (feminine).'),
          no('Dobry wieczór.', 'ערב טוב.', 'Good evening.', 'זו ברכה, לא תשובה לשאלה.', 'That is a greeting, not an answer.'),
          no('Trzy.', 'שלוש.', 'Three.', 'נשאלתם על גודל, לא על כמות.', 'You were asked about size, not quantity.'),
        ],
      },
      {
        line: line('Na miejscu czy na wynos?', 'לשבת כאן או לקחת?', 'For here or to go?'),
        options: [
          ok('Na wynos, proszę.', 'לקחת, בבקשה.', 'To go, please.', 'בדיוק. na wynos = לקחת איתכם.', 'Exactly. na wynos = to take away.'),
          no('W prawo.', 'ימינה.', 'To the right.', 'w prawo זה כיוון – לא מתאים כאן.', 'w prawo is a direction – not what was asked.'),
        ],
      },
      {
        line: line('Dwanaście złotych.', 'שנים-עשר זלוטי.', 'Twelve złoty.'),
        options: [
          ok('Czy mogę zapłacić kartą?', 'אפשר לשלם בכרטיס?', 'Can I pay by card?', 'שאלה מנומסת ונכונה. kartą – עם ą בסוף.', 'A polite, correct question. kartą ends with ą.'),
          no('Smacznego!', 'בתיאבון!', 'Enjoy your meal!', 'Smacznego אומרים למי שאוכל – לא כשמשלמים.', 'Smacznego is said to someone eating – not when paying.'),
        ],
      },
      {
        line: line('Oczywiście. Proszę bardzo!', 'כמובן. בבקשה!', 'Of course. Here you are!'),
        options: [
          ok('Dziękuję, do widzenia!', 'תודה, להתראות!', 'Thank you, goodbye!', 'פרידה מנומסת ומושלמת.', 'A perfect polite goodbye.'),
          no('Cześć!', 'ביי!', 'Bye!', 'Cześć לא מתאים לבריסטה שאתם לא מכירים. אמרו Do widzenia.', 'Cześć is too casual for a stranger. Say Do widzenia.'),
        ],
      },
    ],
  },
  {
    id: 'train-ticket',
    title: { he: 'קניית כרטיס רכבת', en: 'Buying a train ticket' },
    setting: {
      he: 'אתם בקופה בתחנת Warszawa Centralna וצריכים להגיע לקרקוב.',
      en: 'You are at the ticket office at Warszawa Centralna and need to get to Kraków.',
    },
    partner: { he: 'הקופאית', en: 'Ticket clerk' },
    register: 'formal',
    turns: [
      {
        line: line('Dzień dobry, słucham?', 'יום טוב, כן?', 'Good morning, how can I help?'),
        options: [
          ok('Dzień dobry, poproszę bilet do Krakowa.', 'יום טוב, אבקש כרטיס לקרקוב.', "Good morning, a ticket to Kraków, please.", 'מצוין: ברכה, Poproszę ויעד.', 'Excellent: greeting, Poproszę and the destination.'),
          no('Gdzie jest mleko?', 'איפה החלב?', 'Where is the milk?', 'אתם בקופת רכבת, לא בסופר.', 'You are at a ticket office, not a supermarket.'),
        ],
      },
      {
        line: line('Normalny czy ulgowy?', 'רגיל או מוזל?', 'Full price or reduced?'),
        options: [
          ok('Normalny, proszę.', 'רגיל, בבקשה.', 'Full price, please.', 'נכון. כרטיס מוזל דורש תעודת סטודנט או פנסיונר.', 'Right. A reduced ticket needs a student or senior ID.'),
          no('Na zdrowie!', 'לחיים!', 'Cheers!', 'Na zdrowie אומרים כשמרימים כוסית או כשמישהו מתעטש.', 'Na zdrowie is for toasts or when someone sneezes.'),
        ],
      },
      {
        line: line('W jedną stronę czy powrotny?', 'כיוון אחד או הלוך-חזור?', 'One way or return?'),
        options: [
          ok('W jedną stronę.', 'כיוון אחד.', 'One way.', 'בדיוק. powrotny = הלוך-חזור.', 'Exactly. powrotny = return.'),
          no('Jutro jest środa.', 'מחר יום רביעי.', 'Tomorrow is Wednesday.', 'נשאלתם על סוג הכרטיס, לא על היום.', 'You were asked about the ticket type, not the day.'),
        ],
      },
      {
        line: line('Sto dwadzieścia złotych. Pociąg odjeżdża z peronu trzeciego.', 'מאה ועשרים זלוטי. הרכבת יוצאת מרציף שלוש.', '120 złoty. The train leaves from platform three.'),
        options: [
          ok('O której odjeżdża pociąg?', 'באיזו שעה יוצאת הרכבת?', 'What time does the train leave?', 'שאלה חשובה ומדויקת.', 'An important and precise question.'),
          no('Poproszę rachunek.', 'את החשבון, בבקשה.', 'The bill, please.', 'rachunek זה חשבון במסעדה. כאן כבר נקבתם מחיר.', 'rachunek is a restaurant bill. Here the price is already given.'),
        ],
      },
      {
        line: line('O dziesiątej piętnaście.', 'בעשר ורבע.', 'At ten fifteen.'),
        options: [
          ok('Dziękuję bardzo, do widzenia!', 'תודה רבה, להתראות!', 'Thank you very much, goodbye!', 'פרידה מנומסת. נסיעה טובה!', 'A polite goodbye. Have a good trip!'),
          no('Cześć, na razie!', 'ביי, נתראה!', 'Bye, see you!', 'פרידה חברית מדי לקופאית.', 'Too casual for a ticket clerk.'),
        ],
      },
    ],
  },
  {
    id: 'taxi-hotel',
    title: { he: 'מונית ומלון', en: 'Taxi & hotel' },
    setting: {
      he: 'נחתתם בוורשה, עליתם למונית לעבר המלון – ובסוף מגיעים לדלפק הקבלה.',
      en: 'You landed in Warsaw, took a taxi to your hotel – and finally reach the reception desk.',
    },
    partner: { he: 'הנהג / פקידת הקבלה', en: 'Driver / Receptionist' },
    register: 'formal',
    turns: [
      {
        line: line('Dzień dobry, dokąd jedziemy?', 'יום טוב, לאן נוסעים?', 'Good afternoon, where are we going?'),
        options: [
          ok('Do hotelu Polonia, proszę.', 'למלון פולוניה, בבקשה.', 'To the Polonia hotel, please.', 'מצוין – do + יעד + proszę.', 'Great – do + destination + proszę.'),
          no('Jestem uczulon{y|a} na orzechy.', 'יש לי אלרגיה לאגוזים.', "I'm allergic to nuts.", 'מידע חשוב – אבל לא לנהג מונית.', 'Important information – but not for a taxi driver.'),
        ],
      },
      {
        line: line('Jasne. Pierwszy raz w Warszawie?', 'בטח. פעם ראשונה בוורשה?', 'Sure. First time in Warsaw?'),
        options: [
          ok('Tak, pierwszy raz.', 'כן, פעם ראשונה.', 'Yes, the first time.', 'תשובה טבעית לשיחת חולין.', 'A natural small-talk answer.'),
          no('Nie trzeba.', 'אין צורך.', 'No need.', 'nie trzeba = "אין צורך" – לא עונה על השאלה.', 'nie trzeba = "no need" – it does not answer the question.'),
        ],
      },
      {
        line: line('Jesteśmy na miejscu. Czterdzieści złotych.', 'הגענו. ארבעים זלוטי.', "We're here. Forty złoty."),
        options: [
          ok('Proszę. Reszty nie trzeba.', 'בבקשה. אין צורך בעודף.', 'Here you are. Keep the change.', 'אלגנטי – כך משאירים טיפ.', 'Elegant – that is how you leave a tip.'),
          no('Ile trwa podróż?', 'כמה זמן נמשכת הנסיעה?', 'How long is the journey?', 'כבר הגעתם!', 'You have already arrived!'),
        ],
      },
      {
        line: line('Dobry wieczór! W czym mogę pomóc?', 'ערב טוב! במה אוכל לעזור?', 'Good evening! How can I help?'),
        options: [
          ok('Dobry wieczór, mam rezerwację na nazwisko Kohen.', 'ערב טוב, יש לי הזמנה על שם כהן.', 'Good evening, I have a reservation under the name Kohen.', 'מושלם לדלפק קבלה.', 'Perfect for a reception desk.'),
          no('Cześć! Co tam?', 'היי! מה קורה?', "Hi! What's up?", 'חברי מדי לפקידת קבלה.', 'Far too casual for a receptionist.'),
        ],
      },
      {
        line: line('Pokój numer dwanaście. Śniadanie jest od siódmej.', 'חדר מספר שתים-עשרה. ארוחת הבוקר מהשעה שבע.', 'Room number twelve. Breakfast is from seven.'),
        options: [
          ok('Dziękuję bardzo!', 'תודה רבה!', 'Thank you very much!', 'נכון – תודה פשוטה וחמה.', 'Right – a simple, warm thank you.'),
          no('Poproszę kawę.', 'אבקש קפה.', "I'd like a coffee.", 'הקפה יחכה לבוקר – עכשיו מודים.', 'Coffee can wait for breakfast – now just say thanks.'),
        ],
      },
    ],
  },
  {
    id: 'meeting',
    title: { he: 'שיחת היכרות', en: 'Getting acquainted' },
    setting: {
      he: 'במסיבת עבודה אתם ({name} מישראל) פוגשים את מרתה. מתחילים ברשמיות – ומחכים שהיא תציע לעבור ל-ty.',
      en: 'At a work party you ({name} from Israel) meet Marta. Start formally – and wait for her to offer switching to ty.',
    },
    partner: { he: 'מרתה', en: 'Marta' },
    register: 'formal',
    turns: [
      {
        line: line('Dzień dobry! Jestem Marta Kowalska.', 'יום טוב! אני מרתה קובלסקה.', "Hello! I'm Marta Kowalska."),
        options: [
          ok('Dzień dobry, miło mi. Mam na imię {name}.', 'יום טוב, נעים מאוד. קוראים לי {name}.', 'Hello, nice to meet you. My name is {name}.', 'הצגה עצמית מנומסת ומושלמת.', 'A perfect polite introduction.'),
          no('Cześć, Marta!', 'היי מרתה!', 'Hi Marta!', 'שם פרטי + Cześć למישהי שרק פגשתם – פמיליארי מדי.', 'First name + Cześć to someone you just met is too familiar.'),
        ],
      },
      {
        line: line('Miło mi. Skąd {Pan|Pani} jest?', 'נעים מאוד. מאיפה {אתה (אדוני)|את (גברתי)}?', 'Nice to meet you. Where are you from?'),
        options: [
          ok('Jestem z Izraela.', 'אני מישראל.', "I'm from Israel.", 'נכון: z + שם המדינה בנטייה.', 'Right: z + the country in the genitive.'),
          no('Jestem uczulon{y|a} na orzechy.', 'יש לי אלרגיה לאגוזים.', "I'm allergic to nuts.", 'לא בדיוק מה שנשאלתם.', 'Not quite what you were asked.'),
        ],
      },
      {
        line: line('Bardzo ciekawie! Czym się {Pan|Pani} zajmuje?', 'מעניין מאוד! במה {אתה עוסק|את עוסקת}?', 'Very interesting! What do you do?'),
        options: [
          ok('Jestem {programistą|programistką}.', 'אני {מתכנת|מתכנתת}.', "I'm a programmer.", 'מצוין. אחרי jestem המקצוע בא בנטיית כלי: {programistą|programistką}.', 'Great. After jestem the job takes the instrumental: {programistą|programistką}.'),
          no('Nie, dziękuję.', 'לא, תודה.', 'No, thank you.', 'זו לא תשובה לשאלה על העבודה שלכם.', 'That does not answer a question about your job.'),
        ],
      },
      {
        line: line('Może przejdźmy na ty? Jestem Marta.', 'אולי נעבור ל-ty? אני מרתה.', 'Shall we switch to ty? I am Marta.'),
        options: [
          ok('Bardzo chętnie! {name}.', 'בשמחה רבה! {name}.', 'Gladly! {name}.', 'כשמציעים לעבור ל-ty מקבלים בשמחה.', 'When someone offers ty, you accept gladly.'),
          no('Nie, dziękuję.', 'לא, תודה.', 'No, thank you.', 'סירוב להצעה לעבור ל-ty נחשב פוגע מאוד בתרבות הפולנית.', 'Refusing an offer to switch to ty is quite hurtful in Polish culture.'),
        ],
      },
      {
        line: line('Super! Masz ochotę na kawę?', 'סופר! בא לך קפה?', 'Great! Do you fancy a coffee?'),
        options: [
          ok('Tak, chętnie!', 'כן, בשמחה!', 'Yes, gladly!', 'עכשיו אתם "na ty" – והשיחה זורמת.', 'Now you are "na ty" – and the conversation flows.'),
          no('Czy ma Pani ochotę na kawę?', 'האם יש לך (גברתי) חשק לקפה?', 'Would you (madam) like a coffee?', 'כבר עברתם ל-ty, ולכן Pani כבר לא מתאים.', 'You already switched to ty, so Pani no longer fits.'),
        ],
      },
    ],
  },
];
