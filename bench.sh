#!/bin/bash

RNAMOTIF=../rnamotif
TIME="/usr/bin/time"

OUT=benchmark.csv

echo "descriptor,molecule,length,matches,time_s" > "$OUT"

for descr in descriptors/*.descr
do

    desc=$(basename "$descr" .descr)

    for mol in molecules/*.fa
    do

        name=$(basename "$mol" .fa)

        length=$(grep -v "^>" "$mol" | tr -d '\n' | wc -c)

        tmp=$(mktemp)

        $TIME -f "%e" -o "$tmp" \
            $RNAMOTIF -descr "$descr" "$mol" > matches.tmp

        runtime=$(cat "$tmp")

        matches=$(grep -cv '^$' matches.tmp)

        echo "$desc,$name,$length,$matches,$runtime" >> "$OUT"

        rm -f "$tmp"
        rm -f matches.tmp

    done

done