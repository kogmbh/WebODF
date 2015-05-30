/**
 * Copyright (C) 2012,2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, Runtime, core, Node, Element*/
/*jslint evil: true, continue: true, emptyblock: true, unparam: true*/

/**
 * @typedef{{f:function(),name:!string,expectFail:boolean}}
 */
core.TestData;
/**
 * @typedef{{f:function(function()),name:!string,expectFail:boolean}}
 */
core.AsyncTestData;
/**
 * @interface
 */
core.UnitTest = function UnitTest() {"use strict"; };
/**
 * @return {undefined}
 */
core.UnitTest.prototype.setUp = function () {"use strict"; };
/**
 * @return {undefined}
 */
core.UnitTest.prototype.tearDown = function () {"use strict"; };
/**
 * @return {!string}
 */
core.UnitTest.prototype.description = function () {"use strict"; };
/**
 * @return {!Array.<!core.TestData>}
 */
core.UnitTest.prototype.tests = function () {"use strict"; };
/**
 * @return {!Array.<!core.AsyncTestData>}
 */
core.UnitTest.prototype.asyncTests = function () {"use strict"; };

/**
 * @return {!HTMLDivElement}
 */
core.UnitTest.provideTestAreaDiv = function () {
    "use strict";
    var maindoc = runtime.getWindow().document,
        testarea = maindoc.getElementById('testarea');

    runtime.assert(!testarea, "Unclean test environment, found a div with id \"testarea\".");

    testarea = maindoc.createElement('div');
    testarea.setAttribute('id', 'testarea');
    maindoc.body.appendChild(testarea);
    return /**@type{!HTMLDivElement}*/(testarea);
};

/**
 * @return {undefined}
 */
core.UnitTest.cleanupTestAreaDiv = function () {
    "use strict";
    var maindoc = runtime.getWindow().document,
        testarea = maindoc.getElementById('testarea');

    runtime.assert((!!testarea && (testarea.parentNode === maindoc.body)), "Test environment broken, found no div with id \"testarea\" below body.");
    maindoc.body.removeChild(testarea);
};

/**
 * Creates and returns an XML document
 * @param {!string} rootElementName  name of the root element, "prefix:localName"
 * @param {!string} xmlBodyString  XML fragment to insert in the document between the root tags
 * @param {!Object.<!string, !string>} namespaceMap Name-value pairs that map the
 *                                     prefix onto the appropriate uri namespace
 * @return {?Document}
 */
core.UnitTest.createXmlDocument = function (rootElementName, xmlBodyString, namespaceMap) {
    "use strict";
    var /**@type{!string}*/
        xmlDoc = "<?xml version='1.0' encoding='UTF-8'?>";

    xmlDoc += "<"+ rootElementName;
    Object.keys(namespaceMap).forEach(function (key) {
        xmlDoc += " xmlns:" + key + '="' + namespaceMap[key] + '"';
    });
    xmlDoc += ">";
    xmlDoc += xmlBodyString;
    xmlDoc += "</"+rootElementName+">";

    return runtime.parseXML(xmlDoc);
};

/**
 * Creates and returns a simple ODT document
 * @param {!string} xml Xml fragment to insert in the document between the
 *                      <office:document>..</office:document> tags
 * @param {!Object.<string, string>} namespaceMap Name-value pairs that map the
 *                                   prefix onto the appropriate uri namespace
 * @return {?Document}
 */
core.UnitTest.createOdtDocument = function (xml, namespaceMap) {
    "use strict";
    return core.UnitTest.createXmlDocument("office:document", xml, namespaceMap);
};


/**
 * @constructor
 */
