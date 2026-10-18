// What a person reads about each model. Sizes, file lists, speed and memory are NOT written here:
// build-catalog.mjs takes them from the Hugging Face API and from results/*.jsonl, and lists a model
// only if a successful test run for it is on file.
const WHISPER_LANGS = { en: '99 languages (Persian, Arabic, Turkish, German, French, Spanish, Russian and more)', fa: '۹۹ زبان (فارسی، عربی، ترکی، آلمانی، فرانسوی، اسپانیایی، روسی و ...)' };
export const WHISPER = [
  { key: 'tiny',  repo: 'Xenova/whisper-tiny',  name: 'Whisper Tiny',  weak: true,  gpu: 'old',
    good: { en: 'Fastest and smallest. Fine for short English dictation on a slow computer.', fa: 'سریع‌ترین و کوچک‌ترین. برای دیکته‌ی کوتاه انگلیسی روی رایانه‌ی کند مناسب است.' } },
  { key: 'base',  repo: 'Xenova/whisper-base',  name: 'Whisper Base',  weak: true,  gpu: 'old',
    good: { en: 'The default. Good English, quick on most computers; weak in Persian and other languages.', fa: 'پیش‌فرض. انگلیسی خوب و روی بیشتر رایانه‌ها سریع؛ در فارسی و زبان‌های دیگر ضعیف.' } },
  { key: 'small', repo: 'Xenova/whisper-small', name: 'Whisper Small', rec: true, gpu: 'old',
    good: { en: 'First size that handles Persian, Arabic and Turkish properly. The best balance of accuracy and waiting time for most people.', fa: 'اولین اندازه‌ای که فارسی، عربی و ترکی را درست تشخیص می‌دهد. برای بیشتر کاربران بهترین تعادل دقت و زمان انتظار.' } },
  { key: 'medium', repo: 'Xenova/whisper-medium', name: 'Whisper Medium', rec: true, gpu: null,
    good: { en: 'More accurate than Small, but slow and heavy on memory. Use it when Small makes mistakes.', fa: 'دقیق‌تر از Small ولی کند و پرمصرف از نظر حافظه. وقتی Small اشتباه می‌کند.' } },
  { key: 'large-v3-turbo', repo: 'onnx-community/whisper-large-v3-turbo', name: 'Whisper Large v3 Turbo', rec: true, gpu: 'turbo',
    good: { en: 'Best accuracy offered here. Large download, and slow without WebGPU: best for short clips when Small makes mistakes.', fa: 'بهترین دقت در این فهرست. دانلود بزرگ و بدون WebGPU کند است: برای کلیپ‌های کوتاه، وقتی Small اشتباه می‌کند.' } },
  { key: 'large-v3', repo: 'onnx-community/whisper-large-v3-ONNX', name: 'Whisper Large v3', rec: true, gpu: 'large-v3',
    good: { en: 'Best accuracy, slower than Turbo.', fa: 'بهترین دقت، کندتر از Turbo.' } }
].map(m => ({ ...m, langs: WHISPER_LANGS }));

export const TRANSLATE = [
  { id: 'tr-nllb-600', kind: 'nllb', repo: 'Xenova/nllb-200-distilled-600M', name: 'NLLB-200 600M (default)',
    langs: { en: '200 languages (38 offered in this app)', fa: '۲۰۰ زبان (۳۸ زبان در این برنامه)' },
    good: { en: 'The default offline translator. Best quality of the offline models here, across many languages.', fa: 'مترجم آفلاین پیش‌فرض. بهترین کیفیت بین مدل‌های آفلاین این فهرست، در زبان‌های زیاد.' } },
  { id: 'tr-m2m100-418', kind: 'm2m100', repo: 'Xenova/m2m100_418M', name: 'M2M-100 418M',
    langs: { en: '100 languages supported; English, Persian, Arabic, Turkish, German, French, Spanish and Russian are enabled and were tested', fa: '۱۰۰ زبان؛ انگلیسی، فارسی، عربی، ترکی، آلمانی، فرانسوی، اسپانیایی و روسی فعال و آزمایش شده‌اند' },
    good: { en: 'Smaller and faster than NLLB, but clearly rougher. A second opinion or a lighter option.', fa: 'کوچک‌تر و سریع‌تر از NLLB ولی به‌وضوح خام‌تر. نظر دوم یا گزینه‌ی سبک‌تر.' } },
  { id: 'tr-mbart50', kind: 'mbart', repo: 'Xenova/mbart-large-50-many-to-many-mmt', name: 'mBART-50 many-to-many',
    langs: { en: '50 languages supported; English, Persian, Arabic, Turkish, German, French, Spanish and Russian are enabled and were tested', fa: '۵۰ زبان؛ انگلیسی، فارسی، عربی، ترکی، آلمانی، فرانسوی، اسپانیایی و روسی فعال و آزمایش شده‌اند' },
    good: { en: 'A different model family with fluent output; useful when NLLB words something badly. Largest translation download here.', fa: 'خانواده‌ای دیگر با خروجی روان؛ وقتی NLLB جمله را بد می‌سازد. بزرگ‌ترین دانلود ترجمه در این فهرست.' } }
];
const PAIR_GOOD = { en: 'Small and fast, for this one direction only.', fa: 'کوچک و سریع، فقط برای همین یک جهت.' };
export const PAIRS = [
  ['en','ar','Xenova/opus-mt-en-ar'], ['ar','en','Xenova/opus-mt-ar-en'],
  ['en','de','Xenova/opus-mt-en-de'], ['de','en','Xenova/opus-mt-de-en'],
  ['en','fr','Xenova/opus-mt-en-fr'], ['fr','en','Xenova/opus-mt-fr-en'],
  ['en','es','Xenova/opus-mt-en-es'], ['es','en','Xenova/opus-mt-es-en'],
  ['en','ru','Xenova/opus-mt-en-ru'], ['ru','en','Xenova/opus-mt-ru-en'],
  ['tr','en','Xenova/opus-mt-tr-en']
].map(([a, b, repo]) => ({ id: `tr-opus-${a}-${b}`, kind: 'opus', pair: [a, b], repo, name: `OPUS-MT ${a.toUpperCase()} → ${b.toUpperCase()}`, good: PAIR_GOOD }));

