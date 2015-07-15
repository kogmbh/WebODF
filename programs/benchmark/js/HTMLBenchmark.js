/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global define, document, window, webodf*/

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
    "MoveCursorToEnd",
    "MoveCursorToStart",
    "SaveDocument"
], function (Benchmark, HTMLResultsRenderer,
             OpenDocument, EnterEditMode, MoveCursorToEndDirect,InsertLetterA, RemovePositions, MoveCursorLeft,
             SelectEntireDocument, RemoveCurrentSelection, PreloadDocument, BoldCurrentSelection,
             AlignCurrentSelectionJustified, MoveCursorToEnd, MoveCursorToStart, SaveDocument) {
    "use strict";

    /**
     * Convert url query parameters into an Object
     * Source: http://stackoverflow.com/a/2880929
     * @return {!Object.<!string, !string>}
     */
    function getQueryParams() {
        /*jslint regexp: true*/
        var match,
            pl     = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
            query  = window.location.search.substring(1),
            urlParams = {};
        /*jslint regexp: false*/

        match = search.exec(query);
        while (match) {
            urlParams[decode(match[1])] = decode(match[2]);
            match = search.exec(query);
        }

        return urlParams;
    }

    /**
     * Extract supported benchmark options from the url query parameters
     * @return {!{fileUrl: !string, includeSlow: !boolean, colour: (string|undefined)}}
     */
    function getConfiguration() {
        var params = getQueryParams();
        return {
            /** Test document to load. Relative or absolute urls are supported */
            fileUrl: params.fileUrl || "100pages.odt",
            /** Include known slow actions in the benchmark. These can take 10 or more minutes each on large docs */
            includeSlow: params.includeSlow === "false" ? false : true,
            /** Background colour of the benchmark results. Useful for distinguishing different benchmark versions */
            colour: params.colour
        };
    }


    /**
     * @constructor
     */
    function HTMLBenchmark() {
        var loadingScreenElement = document.getElementById('loadingScreen'),
            canvasElement = document.getElementById("canvas"),
            benchmarkResultsElement = document.getElementById("benchmarkResults").getElementsByTagName("tbody")[0],
            versionElement = document.getElementById("version"),
            config = getConfiguration(),
            benchmark = new Benchmark(canvasElement),
            renderer = new HTMLResultsRenderer(benchmark, benchmarkResultsElement);

        versionElement.textContent = webodf.Version;
        renderer.setBackgroundColour(config.colour);

        loadingScreenElement.style.display = "none";

        benchmark.actions.push(new PreloadDocument(config.fileUrl));
        benchmark.actions.push(new OpenDocument(config.fileUrl));
        benchmark.actions.push(new EnterEditMode());
        benchmark.actions.push(new MoveCursorToEnd());
        benchmark.actions.push(new MoveCursorToStart());
        benchmark.actions.push(new InsertLetterA(100));
        benchmark.actions.push(new RemovePositions(100, true));
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
        benchmark.actions.push(new AlignCurrentSelectionJustified());
        benchmark.actions.push(new SaveDocument());
        if (config.includeSlow) {
            benchmark.actions.push(new RemoveCurrentSelection());
        }

        this.start = benchmark.start;
    }

    return HTMLBenchmark;
});