core.UnitTestLogger = function UnitTestLogger() {
    "use strict";
    var /**@type{!Array.<{category:string,message:string}>}*/
        messages = [],
        /**@type{number}*/
        errors = 0,
        start = 0,
        suite = "",
        test = "";
    /**
     * @param {string} suiteName
     * @param {string} testName
     */
    this.startTest = function (suiteName, testName) {
        messages = [];
        errors = 0;
        suite = suiteName;
        test = testName;
        start = Date.now();
    };
    /**
     * @return {!{description:string,suite:!Array.<string>,success:boolean,log:!Array.<{category:string,message:string}>,time:number}}
     */
    this.endTest = function () {
        var end = Date.now();
        return {
            description: test,
            suite: [suite, test],
            success: errors === 0,
            log: messages,
            time: end - start
        };
    };
    /**
     * @param {string} msg
     */
    this.debug = function (msg) {
        messages.push({category: "debug", message: msg});
    };
    /**
     * @param {string} msg
     */
    this.fail = function (msg) {
        errors += 1;
        messages.push({category: "fail", message: msg});
    };
    /**
     * @param {string} msg
     */
    this.pass = function (msg) {
        messages.push({category: "pass", message: msg});
    };
};

/**
 * @constructor
 * @param {string} resourcePrefix
 * @param {!core.UnitTestLogger} logger
 */