export const NAMES = { en: 'English', fa: 'Persian', ar: 'Arabic', tr: 'Turkish', de: 'German', fr: 'French', es: 'Spanish', ru: 'Russian' };

// Offline voices (Piper). Datasets: amir, ganji, ljspeech, cori and kristin are CC0 / public domain; alba is CC BY 4.0 (credit in the app's About & credits).
export const VOICES = [
  { id: 'tts-fa-amir', lang: 'fa', path: 'fa/fa_IR/amir/medium/fa_IR-amir-medium', name: { en: 'Persian · Amir (male)', fa: 'فارسی · امیر (مرد)' },
    langs: { en: 'Persian', fa: 'فارسی' }, good: { en: 'Reads Persian aloud with no internet, no Gemini key and no voice installed in Windows.', fa: 'متن فارسی را بدون اینترنت، بدون کلید Gemini و بدون صدای نصب‌شده در ویندوز می‌خواند.' }, licence: 'CC0' },
  { id: 'tts-fa-ganji', lang: 'fa', path: 'fa/fa_IR/ganji/medium/fa_IR-ganji-medium', name: { en: 'Persian · Ganji (unknown)', fa: 'فارسی · گنجی (نامشخص)' },
    langs: { en: 'Persian', fa: 'فارسی' }, good: { en: 'A second Persian voice, for comparison.', fa: 'صدای فارسی دوم، برای مقایسه.' }, licence: 'CC0' },
  { id: 'tts-en-alba', lang: 'en', path: 'en/en_GB/alba/medium/en_GB-alba-medium', name: { en: 'English · Alba (British, female)', fa: 'انگلیسی · آلبا (بریتانیایی، زن)' },
    langs: { en: 'English', fa: 'انگلیسی' }, good: { en: 'Reads English aloud with no internet and no voice installed on the computer.', fa: 'متن انگلیسی را بدون اینترنت و بدون صدای نصب‌شده روی رایانه می‌خواند.' }, licence: 'CC BY 4.0' },
  { id: 'tts-en-ljspeech', lang: 'en', path: 'en/en_US/ljspeech/medium/en_US-ljspeech-medium', name: { en: 'English · LJ Speech (US, female)', fa: 'انگلیسی · ال‌جی اسپیچ (آمریکایی، زن)' },
    langs: { en: 'English', fa: 'انگلیسی' }, good: { en: 'US English female voice from the public domain LJ Speech dataset.', fa: 'صدای زن انگلیسی آمریکایی از مجموعه داده با مالکیت عمومی LJ Speech.' }, licence: 'Public Domain / CC0' },
  { id: 'tts-en-cori', lang: 'en', path: 'en/en_GB/cori/medium/en_GB-cori-medium', name: { en: 'English · Cori (British, female)', fa: 'انگلیسی · کوری (بریتانیایی، زن)' },
    langs: { en: 'English', fa: 'انگلیسی' }, good: { en: 'UK English female voice recorded from LibriVox.', fa: 'صدای زن انگلیسی بریتانیایی ضبط شده از LibriVox.' }, licence: 'Public Domain / CC0' },
  { id: 'tts-en-kristin', lang: 'en', path: 'en/en_US/kristin/medium/en_US-kristin-medium', name: { en: 'English · Kristin (US, female)', fa: 'انگلیسی · کریستین (آمریکایی، زن)' },
    langs: { en: 'English', fa: 'انگلیسی' }, good: { en: 'US English female voice recorded from LibriVox.', fa: 'صدای زن انگلیسی آمریکایی ضبط شده از LibriVox.' }, licence: 'Public Domain / CC0' }
];
