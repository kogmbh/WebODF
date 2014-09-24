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

/*global Node, NodeFilter, runtime, core, gui, ops, odf, xmldom*/

/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
ops.OperationTests = function OperationTests(runner) {
    "use strict";
    var self = this, r = runner, t, tests,
        opsTestHelper = new ops.OperationTestHelper();

    function serialize(element) {
        var serializer = new xmldom.LSSerializer();
        return serializer.writeToString(element, odf.Namespaces.namespaceMap);
    }

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
                    (attra > attrb ? 1 :
                                    -1);
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

    function parseOperation(node) {
        var op = {},
            child = node.firstChild,
            atts = node.attributes,
            att,
            n = atts.length,
            i,
            value;
        // read plain data by attributes
        for (i = 0; i < n; i += 1) {
            att = atts.item(i);
            value = att.value;
            // find integer values
            if (/(length|position)/i.test(att.localName)) {
                value = parseInt(value, 10);
            }
            // find boolean values
            if (/^(is|moveCursor)/.test(att.localName)) {
                value = JSON.parse(value);
            }
            op[att.nodeName] = value;
        }
        // read complex data by childs
        while (child) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                op[child.nodeName] = parseOperation(child);
            }
            child = child.nextSibling;
        }
        return op;
    }
    function checkWhitespaceTexts(element, expectedChar) {
        var text = element.firstChild;
        return (element.childNodes.length === 1
            && element.hasAttributeNS(odf.Namespaces.textns, "c") === false
            && text.nodeType === Node.TEXT_NODE
            && text.textContent === expectedChar);
    }
    function checkWhitespace(rootElement, localName, expectedChar) {
        var i,
            spaceElements = rootElement.getElementsByTagNameNS(odf.Namespaces.textns, localName);
        for (i = 0; i < spaceElements.length; i += 1) {
            if (!checkWhitespaceTexts(spaceElements[i], expectedChar)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Returns true if the specified node is an empty text node
     * @param {!Node} node
     * @return {!number}
     */
    function emptyNodes(node) {
        if (node.nodeType === Node.TEXT_NODE && node.length === 0) {
            return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
    }

    /**
     * Check that there are no empty text nodes in the supplied rootElement
     * @param {!Node} rootElement
     * @return {undefined}
     */
    function checkForEmptyTextNodes(rootElement) {
        var walker = rootElement.ownerDocument.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, emptyNodes, false),
            node;
        node = walker.nextNode();
        if (node) {
            r.testFailed("Empty text nodes were found");
        }
    }

    /**
     * Verify the StepCache to ensure it is consistent
     * @return {undefined}
     */
    function verifyStepsCache() {
        var rootNode = t.odtDocument.getRootNode();
        // Asking for the maximum available step will cause the cache to reverify itself completely
        t.odtDocument.convertDomPointToCursorStep(rootNode, rootNode.childNodes.length, core.StepDirection.PREVIOUS);
    }

    function parseTest(name, node) {
        var hasSetup = node.getAttribute("hasSetup") === "true",
            isFailing = node.getAttribute("isFailing") === "true",
            before = node.firstElementChild,
            opsElement = before.nextElementSibling,
            after = opsElement.nextElementSibling,
            ops = [],
            op,
            setup;
        runtime.assert(before.localName === "before", "Expected <before/> in " + name + ".");
        runtime.assert(checkWhitespace(before, "s", " "), "Unexpanded text:s element or text:c attribute found in " + name + ".");
        runtime.assert(checkWhitespace(before, "tab", "\t"), "Unexpanded text:tab element found in " + name + ".");
        runtime.assert(opsElement.localName === "ops", "Expected <ops/> in " + name + ".");
        runtime.assert(after.localName === "after", "Expected <after/> in " + name + ".");
        runtime.assert(checkWhitespace(after, "s", " "), "Unexpanded text:s element or text:c attribute found in " + name + ".");
        runtime.assert(checkWhitespace(after, "tab", "\t"), "Unexpanded text:tab element found in " + name + ".");
        opsTestHelper.removeInsignificantTextNodes(node);
        op = opsElement.firstElementChild;
        while (op) {
            runtime.assert(op.localName === "op", "Expected <op/> in " + name + ".");
            ops.push(parseOperation(op));
            op = op.nextElementSibling;
        }
        setup = self.setUps.hasOwnProperty(name) ? self.setUps[name]() : null;
        if (hasSetup) {
            runtime.assert(Boolean(setup), "Required setup for " + name + " was not found.");
        }
        return {
            isFailing: isFailing,
            setup : setup,
            before: before,
            ops: ops,
            after: after
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

    function getOfficeNSElement(node, localName) {
        var e = node.getElementsByTagNameNS(odf.Namespaces.officens, localName);

        if (e.length === 1) {
            return e[0];
        }
        return null;
    }

    function getOfficeTextElement(node) {
        return getOfficeNSElement(node, "text");
    }

    function getOfficeStylesElement(node) {
        return getOfficeNSElement(node, "styles");
    }

    function getOfficeAutoStylesElement(node) {
        return getOfficeNSElement(node, "automatic-styles");
    }

    function getOfficeMetaElement(node) {
        return getOfficeNSElement(node, "meta");
    }

    function runTest(test) {
        var text = t.odtDocument.getRootNode(),
            factory = new ops.OperationFactory(),
            i,
            op,
            textbefore = getOfficeTextElement(test.before),
            textafter = getOfficeTextElement(test.after),
            styles = t.odfContainer.rootElement.styles,
            meta = t.odfContainer.rootElement.meta,
            autostyles = t.odfContainer.rootElement.automaticStyles,
            stylesbefore = getOfficeStylesElement(test.before),
            stylesafter = getOfficeStylesElement(test.after),
            autostylesbefore = getOfficeAutoStylesElement(test.before),
            autostylesafter = getOfficeAutoStylesElement(test.after),
            metabefore = getOfficeMetaElement(test.before),
            metaafter = getOfficeMetaElement(test.after);

        // inject test data
        if (stylesbefore) {
            copyChildNodes(styles, stylesbefore);
        }
        if (autostylesbefore) {
            copyChildNodes(autostyles, autostylesbefore);
        }
        if (metabefore) {
            copyChildNodes(meta, metabefore);
        }
        copyChildNodes(text, textbefore);
        if (test.setup) {
            test.setup.setUp();
        }

        // execute test ops
        for (i = 0; i < test.ops.length; i += 1) {
            op = factory.create(test.ops[i]);
            op.execute(t.odtDocument);
            if (metabefore) {
                t.odtDocument.emit(ops.OdtDocument.signalOperationEnd, op);
            }
            checkForEmptyTextNodes(t.odtDocument.getCanvas().getElement());
        }

        verifyStepsCache();
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

        if (autostylesbefore) {
            autostylesbefore.normalize();
            sortChildrenByNSAttribute(autostylesafter, odf.Namespaces.stylens, "name");
            autostyles.normalize();
            sortChildrenByNSAttribute(autostyles, odf.Namespaces.stylens, "name");
            if (!r.areNodesEqual(autostyles, autostylesafter)) {
                t.autostyles = serialize(autostyles);
                t.autostylesafter = serialize(autostylesafter);
            } else {
                t.autostyles = t.autostylesafter = "OK";
            }
            r.shouldBe(t, "t.autostyles", "t.autostylesafter");
        }

        if (metabefore) {
            metaafter.normalize();
            // Sort the metadata fields by tag name
            // for easy comparing
            sortChildrenByTagName(metaafter);
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
        text.normalize();
        if (!r.areNodesEqual(text, textafter)) {
            t.text = serialize(text);
            t.after = serialize(textafter);
        } else {
            t.text = t.after = "OK";
        }
        r.shouldBe(t, "t.text", "t.after");
        if (test.setup) {
            test.setup.tearDown();
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
        var optests = {}, i;
        for (i = 0; i < urls.length; i += 1) {
            loadTests(urls[i], optests);
        }
        return optests;
    }

    this.setUp = function () {
        var testarea, properties;
        t = {};
        testarea = core.UnitTest.provideTestAreaDiv();
        t.odfcanvas = new odf.OdfCanvas(testarea);
        t.odfContainer = new odf.OdfContainer(odf.OdfContainer.DocumentType.TEXT, null);
        t.odfcanvas.setOdfContainer(t.odfContainer);
        t.odtDocument = new ops.OdtDocument(t.odfcanvas);
        properties = new ops.MemberProperties();
        properties.color = "black";
        properties.fullName = "Alice";
        properties.imageUrl = "";
        t.odtDocument.addMember(new ops.Member('Alice', properties));
    };
    this.tearDown = function () {
        t.odfcanvas.destroy(function () { return; });
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };
    this.tests = function () {
        var pre = r.resourcePrefix();
        if (!tests) {
            tests = makeTestsIntoFunction(loadTestFiles([
                pre + "ops/operationtests.xml",
                pre + "ops/allowedpositions.xml"
            ]));
        }
        return tests;
    };
    this.asyncTests = function () {
        return [
        ];
    };

    /*jslint emptyblock: true*/
    this.setUps = {
        "ApplyDirectStyling_FixesCursorPositions" : function () {
            // Test specifically requires the cursor node to have a child element of some sort to
            // reproduce an issue where the cursor ends up in an invalid position after the operation
            function appendToCursor(cursor) {
                cursor.getNode().appendChild(t.odtDocument.getDOMDocument().createElement("span"));
            }

            return {
                setUp: function () {t.odtDocument.subscribe(ops.Document.signalCursorAdded, appendToCursor); },
                tearDown: function () {t.odtDocument.unsubscribe(ops.Document.signalCursorAdded, appendToCursor); }
            };
        },
        "RemoveAnnotation_ranged" : function () {
            return {
                setUp: function () {
                    var rootElement = t.odfContainer.rootElement,
                        annotation = rootElement.getElementsByTagNameNS(odf.Namespaces.officens, "annotation")[0],
                        annotationEnd = rootElement.getElementsByTagNameNS(odf.Namespaces.officens, "annotation-end")[0];
                    annotation.annotationEndElement = annotationEnd;
                },
                tearDown: function () {}
            };
        },
        "RemoveText_CopesWithEmptyTextNodes" : function () {
            return {
                setUp: function () {
                    var rootElement = t.odfContainer.rootElement,
                        doc = rootElement.ownerDocument,
                        // Using doc.getElementById("paddedByEmptyTextNodes"); is blocked by firefox
                        // being strict about attributes named "id" from a DTD it does not know
                        paddedElement = doc.querySelector("*[id='paddedByEmptyTextNodes']");

                    paddedElement.insertBefore(doc.createTextNode(""), paddedElement.firstChild);
                    paddedElement.appendChild(doc.createTextNode(""));
                },
                tearDown: function () {}
            };
        }
    };
    /*jslint emptyblock: false*/
};
ops.OperationTests.prototype.description = function () {
    "use strict";
    return "Test the ODT operations described in an XML file.";
};
