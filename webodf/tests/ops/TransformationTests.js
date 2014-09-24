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

/*global Node, runtime, core, gui, ops, odf, xmldom*/


/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
ops.TransformationTests = function TransformationTests(runner) {
    "use strict";
    var r = runner, t, tests,
        opsTestHelper = new ops.OperationTestHelper();

    function serialize(element) {
        var serializer = new xmldom.LSSerializer();
        return serializer.writeToString(element, odf.Namespaces.namespaceMap);
    }

    /**
     * Creates a deep copy of the spec
     * @param {!Object} spec
     * @return {!Object}
     */
    function cloneSpec(spec) {
        var result = {};

        Object.keys(spec).forEach(function (key) {
            if (typeof spec[key] === 'object') {
                result[key] = cloneSpec(spec[key]);
            } else {
                result[key] = spec[key];
            }
        });

        return result;
    }

    /**
     * Creates a deep copy of the specs
     * @param {!Array.<!Object>} specs
     * @return {!Array.<!Object>}
     */
    function cloneSpecs(specs) {
        var i, result = [];

        for (i = 0; i < specs.length; i += 1) {
            result.push(cloneSpec(specs[i]));
        }

        return result;
    }

    /**
     * @param {!Array.<!{optype:string}>} opspecs
     * @return {!Array.<!ops.Operation>}
     */
    function operations(opspecs) {
        var ops = [];

        opspecs.forEach(function (opspec) {
            ops.push(t.operationFactory.create(opspec));
        });

        return ops;
    }

    /**
     * Traverse the tree and sort cursors that are at the same position,
     * so identic sets of cursors are in an identic order.
     * @param {!Element} element
     * @param {!string} attrns
     * @param {!string} attrLocalName
     * @return {undefined}
     */
    function sortChildrenByNSAttribute(element, attrns, attrLocalName) {
        var child = element.firstChild,
            childArray = [],
            i;
        while (child) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                childArray.push(child);
            }
            child = child.nextSibling;
        }
        childArray.sort(function (a, b) {
            var attra = a.getAttributeNS(attrns, attrLocalName),
                attrb = b.getAttributeNS(attrns, attrLocalName);
            return attra === attrb ? 0 :
                    (attra > attrb ? 1 : -1);
        });

        for (i = 0; i < childArray.length; i += 1) {
            element.appendChild(childArray[i]);
        }
    }

    /** 
     * Sort the children of the element by their
     * tag names for easy comparison and uniform
     * order.
     * @param {!Element} element
     * @return {undefined}
     */
    function sortChildrenByTagName(element) {
        var child = element.firstElementChild,
            childArray = [],
            i;
        while(child) {
            childArray.push(child);
            child = child.nextElementSibling;
        }
        childArray.sort(function(a, b) {
            var namea = a.prefix + ":" + a.localName,
                nameb = b.prefix + ":" + b.localName;
            return namea === nameb ? 0 :
                  (namea > nameb ?   1 :
                                    -1);
        });

        for(i = 0; i < childArray.length; i += 1) {
            element.appendChild(childArray[i]);
        }
    }

    /**
     * Traverse the tree and sort cursors that are at the same position,
     * so identic sets of cursors are in an identic order.
     * @param {!Node} node
     * @return {undefined}
     */
    function normalizeCursorsAndAnchors(node) {
        var i,
            child = node.firstChild,
            cursorNs = "urn:webodf:names:cursor",
            cursorLocalName = "cursor",
            anchorLocalName = "anchor",
            memberIdLocalName = "memberId",
            collections;

        /**
         * @param {!Element} elementA
         * @param {!Element} elementB
         * @return {!number}
         */
        function compareMemberId(elementA, elementB) {
            var memberIdA = elementA.getAttributeNS(cursorNs, memberIdLocalName),
                memberIdB = elementB.getAttributeNS(cursorNs, memberIdLocalName);

            if (memberIdA < memberIdB) {
                return -1;
            }
            if (memberIdA > memberIdB) {
                return 1;
            }
            return 0;
        }

        while (child) {
            if (child.nodeType === Node.ELEMENT_NODE
                    && child.namespaceURI === cursorNs
                    && (child.localName === cursorLocalName
                        || child.localName === anchorLocalName)) {
                collections = {
                    "cursor": [],
                    "anchor": []
                };
                collections[child.localName].push(child);

                // collect any next cursors
                child = child.nextSibling;
                while (child && child.nodeType === Node.ELEMENT_NODE
                        && child.namespaceURI === cursorNs
                        && (child.localName === cursorLocalName
                            || child.localName === anchorLocalName)) {
                    collections[child.localName].push(child);
                    child = child.nextSibling;
                }
                // at this point "child" is behind the last anchor/cursor or undefined
                // if more than 1, reinsert them sorted
                if (collections[cursorLocalName].length + collections[anchorLocalName].length > 1) {
                    // sort
                    collections[cursorLocalName].sort(compareMemberId);
                    collections[anchorLocalName].sort(compareMemberId);
                    // remove and reinsert sorted
                    for (i = 0; i < collections[cursorLocalName].length; i += 1) {
                        node.insertBefore(collections[cursorLocalName][i], child);
                    }
                    for (i = 0; i < collections[anchorLocalName].length; i += 1) {
                        node.insertBefore(collections[anchorLocalName][i], child);
                    }
                }
            }
            if (child) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    normalizeCursorsAndAnchors(child);
                }
                child = child.nextSibling;
            }
        }
    }

    /**
     * @param {!Element} element
     * @return {!Object}
     */
    function parseOperation(element) {
        var op = {},
            child = element.firstChild,
            atts = element.attributes,
            att,
            n = atts.length,
            i,
            value;
        // read plain data by attributes
        for (i = 0; i < n; i += 1) {
            att = atts.item(i);
            value = att.value;
            if (/(length|position)/i.test(att.localName)) {
                value = parseInt(value, 10);
            }
            op[att.nodeName] = value;
        }
        // read complex data by childs
        while (child) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                op[child.nodeName] = parseOperation(/**@type{!Element}*/(child));
            }
            child = child.nextSibling;
        }
        return op;
    }
    /**
     * @param {!string} name
     * @param {!Element} opsElement
     * @return {!Array.<!Object>}
     */
    function parseOpspecs(name, opsElement) {
        var op = opsElement.firstElementChild,
            opspecs = [];
        while (op) {
            runtime.assert(op.localName === "op", "Expected <op/> in " + name + ".");
            opspecs.push(parseOperation(op));
            op = op.nextElementSibling;
        }
        return opspecs;
    }
    /**
     * @param {!Element} element
     * @return {!boolean}
     */
    function checkWhitespaceTexts(element) {
        var text = element.firstChild;
        return (element.childNodes.length === 1
            && element.hasAttributeNS(odf.Namespaces.textns, "c") === false
            && text.nodeType === Node.TEXT_NODE
            && text.textContent === " ");
    }
    /**
     * @param {!Element} rootElement
     * @return {!boolean}
     */
    function checkWhitespace(rootElement) {
        var i,
            spaceElements = rootElement.getElementsByTagNameNS(odf.Namespaces.textns, "s");
        for (i = 0; i < spaceElements.length; i += 1) {
            if (!checkWhitespaceTexts(spaceElements[i])) {
                return false;
            }
        }
        return true;
    }
    /**
     * @param {!string} name
     * @param {!Element} element
     * @return {!{before, opspecsA, opspecsB, after}}
     */
    function parseTest(name, element) {
        var before = element.getElementsByTagName("before")[0],
            opsAElement = element.getElementsByTagName("opsA")[0],
            opsBElement = element.getElementsByTagName("opsB")[0],
            after = element.getElementsByTagName("after")[0],
            isFailing = element.getAttribute("isFailing") === "true";

        runtime.assert(Boolean(before), "Expected <before/> in " + name + ".");
        runtime.assert(checkWhitespace(before), "Unexpanded test:s element or text:c attribute found in " + name + ".");
        runtime.assert(Boolean(opsAElement), "Expected <ops/> in " + name + ".");
        runtime.assert(Boolean(opsBElement), "Expected <ops/> in " + name + ".");
        runtime.assert(Boolean(after), "Expected <after/> in " + name + ".");
        runtime.assert(checkWhitespace(after), "Unexpanded test:s element or text:c attribute found in " + name + ".");
        opsTestHelper.removeInsignificantTextNodes(element);
        return {
            isFailing: isFailing,
            before: before,
            opspecsA:   parseOpspecs(name, opsAElement),
            opspecsB:   parseOpspecs(name, opsBElement),
            after:  after
        };
    }

    /**
     * Creates a deep copy of all child nodes of the source element
     * and adds them as child nodes to the target element.
     * If the target element had child nodes before, they are removed.
     * @param {!Element} targetElement
     * @param {!Element} sourceElement
     * @return {undefined}
     */
    function copyChildNodes(targetElement, sourceElement) {
        while (targetElement.firstChild) {
            targetElement.removeChild(targetElement.firstChild);
        }
        var n = sourceElement.firstChild;
        while (n) {
            if (sourceElement.ownerDocument === targetElement.ownerDocument) {
                targetElement.appendChild(n.cloneNode(true));
            } else {
                targetElement.appendChild(targetElement.ownerDocument.importNode(n, true));
            }
            n = n.nextSibling;
        }
    }

    /**
     * @param {!Element} element
     * @param {!string} localName
     * @return {?Element}
     */
    function getOfficeNSElement(element, localName) {
        var e = element.getElementsByTagNameNS(odf.Namespaces.officens, localName);

        if (e.length === 1) {
            return e[0];
        }
        return null;
    }

    /**
     * @param {!Element} element
     * @return {!Element}
     */
    function getOfficeTextElement(element) {
        var textElement = getOfficeNSElement(element, "text");
        runtime.assert(textElement !== null, "Missing <office:text>!");
        return /**@type {!Element}*/(textElement);
    }

    /**
     * @param {!Element} element
     * @return {?Element}
     */
    function getOfficeStylesElement(element) {
        return getOfficeNSElement(element, "styles");
    }

    /**
     * @param {!Element} element
     * @return {?Element}
     */
    function getOfficeMetaElement(element) {
        return getOfficeNSElement(element, "meta");
    }

    function compareOpsExecution(opspecs, transformedOpspecs, before, after) {
        var odfContainer,
            odtDocument,
            text,
            textbefore = getOfficeTextElement(before),
            textafter = getOfficeTextElement(after),
            styles,
            stylesbefore = getOfficeStylesElement(before),
            stylesafter = getOfficeStylesElement(after),
            meta,
            metabefore = getOfficeMetaElement(before),
            metaafter = getOfficeMetaElement(after),
            transformedOps = operations(transformedOpspecs),
            i,
            op;

        odfContainer = new odf.OdfContainer(odf.OdfContainer.DocumentType.TEXT, null);
        t.odfcanvas.setOdfContainer(odfContainer);
        odtDocument = new ops.OdtDocument(t.odfcanvas);
        text = odtDocument.getRootNode();
        styles = odfContainer.rootElement.styles;
        meta = /**@type{!Element}*/(odfContainer.rootElement.meta);
        runtime.assert(Boolean(meta), "Missing <office:meta>!");

        // inject test data
        if (stylesbefore) {
            copyChildNodes(styles, stylesbefore);
        }
        if (metabefore) {
            copyChildNodes(meta, metabefore);
        }
        copyChildNodes(text, textbefore);

        // execute opspecs
        for (i = 0; i < opspecs.length; i += 1) {
            // runtime.log("Going to apply:"+runtime.toJson(opspecs[i]));
            op = t.operationFactory.create(opspecs[i]);
            t.opResult = op.execute(odtDocument);
            r.shouldBe(t, "t.opResult", "true");
        }
        // execute transformedOps
        for (i = 0; i < transformedOps.length; i += 1) {
            // runtime.log("Going to apply:"+runtime.toJson(transformedOps[i].spec()));
            t.opResult = transformedOps[i].execute(odtDocument);
            r.shouldBe(t, "t.opResult", "true");
        }

        // check result
        if (stylesbefore) {
            stylesafter.normalize();
            // for now just normalize the order of the styles to create
            // comparability
            // any possible orderless listing in the style subchilds will be
            // only cared for once it is needed
            sortChildrenByNSAttribute(stylesafter, odf.Namespaces.stylens, "name");
            styles.normalize();
            sortChildrenByNSAttribute(styles, odf.Namespaces.stylens, "name");
            if (!r.areNodesEqual(styles, stylesafter)) {
                t.styles = serialize(styles);
                t.stylesafter = serialize(stylesafter);
            } else {
                t.styles = t.stylesafter = "OK";
            }
            r.shouldBe(t, "t.styles", "t.stylesafter");
        }

        if (metabefore) {
            metaafter.normalize();
            // Sort the metadata fields by tag name
            // for easy comparing
            sortChildrenByTagName(/**@type{!Element}*/(metaafter));
            meta.normalize();
            sortChildrenByTagName(meta);
            if (!r.areNodesEqual(meta, metaafter)) {
                t.meta = serialize(meta);
                t.metaafter = serialize(metaafter);
            } else {
                t.meta = t.metaafter = "OK";
            }
            r.shouldBe(t, "t.meta", "t.metaafter");
        }

        textafter.normalize();
        normalizeCursorsAndAnchors(textafter);
        text.normalize();
        normalizeCursorsAndAnchors(text);
        if (!r.areNodesEqual(text, textafter)) {
            t.text = serialize(text);
            t.after = serialize(textafter);
        } else {
            t.text = t.after = "OK";
        }
        r.shouldBe(t, "t.text", "t.after");
    }

    function runTest(test) {
        var transformer = new ops.OperationTransformer();

        t.transformResult = transformer.transform(cloneSpecs(test.opspecsA), cloneSpecs(test.opspecsB));
        r.shouldBeNonNull(t, "t.transformResult");
        if (t.transformResult) {
            compareOpsExecution(test.opspecsA, t.transformResult.opSpecsB, test.before, test.after);
            compareOpsExecution(test.opspecsB, t.transformResult.opSpecsA, test.before, test.after);
        }
    }

    function makeTestIntoFunction(name, test) {
        var f = function () {
            runTest(test);
        };
        return {f: f, name: name, expectFail: test.isFailing};
    }

    function makeTestsIntoFunction(tests) {
        var functions = [], i;
        for (i in tests) {
            if (tests.hasOwnProperty(i)) {
                functions.push(makeTestIntoFunction(i, tests[i]));
            }
        }
        return functions;
    }

    function loadTests(url, tests) {
        var s = /**@type{!string}*/(runtime.readFileSync(url, "utf-8")),
            xml = runtime.parseXML(s),
            n,
            testName;
        runtime.assert(s.length > 0, "XML file is empty.");
        runtime.assert(xml.documentElement.localName === "tests", "Element is not <tests/>.");
        n = xml.documentElement.firstElementChild;
        while (n) {
            testName = n.getAttribute("name");
            runtime.assert(n.localName === "test", "Element is not <test/>.");
            runtime.assert(!tests.hasOwnProperty(testName), "Test name " + testName + " is not unique.");
            tests[testName] = parseTest(testName, n);
            n = n.nextElementSibling;
        }
    }

    function loadTestFiles(urls) {
        var trafoTests = {}, i;
        for (i = 0; i < urls.length; i += 1) {
            loadTests(urls[i], trafoTests);
        }
        return trafoTests;
    }

    this.setUp = function () {
        var testarea;
        t = {};
        testarea = core.UnitTest.provideTestAreaDiv();
        t.odfcanvas = new odf.OdfCanvas(testarea);
        t.operationFactory = new ops.OperationFactory();
    };
    this.tearDown = function () {
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };
    this.tests = function () {
        var pre = r.resourcePrefix();
        if (!tests) {
            tests = makeTestsIntoFunction(loadTestFiles(
                [pre + "ops/transformationtests.xml"]
            ));
        }
        return tests;
    };
    this.asyncTests = function () {
        return [
        ];
    };
};

ops.TransformationTests.prototype.description = function () {
    "use strict";
    return "Test the transformations of ODT operations described in an XML file on consistent ODT dom results.";
};
