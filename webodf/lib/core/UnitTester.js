/*global runtime core*/

/**
 * @interface
 */
core.UnitTest = function UnitTest() {};
/**
 * @return {undefined}
 */
core.UnitTest.prototype.setUp = function () {};
/**
 * @return {undefined}
 */
core.UnitTest.prototype.tearDown = function () {};
/**
 * @return {string}
 */
core.UnitTest.prototype.description = function () {};
/**
 * @return {Object.<string, Function>}
 */
core.UnitTest.prototype.tests = function () {};

/**
 * @constructor
 */
core.UnitTestRunner = function UnitTestRunner() {
    function debug(msg) {
        runtime.log(msg);
    }
    function testFailed(msg) {
        runtime.log("fail", msg);
    }
    function testPassed(msg) {
        runtime.log("pass", msg);
    }
    function areArraysEqual(a, b) {
        var i;
        try {
            if (a.length !== b.length) {
                return false;
            }
            for (i = 0; i < a.length; i += 1) {
                if (a[i] !== b[i]) {
                    return false;
                }
            }
        } catch (ex) {
            return false;
        }
        return true;
    }
    function isResultCorrect(actual, expected) {
        if (expected === 0) {
            return actual === expected && (1 / actual) === (1 / expected);
        }
        if (actual === expected) {
            return true;
        }
        if (typeof(expected) === "number" && isNaN(expected)) {
            return typeof(actual) === "number" && isNaN(actual);
        }
        if (Object.prototype.toString.call(expected) === Object.prototype.toString.call([])) {
            return areArraysEqual(actual, expected);
        }
        return false;
    }
    function stringify(v) {
        if (v === 0 && 1 / v < 0) {
            return "-0";
        }
        return "" + v;
    }
    /**
     * @param {Object} t
     * @param {string} a
     * @param {string} b
     * @return {undefined}
     */
    function shouldBe(t, a, b) {
        if (typeof a !== "string" || typeof b !== "string") {
            debug("WARN: shouldBe() expects string arguments");
        }
        var exception, av, bv;
        try {
            av = eval(a);
        } catch (e) {
            exception = e;
        }
        bv = eval(b);

        if (exception) {
            testFailed(a + " should be " + bv + ". Threw exception " + exception);
        } else if (isResultCorrect(av, bv)) {
            testPassed(a + " is " + b);
        } else if (typeof(av) === typeof(bv)) {
            testFailed(a + " should be " + bv + ". Was " + stringify(av) + ".");
        } else {
            testFailed(a + " should be " + bv + " (of type " + typeof bv + "). Was " + av + " (of type " + typeof av + ").");
        }
    }
    /**
     * @param {Object} t context in which values to be tested are placed
     * @param {string} a the value to be checked
     * @return {undefined}
     */
    function shouldBeNonNull(t, a) {
        var exception, av;
        try {
            av = eval(a);
        } catch (e) {
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
     * @param {Object} t context in which values to be tested are placed
     * @param {string} a the value to be checked
     * @return {undefined}
     */
    function shouldBeNull(t, a) {
        shouldBe(t, a, "null");
    }
    this.shouldBeNull = shouldBeNull;
    this.shouldBeNonNull = shouldBeNonNull;
    this.shouldBe = shouldBe;
};

/**
 * @constructor
 */
core.UnitTester = function UnitTester() {
    var runner = new core.UnitTestRunner();
    this.runTests = function (TestClass) {
        var test = new TestClass(runner), i, t, tests;
        runtime.log("Running " + TestClass.name + ": " + test.description());
        tests = test.tests();
        for (i in tests) {
            if (tests.hasOwnProperty(i)) {
                runtime.log("Running " + i);
                t = tests[i];
                test.setUp();
                t();
                test.tearDown();
            }
        }
    };
};
