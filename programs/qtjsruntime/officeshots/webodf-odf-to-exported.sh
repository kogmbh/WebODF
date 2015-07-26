#!/bin/bash
#
# webodf-odf-to-exported.sh a script to convert from ODF files to
# various output formats for OfficeShots.org
#
# Usage:
#   webodf-odf-to-exported.sh input.odt output.pdf
#
# The output format is detected from the output filename
#
# Note that --help and --version are used by the OfficeShots code
# to detect this script so these options should exist.
#

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
    # writing back to an odt file still produces
    # a pdf output as a side effect.
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
exit 0