core.UnitTestRunner = function UnitTestRunner(resourcePrefix, logger) {
    "use strict";
    var /**@type{number}*/
        failedTests = 0,
        /**@type{number}*/
        failedTestsOnBeginExpectFail,
        areObjectsEqual,
        expectFail = false;
    /**
     * @return {string}
     */
    this.resourcePrefix = function () {
        return resourcePrefix;
    };
    /**
     * @return {undefined}
     */
    this.beginExpectFail = function () {
        failedTestsOnBeginExpectFail = failedTests;
        expectFail = true;
    };
    /**
     * @return {undefined}
     */
    this.endExpectFail = function () {
        var hasNoFailedTests = (failedTestsOnBeginExpectFail === failedTests);
        expectFail = false;

        failedTests = failedTestsOnBeginExpectFail;
        if (hasNoFailedTests) {
            failedTests += 1;
            logger.fail("Expected at least one failed test, but none registered.");
        }
    };
    /**
     * @param {string} msg
     * @return {undefined}
     */
    function debug(msg) {
        logger.debug(msg);
    }
    /**
     * @param {string} msg
     * @return {undefined}
     */
    function testFailed(msg) {
        failedTests += 1;
        if (!expectFail) {
            logger.fail(msg);
        } else {
            logger.debug(msg);
        }
    }
    /**
     * @param {string} msg
     * @return {undefined}
     */
    function testPassed(msg) {
        logger.pass(msg);
    }
    /**
     * @param {!Array.<*>} a actual
     * @param {!Array.<*>} b expected
     * @return {!boolean}
     */
    function areArraysEqual(a, b) {
        var i;
        try {
            if (a.length !== b.length) {
                testFailed("array of length " + a.length + " should be "
                           + b.length + " long");
                return false;
            }
            for (i = 0; i < a.length; i += 1) {
                if (a[i] !== b[i]) {
                    testFailed(a[i] + " should be " + b[i] + " at array index "
                               + i);
                    return false;
                }
            }
        } catch (ex) {
            return false;
        }
        return true;
    }
    /**
     * @param {!Element} a actual
     * @param {!Element} b expected
     * @param {!boolean} skipReverseCheck
     * @return {!boolean}
     */
    function areAttributesEqual(a, b, skipReverseCheck) {
        var aatts = a.attributes,
            n = aatts.length,
            i,
            att,
            v;
        for (i = 0; i < n; i += 1) {
            att = /**@type{!Attr}*/(aatts.item(i));
            if (att.prefix !== "xmlns" && att.namespaceURI !== "urn:webodf:names:steps") {
                v = b.getAttributeNS(att.namespaceURI, att.localName);
                if (!b.hasAttributeNS(att.namespaceURI, att.localName)) {
                    testFailed("Attribute " + att.localName + " with value " + att.value + " was not present");
                    return false;
                }
                if (v !== att.value) {
                    testFailed("Attribute " + att.localName + " was " + v + " should be " + att.value);
                    return false;
                }
            }
        }
        return skipReverseCheck ? true : areAttributesEqual(b, a, true);
    }
    /**
     * @param {!Node} a actual
     * @param {!Node} b expected
     * @return {!boolean}
     */
    function areNodesEqual(a, b) {
        var an, bn,
            atype = a.nodeType,
            btype = b.nodeType;
        if (atype !== btype) {
            testFailed("Nodetype '" + atype + "' should be '" + btype + "'");
            return false;
        }
        if (atype === Node.TEXT_NODE) {
            if (/**@type{!Text}*/(a).data === /**@type{!Text}*/(b).data) {
                return true;
            }
            testFailed("Textnode data '" + /**@type{!Text}*/(a).data
                       +  "' should be '" + /**@type{!Text}*/(b).data + "'");
            return false;
        }
        if (atype === Node.ELEMENT_NODE) {
            if (a.namespaceURI !== b.namespaceURI) {
                testFailed("namespace '" + a.namespaceURI + "' should be '"
                        + b.namespaceURI + "'");
                return false;
            }
            if (a.localName !== b.localName) {
                testFailed("localName '" + a.localName + "' should be '"
                        + b.localName + "'");
                return false;
            }
            if (!areAttributesEqual(/**@type{!Element}*/(a),
                                    /**@type{!Element}*/(b), false)) {
                return false;
            }
        } else {
            runtime.assert(atype === Node.DOCUMENT_FRAGMENT_NODE,
                "Only textnodes, elements and document-fragments are supported.");
        }
        an = a.firstChild;
        bn = b.firstChild;
        while (an) {
            if (!bn) {
                testFailed("Nodetype '" + an.nodeType + "' is unexpected here.");
                return false;
            }
            if (!areNodesEqual(an, bn)) {
                return false;
            }
            an = an.nextSibling;
            bn = bn.nextSibling;
        }
        if (bn) {
            testFailed("Nodetype '" + bn.nodeType + "' is missing here.");
            return false;
        }
        return true;
    }
    /**
     * @param {!*} actual
     * @param {!*} expected
     * @param {!number=} absoluteTolerance  absolute tolerance for number comparison
     * @return {!boolean}
     */
    function isResultCorrect(actual, expected, absoluteTolerance) {
        var diff;

        if (expected === 0) {
            return actual === expected && (1 / actual) === (1 / expected);
        }
        if (actual === expected) {
            return true;
        }
        if (actual === null || expected === null) {
            return false;
        }
        if (typeof expected === "number" && isNaN(expected)) {
            return typeof actual === "number" && isNaN(actual);
        }
        if (typeof expected === "number" && typeof actual === "number") {
            // simple to check?
            if (actual === expected) {
                return true;
            }

            // default (randomly chosen, no theory behind)
            if (absoluteTolerance === undefined) {
                absoluteTolerance = 0.0001;
            }

            runtime.assert(typeof absoluteTolerance === "number", "Absolute tolerance not given as number.");
            runtime.assert(absoluteTolerance >= 0, "Absolute tolerance should be given as positive number, was "+absoluteTolerance);

            diff = Math.abs(actual - expected);

            return (diff <= absoluteTolerance);
        }
        if (Object.prototype.toString.call(expected) ===
                Object.prototype.toString.call([])) {
            return areArraysEqual(/**@type{!Array}*/(actual),
                                  /**@type{!Array}*/(expected));
        }
        if (typeof expected === "object" && typeof actual === "object") {
            if (/**@type{!Object}*/(expected).constructor === Element
                    || /**@type{!Object}*/(expected).constructor === Node) {
                return areNodesEqual(/**@type{!Node}*/(actual),
                                     /**@type{!Node}*/(expected));
            }
            return areObjectsEqual(/**@type{!Object}*/(actual),
                                   /**@type{!Object}*/(expected));
        }
        return false;
    }
    /**
     * @param {*} v
     * @return {!string}
     */
    function stringify(v) {
        if (v === 0 && 1 / v < 0) {
            return "-0";
        }
        if (typeof v === "object") {
            try {
                return JSON.stringify(v);
            } catch (ignore) {
                // JSON serialization will fail if there is a cyclic dependency of some sort.
                // Just fall through to returning a normal string in this instance.
            }
        }
        return String(v);
    }
    /**
     * @param {!Object} t
     * @param {!string} a
     * @param {!string} b
     * @param {!number=} absoluteTolerance  absolute tolerance for number comparison
     * @return {undefined}
     */
    function shouldBe(t, a, b, absoluteTolerance) {
        if (typeof a !== "string" || typeof b !== "string") {
            debug("WARN: shouldBe() expects string arguments");
        }
        var exception, av, bv;
        try {
            av = eval(a);
        } catch (/**@type{*}*/e) {
            exception = e;
        }
        bv = eval(b);

        if (exception) {
            testFailed(a + " should be " + bv + ". Threw exception " +
                    exception);
        } else if (isResultCorrect(av, bv, absoluteTolerance)) {
            testPassed(a + " is " + b);
        } else if (String(typeof av) === String(typeof bv)) {
            testFailed(a + " should be " + stringify(bv) + ". Was " + stringify(av) + ".");
        } else {
            testFailed(a + " should be " + bv + " (of type " + typeof bv +
                    "). Was " + av + " (of type " + typeof av + ").");
        }
    }

    /**
     * @param {!Object} t context in which values to be tested are placed
     * @param {!string} a the value to be checked
     * @return {undefined}
     */
    function shouldBeNonNull(t, a) {
        var exception, av;
        try {
            av = eval(a);
        } catch (/**@type{*}*/e) {
            exception = e;
        }

        if (exception) {
            testFailed(a + " should be non-null. Threw exception " + exception);
        } else if (av !== null) {
            testPassed(a + " is non-null.");
        } else {
            testFailed(a + " should be non-null. Was " + av);
        }
    }
    /**
     * @param {!Object} t context in which values to be tested are placed
     * @param {!string} a the value to be checked
     * @return {undefined}
     */
    function shouldBeNull(t, a) {
        shouldBe(t, a, "null");
    }

    /**
     * @param {!Object} a
     * @param {!Object} b
     * @return {!boolean}
     */
    areObjectsEqual = function (a, b) {
        var akeys = Object.keys(a),
            bkeys = Object.keys(b);
        akeys.sort();
        bkeys.sort();
        return areArraysEqual(akeys, bkeys)
            && Object.keys(a).every(function (key) {
                var /**@type{*}*/
                    aval = a[key],
                    /**@type{*}*/
                    bval = b[key];
                if (!isResultCorrect(aval, bval)) {
                    testFailed(aval + " should be " + bval + " for key " + key);
                    return false;
                }
                return true;
            });
    };

    this.areNodesEqual = areNodesEqual;
    this.shouldBeNull = shouldBeNull;
    this.shouldBeNonNull = shouldBeNonNull;
    this.shouldBe = shouldBe;
    this.testFailed = testFailed;

    /**
     * @return {!number}
     */
    this.countFailedTests = function () {
        return failedTests;
    };
    /**
     * @param {!Array.<T>} functions
     * @return {!Array.<!{f:T,name:string}>}
     * @template T
     */
    this.name = function (functions) {
        var i, fname,
            nf = [],
            l = functions.length;
        nf.length = l;
        for (i = 0; i < l; i += 1) {
            fname = Runtime.getFunctionName(functions[i]) || "";
            if (fname === "") {
                throw "Found a function without a name.";
            }
            nf[i] = {f: functions[i], name: fname};
        }
        return nf;
    };
};

