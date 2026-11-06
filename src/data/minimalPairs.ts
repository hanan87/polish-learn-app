/**
 * Minimal pairs for the Sound Lab: two real words that differ in a single sound
 * that Hebrew speakers tend to merge.
 */

export interface PairWord {
  polish: string;
  syllablesPolish: string;
  english: string;
  hebrew: string;
  phoneticHebrew: string;
}

export interface MinimalPair {
  id: string;
  a: PairWord;
  b: PairWord;
}

export interface ContrastGroup {
  id: string;
  title: string;
  soundA: string;
  soundB: string;
  descriptionA: string;
  descriptionB: string;
  descriptionAEn: string;
  descriptionBEn: string;
  pairs: MinimalPair[];
}

export const CONTRAST_GROUPS: ContrastGroup[] = [
  {
    id: 'sz-s',
    title: 'sz מול ś',
    soundA: 'sz',
    soundB: 'ś',
    descriptionA: 'קשה: קצה הלשון משוך אחורה לחך, השפתיים מעוגלות. צליל עמוק וכהה.',
    descriptionB: 'רכה: קצה הלשון מאחורי השיניים התחתונות, גב הלשון מורם, שפתיים בחיוך. צליל דק.',
    descriptionAEn: 'Hard: tongue tip pulled back to the palate, lips rounded. A deep, dark sound.',
    descriptionBEn: 'Soft: tongue tip behind the lower teeth, middle of the tongue raised, smiling lips. A thin sound.',
    pairs: [
      {
        id: 'sz-s-1',
        a: { polish: 'kasza', syllablesPolish: '[ka]·sza', english: 'groats', hebrew: 'גריסים', phoneticHebrew: '[קָא]·שָׁה' },
        b: { polish: 'Kasia', syllablesPolish: '[Ka]·sia', english: 'Kasia (name)', hebrew: 'קאשה (שם)', phoneticHebrew: '[קָא]·שְׁיָה' },
      },
      {
        id: 'sz-s-2',
        a: { polish: 'proszę', syllablesPolish: '[pro]·szę', english: 'please', hebrew: 'בבקשה', phoneticHebrew: '[פְּרוֹ]·שֶׁה' },
        b: { polish: 'prosię', syllablesPolish: '[pro]·się', english: 'piglet', hebrew: 'חזרזיר', phoneticHebrew: '[פְּרוֹ]·שְׁיֶה' },
      },
      {
        id: 'sz-s-3',
        a: { polish: 'szyna', syllablesPolish: '[szy]·na', english: 'rail', hebrew: 'מסילה', phoneticHebrew: '[שִׁ]·נָה' },
        b: { polish: 'sina', syllablesPolish: '[si]·na', english: 'bruised blue', hebrew: 'כחולה (מחבלה)', phoneticHebrew: '[שְׁיִי]·נָה' },
      },
    ],
  },
  {
    id: 'cz-c',
    title: 'cz מול ć',
    soundA: 'cz',
    soundB: 'ć',
    descriptionA: 'קשה: הלשון משוכה אחורה, שפתיים בולטות קדימה. צ׳ "עבה".',
    descriptionB: 'רכה: הלשון צמודה קדימה, שפתיים בחיוך. צ׳ "דקה" עם רמז של י.',
    descriptionAEn: 'Hard: tongue pulled back, lips pushed forward. A "thick" ch.',
    descriptionBEn: 'Soft: tongue pressed forward, smiling lips. A "thin" ch with a hint of y.',
    pairs: [
      {
        id: 'cz-c-1',
        a: { polish: 'czy', syllablesPolish: '[czy]', english: 'whether / or', hebrew: 'האם', phoneticHebrew: '[צ׳ִ]' },
        b: { polish: 'ci', syllablesPolish: '[ci]', english: 'to you / these', hebrew: 'לך / אלה', phoneticHebrew: '[צִ׳י]' },
      },
      {
        id: 'cz-c-2',
        a: { polish: 'płacz', syllablesPolish: '[płacz]', english: 'crying', hebrew: 'בכי', phoneticHebrew: '[פְּווָאצ׳]' },
        b: { polish: 'płać', syllablesPolish: '[płać]', english: 'pay!', hebrew: 'שלם!', phoneticHebrew: '[פְּווָאצְ׳י]' },
      },
      {
        id: 'cz-c-3',
        a: { polish: 'czapka', syllablesPolish: '[czap]·ka', english: 'cap', hebrew: 'כובע', phoneticHebrew: '[צ׳ָאפּ]·קָה' },
        b: { polish: 'ciapka', syllablesPolish: '[ciap]·ka', english: 'small spot', hebrew: 'כתם קטן', phoneticHebrew: '[צְ׳יָאפּ]·קָה' },
      },
    ],
  },
  {
    id: 'w-l',
    title: 'w מול ł',
    soundA: 'w',
    soundB: 'ł',
    descriptionA: 'w = v: השיניים העליונות נוגעות בשפה התחתונה.',
    descriptionB: 'ł = w אנגלית: שפתיים מעוגלות, בלי מגע של שיניים.',
    descriptionAEn: 'w = v: upper teeth touch the lower lip.',
    descriptionBEn: 'ł = English w: rounded lips, no teeth contact.',
    pairs: [
      {
        id: 'w-l-1',
        a: { polish: 'wata', syllablesPolish: '[wa]·ta', english: 'cotton wool', hebrew: 'צמר גפן', phoneticHebrew: '[בָא]·טָה' },
        b: { polish: 'łata', syllablesPolish: '[ła]·ta', english: 'patch', hebrew: 'טלאי', phoneticHebrew: '[ווָא]·טָה' },
      },
      {
        id: 'w-l-2',
        a: { polish: 'wada', syllablesPolish: '[wa]·da', english: 'flaw', hebrew: 'פגם', phoneticHebrew: '[בָא]·דָה' },
        b: { polish: 'ława', syllablesPolish: '[ła]·wa', english: 'bench', hebrew: 'ספסל', phoneticHebrew: '[ווָא]·בָה' },
      },
    ],
  },
  {
    id: 'l-l',
    title: 'l מול ł',
    soundA: 'l',
    soundB: 'ł',
    descriptionA: 'l = ל׳ רגילה: קצה הלשון נוגע ברכס השיניים.',
    descriptionB: 'ł = w אנגלית: הלשון לא נוגעת בכלל, השפתיים מעוגלות.',
    descriptionAEn: 'l = a clear l: tongue tip touches the gum ridge.',
    descriptionBEn: 'ł = English w: the tongue does not touch anything, lips rounded.',
    pairs: [
      {
        id: 'l-l-1',
        a: { polish: 'lata', syllablesPolish: '[la]·ta', english: 'years', hebrew: 'שנים', phoneticHebrew: '[לָא]·טָה' },
        b: { polish: 'łata', syllablesPolish: '[ła]·ta', english: 'patch', hebrew: 'טלאי', phoneticHebrew: '[ווָא]·טָה' },
      },
      {
        id: 'l-l-2',
        a: { polish: 'laska', syllablesPolish: '[las]·ka', english: 'walking stick', hebrew: 'מקל הליכה', phoneticHebrew: '[לָאס]·קָה' },
        b: { polish: 'łaska', syllablesPolish: '[łas]·ka', english: 'grace', hebrew: 'חסד', phoneticHebrew: '[ווָאס]·קָה' },
      },
    ],
  },
  {
    id: 'z-z',
    title: 'ż מול z',
    soundA: 'ż',
    soundB: 'z',
    descriptionA: 'ż = ז׳ קשה: לשון אחורה, שפתיים מעוגלות, מיתרי קול רוטטים.',
    descriptionB: 'z = ז רגילה, בדיוק כמו בעברית.',
    descriptionAEn: 'ż = hard "zh": tongue back, lips rounded, voiced.',
    descriptionBEn: 'z = a plain z, as in English.',
    pairs: [
      {
        id: 'z-z-1',
        a: { polish: 'żebra', syllablesPolish: '[że]·bra', english: 'ribs', hebrew: 'צלעות', phoneticHebrew: '[ז׳ֶה]·בְּרָה' },
        b: { polish: 'zebra', syllablesPolish: '[ze]·bra', english: 'zebra', hebrew: 'זברה', phoneticHebrew: '[זֶה]·בְּרָה' },
      },
      {
        id: 'z-z-2',
        a: { polish: 'może', syllablesPolish: '[mo]·że', english: 'maybe', hebrew: 'אולי', phoneticHebrew: '[מוֹ]·ז׳ֶה' },
        b: { polish: 'Mozę', syllablesPolish: '[Mo]·zę', english: 'Moza (name, accusative)', hebrew: 'את מוזה (שם)', phoneticHebrew: '[מוֹ]·זֶה' },
      },
    ],
  },
  {
    id: 'nasal',
    title: 'ą / ę מול תנועה רגילה',
    soundA: 'ą',
    soundB: 'a / ę',
    descriptionA: 'ą = o אפית: אומרים o ונותנים לאוויר לברוח גם דרך האף.',
    descriptionB: 'a היא "אָ" רגילה בלי אף; ę היא e אפית ("ֶן").',
    descriptionAEn: 'ą = nasal o: say o and let air escape through the nose too.',
    descriptionBEn: 'a is a plain "ah" without nasality; ę is a nasal e ("en").',
    pairs: [
      {
        id: 'nasal-1',
        a: { polish: 'wąs', syllablesPolish: '[wąs]', english: 'moustache', hebrew: 'שפם', phoneticHebrew: '[בוֹנְס]' },
        b: { polish: 'was', syllablesPolish: '[was]', english: 'you (plural, object)', hebrew: 'אתכם', phoneticHebrew: '[בָאס]' },
      },
      {
        id: 'nasal-2',
        a: { polish: 'mąka', syllablesPolish: '[mą]·ka', english: 'flour', hebrew: 'קמח', phoneticHebrew: '[מוֹנְ]·קָה' },
        b: { polish: 'męka', syllablesPolish: '[mę]·ka', english: 'torment', hebrew: 'ייסורים', phoneticHebrew: '[מֶנְ]·קָה' },
      },
    ],
  },
  {
    id: 'y-i',
    title: 'y מול i',
    soundA: 'y',
    soundB: 'i',
    descriptionA: 'y = i "כהה": הלשון נסוגה מעט אחורה, הפה פחות מחויך.',
    descriptionB: 'i = אִי רגילה וחדה, כמו בעברית.',
    descriptionAEn: 'y = a "dark" i: the tongue pulls back slightly, less smile – like "i" in "bit".',
    descriptionBEn: 'i = a clear, sharp "ee" as in "see".',
    pairs: [
      {
        id: 'y-i-1',
        a: { polish: 'my', syllablesPolish: '[my]', english: 'we', hebrew: 'אנחנו', phoneticHebrew: '[מִ]' },
        b: { polish: 'mi', syllablesPolish: '[mi]', english: 'to me', hebrew: 'לי', phoneticHebrew: '[מִי]' },
      },
      {
        id: 'y-i-2',
        a: { polish: 'byli', syllablesPolish: '[by]·li', english: 'they were', hebrew: 'הם היו', phoneticHebrew: '[בִּ]·לִי' },
        b: { polish: 'bili', syllablesPolish: '[bi]·li', english: 'they were hitting', hebrew: 'הם הרביצו', phoneticHebrew: '[בִּי]·לִי' },
      },
    ],
  },
];
