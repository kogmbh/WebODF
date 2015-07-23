#!/bin/bash

if [ y"$1" == "y--help" -o y"$1" == "y--version" ]; then
    echo "WebODF conversion tool webodf-odf-to-exported.sh"
    echo "Version 0.1"
    exit
fi
inpath=${1:?supply input ODT file path as arg1};
outpath=${2:?supply output file path as arg2};
format=${3:-png};
EXPORTODF=0

SCRIPTDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
QTJSRUNTIME="$SCRIPTDIR/../qtjsruntime"

export THEODFOPUTPUTPATH="$outpath"

[[ $outpath == *.pdf ]] && format=pdf
if [[ $outpath == *.odt ]]; then
    format=pdf
    EXPORTODF=1
    outpath="$outpath.pdf"
fi    
    
export THEODFFILEPATH="$inpath"
export WEBODFJSPATH="$SCRIPTDIR/../../../webodf/webodf.js"
export EXPORTODF
cat "$SCRIPTDIR/index.html.in" | envsubst >| /tmp/thepage.html

echo $QTJSRUNTIME --export-$format $outpath /tmp/thepage.html
$QTJSRUNTIME --export-$format $outpath /tmp/thepage.html

