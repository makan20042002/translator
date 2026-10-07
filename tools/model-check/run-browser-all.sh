#!/bin/sh
# Runs browser-check.mjs for every model in the catalogue (one fresh browser each).
CACHE=$1; cd "$(dirname "$0")"
for id in asr-tiny asr-base asr-small asr-large-v3-turbo asr-medium tr-nllb-600 tr-m2m100-418 tr-mbart50 \
  tr-opus-en-ar tr-opus-ar-en tr-opus-en-de tr-opus-de-en tr-opus-en-fr tr-opus-fr-en tr-opus-en-es tr-opus-es-en tr-opus-en-ru tr-opus-ru-en tr-opus-tr-en; do
  timeout 2400 node browser-check.mjs $id $CACHE > /dev/null 2> "results/browser-$id.err.txt" || \
    echo "{\"id\":\"$id\",\"error\":\"browser run failed or timed out; see results/browser-$id.err.txt\"}" >> results/browser.jsonl
done
echo done > results/browser.done