/**
 * @constructor
 */
core.UnitTester = function UnitTester() {
    "use strict";
    var self = this,
        /**@type{!number}*/
        failedTests = 0,
        logger = new core.UnitTestLogger(),
        results = {},
        inBrowser = runtime.type() === "BrowserRuntime";
    /**
     * @type {string}
     */
    this.resourcePrefix = "";
    /**
     * @param {!string} text
     * @param {!string} code
     * @return {!string}
     **/
    function link(text, code) {
        // NASTY HACK, DO NOT RE-USE. String concatenation with uncontrolled user input is a bad idea for building DOM
        // fragments everyone. If you feel tempted to extract the HTML escape thing from here, please force yourself to
        // visit http://shebang.brandonmintern.com/foolproof-html-escaping-in-javascript/ first, and learn a better
        // approach to take.

        return "<span style='color:blue;cursor:pointer' onclick='" + code + "'>"
            + text.replace(/</g, "&lt;") + "</span>";
    }
    /**
     * @type {function(!{description:string,suite:!Array.<string>,success:boolean,log:!Array.<{category:string,message:string}>,time:number})}
     */
    this.reporter = function (r) {
        var i, m;
        if (inBrowser) {
            runtime.log("<span>Running "
                + link(r.description, "runTest(\"" + r.suite[0] + "\",\""
                                  + r.description + "\")") + "</span>");
        } else {
            runtime.log("Running " + r.description);
        }
        if (!r.success) {
            for (i = 0; i < r.log.length; i += 1) {
                m = r.log[i];
                runtime.log(m.category, m.message);
            }
        }
    };
    /**
     * @param {!{description:string,suite:!Array.<string>,success:boolean,log:!Array.<{category:string,message:string}>,time:number}} r
     */
    function report(r) {
        if (self.reporter) {
            self.reporter(r);
        }
    }
    /**
     * Run the tests from TestClass.
     * If parameter testNames is supplied only the tests with the names
     * supplied in that array will be executed.
     *
     * @param {!function(new:core.UnitTest,core.UnitTestRunner)} TestClass
     *              The constructor for the test class.
     * @param {!function():undefined} callback
     * @param {!Array.<!string>} testNames
     * @return {undefined}
     */
    this.runTests = function (TestClass, callback, testNames) {
        var testName = Runtime.getFunctionName(TestClass) || "",
            /**@type{!string}*/
            tname,
            runner = new core.UnitTestRunner(self.resourcePrefix, logger),
            test = new TestClass(runner),
            testResults = {},
            i,
            /**@type{function()|function(function())}*/
            t,
            tests,
            texpectFail,
            lastFailCount;

        // check that this test has not been run or started yet
        if (results.hasOwnProperty(testName)) {
            runtime.log("Test " + testName + " has already run.");
            return;
        }

        if (inBrowser) {
            runtime.log("<span>Running "
                + link(testName, "runSuite(\"" + testName + "\");")
                + ": " + test.description() + "</span>");
        } else {
            runtime.log("Running " + testName + ": " + test.description());
        }
        tests = test.tests();
        for (i = 0; i < tests.length; i += 1) {
            t = tests[i].f;
            tname = tests[i].name;
            texpectFail = (tests[i].expectFail === true);
            if (testNames.length && testNames.indexOf(tname) === -1) {
                continue;
            }
            lastFailCount = runner.countFailedTests();
            test.setUp();
            logger.startTest(testName, tname);
            if (texpectFail) {
                runner.beginExpectFail();
            }
            try {
                t();
            } catch(/**@type{!Error}*/e) {
                runner.testFailed("Unexpected exception encountered: " + e.toString() + "\n" + e.stack);
            }
            if (texpectFail) {
                runner.endExpectFail();
            }
            report(logger.endTest());
            test.tearDown();
            testResults[tname] = lastFailCount === runner.countFailedTests();
        }
        /**
         * @param {!Array.<!core.AsyncTestData>} todo
         * @return {undefined}
         */
        function runAsyncTests(todo) {
            var fname,
                expectFail;
            if (todo.length === 0) {
                results[testName] = testResults;
                failedTests += runner.countFailedTests();
                callback();
                return;
            }
            function tearDownAndRunNext() {
                if (expectFail) {
                    runner.endExpectFail();
                }
                report(logger.endTest());
                test.tearDown();
                testResults[fname] = lastFailCount === runner.countFailedTests();
                runAsyncTests(todo.slice(1));
            }
            t = todo[0].f;
            fname = todo[0].name;
            expectFail = (todo[0].expectFail === true);
            lastFailCount = runner.countFailedTests();
            if (testNames.length && testNames.indexOf(fname) === -1) {
                runAsyncTests(todo.slice(1));
            } else {
                test.setUp();
                logger.startTest(testName, fname);
                if (expectFail) {
                    runner.beginExpectFail();
                }
                try {
                    t(tearDownAndRunNext);
                } catch(/**@type{!Error}*/e) {
                    runner.testFailed("Unexpected exception encountered: " + e.toString() + "\n" + e.stack);
                    tearDownAndRunNext();
                }
            }
        }
        runAsyncTests(test.asyncTests());
    };
    /**
     * @return {!number}
     **/
    this.failedTestsCount = function () {
        return failedTests;
    };
    /**
     * @return {!Object}
     **/
    this.results = function () {
        return results;
    };
};
