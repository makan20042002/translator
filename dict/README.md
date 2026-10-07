# Offline Dictionary Packs

Generated from Kaikki/Wiktextract.

Each language pair has three requested sizes:
10,000, 30,000 and 100,000 headword entries. If a language has fewer
qualifying entries, the largest pack contains everything available and
`pack.json` reports the real count.

The packs are split into 1,000-entry gzip-compressed JSON chunks for
browser/IndexedDB ingestion.

The entry ranking uses the `wordfreq` Python package as a separate frequency
layer. The frequency numbers themselves are not included in the packs.

To add another supported language, rerun for example:

    py build_dictionary.py --languages en,fa,de

For N languages this builds every pair in both directions.
