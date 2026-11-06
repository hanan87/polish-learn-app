/** Texts of the "Dla Kasi" dedication screen (Polish with Hebrew and English translations). */

export interface KasiaLine {
  pl: string;
  he: string;
  en: string;
}

export const KASIA_TITLE: KasiaLine = {
  pl: 'Kasiu, jesteś moim małym aniołkiem',
  he: 'קאשה, את המלאכית הקטנה שלי',
  en: 'Kasia, you are my little angel',
};

export const KASIA_DEDICATION: KasiaLine = {
  pl: 'Stworzyłem tę aplikację specjalnie dla Ciebie. Uczę się każdego polskiego słowa, bo bardzo Cię kocham i chcę być bliżej Ciebie. Jesteś moim najpiękniejszym powodem do nauki!',
  he: 'בניתי את האפליקציה הזו במיוחד בשבילך. אני לומד כל מילה בפולנית כי אני אוהב אותך כל כך ורוצה להיות קרוב יותר אלייך. את הסיבה הכי יפה שלי ללמוד!',
  en: 'I built this app especially for you. I am learning every Polish word because I love you so much and want to be closer to you. You are my most beautiful reason to learn!',
};

export const KASIA_COMPLIMENTS: KasiaLine[] = [
  { pl: 'Twój uśmiech to mój ulubiony język.', he: 'החיוך שלך הוא השפה האהובה עליי.', en: 'Your smile is my favourite language.' },
  { pl: 'Jesteś moim aniołem stróżem.', he: 'את המלאך השומר שלי.', en: 'You are my guardian angel.' },
  { pl: 'Kasieńko, kocham Cię najbardziej na świecie.', he: 'קאשנקו, אני אוהב אותך יותר מכל דבר בעולם.', en: 'Kasieńka, I love you more than anything in the world.' },
  { pl: 'Przy Tobie każdy dzień jest piękniejszy.', he: 'לצידך כל יום יפה יותר.', en: 'With you, every day is more beautiful.' },
  { pl: 'Twoje oczy świecą jaśniej niż gwiazdy.', he: 'העיניים שלך זורחות יותר מהכוכבים.', en: 'Your eyes shine brighter than the stars.' },
  { pl: 'Jesteś najsłodszą dziewczyną na świecie.', he: 'את הבחורה הכי מתוקה בעולם.', en: 'You are the sweetest girl in the world.' },
  { pl: 'Myślę o Tobie od rana do nocy.', he: 'אני חושב עלייך מהבוקר עד הלילה.', en: 'I think of you from morning till night.' },
  { pl: 'Jesteś całym moim szczęściem.', he: 'את כל האושר שלי.', en: 'You are all my happiness.' },
];
