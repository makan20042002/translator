#!/bin/sh
# Runs every translation check; appends one JSON line per model to $1.
OUT=$1; CACHE=$2; cd "$(dirname "$0")"
ALL="en>fa,fa>en,en>ar,ar>en,en>tr,tr>en,en>de,de>en,en>fr,fr>en,en>es,es>en,en>ru,ru>en"
node translate-check.mjs Xenova/nllb-200-distilled-600M nllb "$ALL" $CACHE >> $OUT
node translate-check.mjs Xenova/m2m100_418M m2m100 "$ALL" $CACHE >> $OUT
node translate-check.mjs Xenova/mbart-large-50-many-to-many-mmt mbart "$ALL" $CACHE >> $OUT
for p in en-ar ar-en en-de de-en en-fr fr-en en-es es-en en-ru ru-en; do
  node translate-check.mjs Xenova/opus-mt-$p opus "$(echo $p | sed 's/-/>/')" $CACHE >> $OUT
done
node translate-check.mjs Xenova/opus-mt-tr-en opus "tr>en" $CACHE >> $OUT
node translate-check.mjs onnx-community/opus-mt-tc-big-en-tr opus "en>tr" $CACHE >> $OUT
node translate-check.mjs onnx-community/opus-mt-tc-big-tr-en opus "tr>en" $CACHE >> $OUT
echo done > $OUT.done
