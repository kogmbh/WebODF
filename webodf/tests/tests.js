/**
 * Copyright (C) 2012 KO GmbH <jos.van.den.oever@kogmbh.com>
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
/*global runtime, Runtime, core, gui, xmldom, RuntimeTests, odf, ops, webodf_css: true*/

runtime.loadClass("core.Base64Tests");
runtime.loadClass("core.DomUtilsTests");
runtime.loadClass("core.CursorTests");
runtime.loadClass("core.PositionIteratorTests");
runtime.loadClass("core.RuntimeTests");
runtime.loadClass("core.StepIteratorTests");
runtime.loadClass("core.UnitTester");
runtime.loadClass("core.ZipTests");
runtime.loadClass("gui.UndoStateRulesTests");
runtime.loadClass("gui.TrivialUndoManagerTests");
runtime.loadClass("gui.SelectionControllerTests");
runtime.loadClass("gui.StyleSummaryTests");
runtime.loadClass("ops.OdtDocumentTests");
runtime.loadClass("ops.SessionTests");
runtime.loadClass("ops.OperationTests");
runtime.loadClass("ops.StepsTranslatorTests");
runtime.loadClass("odf.OdfUtilsTests");
runtime.loadClass("odf.ObjectNameGeneratorTests");
runtime.loadClass("ops.TransformerTests");
runtime.loadClass("ops.TransformationTests");
runtime.loadClass("odf.FormattingTests");
runtime.loadClass("odf.OdfContainerTests");
runtime.loadClass("odf.StyleInfoTests");
runtime.loadClass("odf.TextStyleApplicatorTests");
runtime.loadClass("xmldom.LSSerializerTests");
runtime.loadClass("xmldom.XPathTests");

// qtjsruntimetest tests break if OdfCanvas is allowed to insert a dynamic <link/> element.
// If a dynamic link is inserted, subsequent dynamic style sheets (document.createElement(...)) fail to result in
// new entries being added to document.styleSheets.
// This can easily be seen by commenting out the following and running ops.OdtCursorTests followed by ops.OdtDocumentTests.
// As ops.OdtDocumentTests is the only test suite to rely on style behaviour functioning correctly and will report failures.
webodf_css = "/* Need to prevent OdfCanvas from inserting it's own <link/> element. See tests.js for more information */";

/**
 * Holds the unit tests to run.
 * @type {!Array.<Function>}
 */
var tests = [
    core.RuntimeTests,
    core.ZipTests,
    core.Base64Tests
];

// add tests depending on runtime with XML parser
if (runtime.getDOMImplementation() && runtime.parseXML("<a/>").createRange) {
// TODO: fix test and enable
//     tests.push(core.CursorTests);
    tests.push(core.PositionIteratorTests);
    tests.push(core.DomUtilsTests);
    tests.push(core.StepIteratorTests);
    tests.push(gui.UndoStateRulesTests);
    tests.push(gui.TrivialUndoManagerTests);
    tests.push(gui.SelectionControllerTests);
    tests.push(gui.StyleSummaryTests);
    tests.push(odf.OdfUtilsTests);
    tests.push(odf.ObjectNameGeneratorTests);
    tests.push(odf.FormattingTests);
    tests.push(odf.OdfContainerTests);
    tests.push(odf.StyleInfoTests);
    tests.push(odf.TextStyleApplicatorTests);
    tests.push(ops.OdtDocumentTests);
    tests.push(ops.StepsTranslatorTests);
    tests.push(ops.TransformerTests);
}
// add tests depending on browser runtime
if (runtime.type() === "BrowserRuntime") {
    tests.push(xmldom.LSSerializerTests);
    tests.push(xmldom.XPathTests);
    tests.push(ops.SessionTests);
    tests.push(ops.OperationTests);
    tests.push(ops.TransformationTests);
}

var tester = new core.UnitTester();

/**
 * Recursively runs the passed tests.
 * @param {!Array.<Function>} tests
 * @return {undefined}
 */
function runNextTest(tests, tester, callback) {
    "use strict";
    // done with all tests?
    if (tests.length === 0) {
        return callback(tester);
    }

    // run first of passed tests, on success continue with the left
    var test = tests[0];
    if (typeof test !== "function") {
        runtime.log("Tests contain a non-function object of type " +
                typeof test + ".");
        runtime.exit(1);
        return;
    }
    runtime.log("Running test '" + Runtime.getFunctionName(test) + "'.");
    try {
        tester.runTests(test, function () {
            runNextTest(tests.slice(1), tester, callback);
        }, []);
    } catch (e) {
        runtime.log(e);
        runtime.exit(1);
        throw e;
    }
}

/**
 * Split ? part of the current url into a name value map.
 * @return {!{suite:?string,test:?string}}
 */
function queryObj() {
    "use strict";
    var result = { suite: null, test: null },
        window = runtime.getWindow(),
        keyValuePairs = window.location.search.slice(1).split('&');

    keyValuePairs.forEach(function (keyValuePair) {
        keyValuePair = keyValuePair.split('=');
        result[keyValuePair[0]] = keyValuePair[1] || '';
    });
    return result;
}

function findSuite(name) {
    "use strict";
    var i, suite;
    for (i = 0; !suite && i < tests.length; i += 1) {
        if (tests[i].name === name) {
            suite = tests[i];
        }
    }
    return suite;
}

function runSuite(name) {
    "use strict";
    runtime.getWindow().location.search = "?suite=" + name;
}
function runTest(suite, name) {
    "use strict";
    runtime.getWindow().location.search = "?suite=" + suite + "&test=" + name;
}

function runSelectedTests(selectedTests) {
    "use strict";
    if (!selectedTests.suite) {
        return false;
    }
/*jslint emptyblock: true*/
    tester.runTests(selectedTests.suite, function () {
    }, selectedTests.testNames);
/*jslint emptyblock: false*/
    return true;
}

function getTestNameFromUrl(selectedTests) {
    "use strict";
    var options = queryObj();
    selectedTests.suite = findSuite(options.suite);
    if (!selectedTests.suite) {
        return;
    }
    if (options.test) {
        selectedTests.testNames = options.test.split(",");
    }
}

function getTestNamesFromArguments(selectedTests, args) {
    "use strict";
    var i;
    for (i = 0; i < args.length - 1; i += 1) {
        if (args[i] === "-suite") {
            selectedTests.suite = findSuite(args[i + 1]);
        }
        if (args[i] === "-test") {
            selectedTests.testNames.push(args[i + 1]);
        }
    }
}

var args = String(typeof arguments) !== "undefined" && Array.prototype.slice.call(arguments),
    selectedTests = {
        suite: null,
        testNames: []
    };

if (runtime.type() === "BrowserRuntime") {
    getTestNameFromUrl(selectedTests);
}
// run the tests here, unless this is a karma run
if (!runtime.getWindow() || !runtime.getWindow().hasOwnProperty("use_karma")) {
    if (!selectedTests.suite) {
        getTestNamesFromArguments(selectedTests, args);
    }
    if (!runSelectedTests(selectedTests)) {
        runNextTest(tests, tester, function (tester) {
            "use strict";
            //runtime.log(JSON.stringify(tester.results()));
            runtime.log("Number of failed tests: " +
                    String(tester.countFailedTests()));
            runtime.exit(tester.countFailedTests());
            return;
        });
    }
}
