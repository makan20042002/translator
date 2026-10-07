# Offline Dictionary Pack

This pack is made from Kaikki/Wiktextract JSONL data.

## Files

- `pack.json`: metadata, counts, compression and chunk list.
- `chunk-0001.json.gz`, etc.: dictionary entries.
- `phrases-0001.json.gz`, etc.: phrases/proverbs/idiomatic phrase entries.
- `credits.txt`: source, attribution and licensing information.

## Entry format

Each dictionary entry looks like:

```json
{
  "headword": "example",
  "lookup": "example",
  "pos": "noun",
  "meanings": ["..."],
  "example": "...",
  "forms": [
    {"form": "examples", "tags": ["plural"]}
  ]
}
```

`headword` is the original display spelling. `lookup` is the normalized
search key.

For Persian lookup, the builder:
- maps Arabic Yeh to Persian Yeh;
- maps Arabic Kaf to Persian Kaf;
- removes the zero-width non-joiner;
- removes Arabic/Persian diacritic marks;
- removes tatweel.

The displayed `headword` is never changed.

`forms` are common inflectional forms found in the source. The browser can
index each `forms[].form` to the parent `headword`.

## Browser / IndexedDB strategy

1. Fetch `pack.json`.
2. Fetch each `chunk-*.json.gz`.
3. Decompress one chunk at a time.
4. Parse its JSON object.
5. Put each entry in IndexedDB keyed by `lookup + "|" + pos`.
6. Put every inflection form into a second lookup store pointing to the
   parent headword.
7. Load `phrases-*.json.gz` into a separate phrase store.
8. Never load the entire pack into JavaScript memory at once.

The chunk size is 1,000 entries.

## Important

This is lexical dictionary data, not a sentence-level machine-translation
model. It supplies lexical equivalents, definitions/examples where the
source provides them, and inflectional forms available in the source.
