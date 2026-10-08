# Finglish (Persian written in Latin letters)

Example: `salam khoobi mikham harf bezanam`.

**Where the code is.** `extension/engine.js` (shared by the web app and the extension): `detectFinglish(text, src)` and
`prepareFinglish(text, src, cfg, { chain })`. The web app calls them from `finglishStep()` in `index.html`; the extension
through the background action `finglish` (used by the selection card and the popup).

**Detection** is a plain word-list check, no AI and no network:
* The text must be Latin letters only: any Persian/Arabic script, or accented letters (Turkish, German, French…), means "not Finglish".
* Words are counted against a list of Finglish words (`salam`, `khoobi`, `mikham`, `chetori`…), verb shapes (`mi-`/`nemi-` + stem + ending,
  such as `nemidoonam`), and a short list of words that are Finglish *and* real words elsewhere (`man`, `to`, `ke`…) which count for little.
  Common English, Turkish, German, French, Spanish, Italian and Portuguese words count against.
* With **Detect language** at least 40 % of the words must be Finglish; with **Persian** as the source 25 %, because Latin letters already
  point to Finglish. Any other source language is never converted. The **Finglish** choice in the source list always converts (for cases
  detection misses) unless the text is already in Persian script.
* One-word texts count only if the word is in the Finglish list (so an English word like "age" is never converted in the Dictionary).

**Conversion** is one AI request (`FINGLISH_TO_PERSIAN`, answer `{"persian": "..."}`). The Persian spelling is shown above the translation
with a Copy button, and the translation starts from it. With Persian as the target, the conversion is the result. Without an AI engine one line
says Finglish needs one, and nothing is sent to a non-AI engine. In the extension, Ollama counts as an AI engine only if it answers.

**Limits.** Informal spelling varies enormously and the list is finite: unusual spellings may be missed (use the Finglish choice), and a
Finglish text made mostly of ambiguous words may not be recognised. Mixed English/Finglish chat is treated as English. The AI's Persian spelling
is its best guess; check names and slang.
