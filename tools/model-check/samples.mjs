// One fixed sentence per language (same meaning), used by translate-check.mjs.
export const SAMPLES = {
  en: 'The weather is nice today, so we are going to walk in the park.',
  fa: 'امروز هوا خوب است، برای همین به پارک می‌رویم تا قدم بزنیم.',
  ar: 'الطقس جميل اليوم، لذلك سنذهب إلى الحديقة للمشي.',
  tr: 'Bugün hava güzel, bu yüzden parkta yürüyüşe çıkacağız.',
  de: 'Das Wetter ist heute schön, deshalb gehen wir im Park spazieren.',
  fr: "Il fait beau aujourd'hui, alors nous allons nous promener dans le parc.",
  es: 'Hoy hace buen tiempo, así que vamos a pasear por el parque.',
  ru: 'Сегодня хорошая погода, поэтому мы идём гулять в парк.'
};
// Language codes each multilingual model family expects.
export const CODES = {
  nllb:   { en: 'eng_Latn', fa: 'pes_Arab', ar: 'arb_Arab', tr: 'tur_Latn', de: 'deu_Latn', fr: 'fra_Latn', es: 'spa_Latn', ru: 'rus_Cyrl' },
  m2m100: { en: 'en', fa: 'fa', ar: 'ar', tr: 'tr', de: 'de', fr: 'fr', es: 'es', ru: 'ru' },
  mbart:  { en: 'en_XX', fa: 'fa_IR', ar: 'ar_AR', tr: 'tr_TR', de: 'de_DE', fr: 'fr_XX', es: 'es_XX', ru: 'ru_RU' }
};
