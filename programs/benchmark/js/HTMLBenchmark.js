/**
 * @license
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this code.  If not, see <http://www.gnu.org/licenses/>.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

define([
    "Benchmark",
    "HTMLResultsRenderer",
    "OpenDocument",
    "EnterEditMode",
    "MoveCursorToEndDirect",
    "InsertLetterA",
    "RemovePositions",
    "MoveCursorLeft",
    "SelectEntireDocument",
    "RemoveCurrentSelection",
    "PreloadDocument",
    "BoldCurrentSelection",
    "AlignCurrentSelectionJustified",
    "MoveCursorToEnd"
], function (Benchmark, HTMLResultsRenderer,
             OpenDocument, EnterEditMode, MoveCursorToEndDirect,InsertLetterA, RemovePositions, MoveCursorLeft,
             SelectEntireDocument, RemoveCurrentSelection, PreloadDocument, BoldCurrentSelection,
             AlignCurrentSelectionJustified, MoveCursorToEnd) {
    "use strict";

    /**
     * Convert url query parameters into an Object
     * Source: http://stackoverflow.com/a/2880929
     * @return {!Object.<!string, !string>}
     */
    function getQueryParams() {
        var match,
            pl     = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
            query  = window.location.search.substring(1),
            urlParams = {};

        while (match = search.exec(query)) {
            urlParams[decode(match[1])] = decode(match[2]);
        }

        return urlParams;
    }

    /**
     * Extract supported benchmark options from the url query parameters
     * @return {!{fileUrl: !string, includeSlow: !boolean, colour: string|undefined}}
     */
    function getConfiguration() {
        var params = getQueryParams();
        return {
            /** Test document to load. Relative or absolute urls are supported */
            fileUrl: params.fileUrl || "100pages.odt",
            /** Include known slow actions in the benchmark. These can take 10 or more minutes each on large docs */
            includeSlow: params.includeSlow || false,
            /** Background colour of the benchmark results. Useful for distinguishing different benchmark versions */
            colour: params.colour
        };
    }


    /**
     * @constructor
     */
    function HTMLBenchmark() {
        var loadingScreen = document.getElementById('loadingScreen'),
            config = getConfiguration(),
            benchmark = new Benchmark(),
            renderer = new HTMLResultsRenderer(benchmark);

        renderer.setBackgroundColour(config.colour);

        loadingScreen.style.display = "none";

        benchmark.actions.push(new PreloadDocument(config.fileUrl));
        benchmark.actions.push(new OpenDocument(config.fileUrl));
        benchmark.actions.push(new EnterEditMode());
        benchmark.actions.push(new MoveCursorToEnd());
        benchmark.actions.push(new MoveCursorToEndDirect());
        benchmark.actions.push(new InsertLetterA(1));
        benchmark.actions.push(new InsertLetterA(100));
        benchmark.actions.push(new RemovePositions(1, true));
        benchmark.actions.push(new MoveCursorLeft(1));
        benchmark.actions.push(new MoveCursorLeft(100));
        benchmark.actions.push(new RemovePositions(1, false));
        benchmark.actions.push(new RemovePositions(100, true));
        benchmark.actions.push(new SelectEntireDocument());
        benchmark.actions.push(new BoldCurrentSelection());
        if (config.includeSlow) {
            benchmark.actions.push(new AlignCurrentSelectionJustified());
        }
        benchmark.actions.push(new RemoveCurrentSelection());

        this.start = benchmark.start;
    }

    return HTMLBenchmark;
});
