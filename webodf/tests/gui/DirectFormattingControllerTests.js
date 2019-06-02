/**
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, core, gui, odf, ops*/

/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
gui.DirectFormattingControllerTests = function DirectFormattingControllerTests(runner) {
    "use strict";
    var r = runner,
        t,
        testarea,
        officens = odf.Namespaces.officens,
        utils = new core.Utils(),
        domUtils = core.DomUtils,
        inputMemberId = "Joe";

    /**
     * @constructor
     * @extends {odf.OdfContainer}
     * @param {!Element} node
     */
    function MockOdfContainer(node) {
        // OdfContainer maps the following properties onto the rootElement
        node.styles = node.getElementsByTagNameNS(odf.Namespaces.officens, "styles")[0];
        node.automaticStyles = node.getElementsByTagNameNS(odf.Namespaces.officens, "automatic-styles")[0];
        this.rootElement = /**@type{!odf.ODFDocumentElement}*/(node);
        this.getContentElement = function () { return node.getElementsByTagNameNS(officens, 'text')[0]; };
    }

    /**
     * Trying to avoid having to load a complete document for these tests. Mocking ODF
     * canvas allows some simplification in the testing setup
     * @constructor
     * @extends {odf.OdfCanvas} Well.... we don't really, but please shut your face closure compiler :)
     * @param {!Element} node
     */
    /*jslint emptyblock:true*/
    function MockOdfCanvas(node) {
        var container = new MockOdfContainer(node),
            formatting = new odf.Formatting();

        formatting.setOdfContainer(container);

        this.getFormatting = function() { return formatting; };
        this.odfContainer = function () { return container; };
        this.getElement = function () { return node; };
        this.refreshSize = function() { };
        this.rerenderAnnotations = function() { };
    }
    /*jslint emptyblock:false*/

    /**
     * @param {!ops.OdtDocument} odtDocument
     * @extends {ops.Session} Don't mind me... I'm just lying to closure compiler again!
     * @constructor
     */
    function MockSession(odtDocument) {
        var self = this;
        this.operations = [];

        this.getOdtDocument = function() {
            return odtDocument;
        };

        this.enqueue = function(ops) {
            self.operations.push.apply(self.operations, ops);
            ops.forEach(function(op) { op.execute(odtDocument); });
        };

        this.reset = function() {
            self.operations.length = 0;
        };
    }

    /**
     * Create a new ODT document with the specified text body
     * @param {!string} styles
     * @param {!string} xml
     * @return {!Element} Root document node
     */
    function createOdtDocument(styles, xml) {
        var domDocument = testarea.ownerDocument,
            testns = "urn:webodf:textcontrollertest",
            namespaceMap = utils.mergeObjects(odf.Namespaces.namespaceMap, {"test": testns}),
            doc,
            node,
            mock,
            range;

        xml = xml.replace("[", "<test:start/>").replace("]", "<test:end/>");
        doc = core.UnitTest.createOdtDocument("<office:styles>" + styles + "</office:styles>" +
                                                "<office:automatic-styles></office:automatic-styles>" +
                                                "<office:text>" + xml + "</office:text>", namespaceMap);
        node = /**@type{!Element}*/(domDocument.importNode(doc.documentElement, true));
        testarea.appendChild(node);

        mock = new MockOdfCanvas(node);
        t.odtDocument = new ops.OdtDocument(mock);
        t.session = new MockSession(t.odtDocument);
        t.sessionConstraints = new gui.SessionConstraints();
        t.sessionContext = new gui.SessionContext(t.session, inputMemberId);
        t.formattingController = new gui.DirectFormattingController(t.session, t.sessionConstraints, t.sessionContext,
                                                        inputMemberId,
                                                        new odf.ObjectNameGenerator(mock.odfContainer(), inputMemberId),
                                                        true, true);
        t.cursor = new ops.OdtCursor(inputMemberId, t.odtDocument);
        t.odtDocument.addCursor(t.cursor);

        if (node.getElementsByTagNameNS(testns, "start")[0]) {
            range = node.ownerDocument.createRange();
            range.setStartAfter(node.getElementsByTagNameNS(testns, "start")[0]);
            range.setEndAfter(node.getElementsByTagNameNS(testns, "end")[0]);
            t.cursor.setSelectedRange(range, true);
            // Clean up the test anchors after the selection has been set
            domUtils.getElementsByTagNameNS(node, testns, '*').forEach(function(node) {
                node.parentNode.removeChild(node);
            });
            t.odtDocument.DONOTUSE_emitSignalCursorMoved(t.cursor);
        }
        return node;
    }

    this.setUp = function () {
        testarea = core.UnitTest.provideTestAreaDiv();
        t = { doc: testarea.ownerDocument };
    };
    this.tearDown = function () {
        core.UnitTest.cleanupTestAreaDiv();
        t = {};
    };

    function getSelectionInfo_ReportedStyleSummaryIncludesCursorStyling() {
        createOdtDocument(
                "<style:style style:name='simple' style:family='paragraph'>" +
                    "<style:text-properties fo:font-weight='bold'/>" +
                "</style:style>",
            "<text:p text:style-name='simple'>[]</text:p>");

        t.formattingController.setBold(false);
        t.isBold = t.formattingController.isBold();

        r.shouldBe(t, "t.isBold", "false");
    }

    function getSelectionInfo_ReportedStyleSummaryStaysInAnnotationScope() {
        createOdtDocument(
                "<style:style style:name='simple' style:family='paragraph'>" +
                    "<style:text-properties fo:font-weight='bold'/>" +
                "</style:style>",
            "<text:p text:style-name='simple'><office:annotation office:name=\"alice_1\">" +
                "<text:list><text:list-item><text:p>[]</text:p></text:list-item></text:list>" +
            "</office:annotation></text:p>");

        t.isBold = t.formattingController.isBold();
        r.shouldBe(t, "t.isBold", "false");

        t.formattingController.setBold(true);
        t.isBold = t.formattingController.isBold();

        r.shouldBe(t, "t.isBold", "true");
    }

    function createCursorStyleOp_UseCachedStyle_ReturnsSetOpForCachedStyle() {
        createOdtDocument(
                "<style:style style:name='simple' style:family='paragraph'>" +
                    "<style:text-properties fo:font-weight='bold'/>" +
                "</style:style>",
            "<text:p text:style-name='simple'>[]</text:p>");

        t.operation = t.formattingController.createCursorStyleOp(0, 0, true);

        t.expectedOperation = {
            optype: "ApplyDirectStyling",
            timestamp: undefined,
            memberid: inputMemberId,
            position: 0,
            length: 0,
            setProperties: {
                'style:text-properties': {
                    'fo:font-weight': 'bold'
                }
            }
        };
        r.shouldBe(t, "t.operation.spec()", "t.expectedOperation");
    }

    function createParagraphStyleOp_OnLastStepInParagraph_CreatesParagraphStyleForNewParagraph() {
        createOdtDocument(
                "<style:style style:name='simple' style:family='paragraph'>" +
                    "<style:text-properties fo:font-weight='normal'/>" +
                "</style:style>" +
                "<style:style style:name='bold' style:family='text'>" +
                    "<style:text-properties fo:font-weight='bold'/>" +
                "</style:style>",
            "<text:p text:style-name='simple'><text:span text:style-name='bold'>[a]</text:span></text:p>");

        t.operations = t.formattingController.createParagraphStyleOps(1);

        t.expectedOperation0 = {
            optype: "AddStyle",
            timestamp: undefined,
            memberid: inputMemberId,
            styleName: 'auto74656_0',
            styleFamily: 'paragraph',
            isAutomaticStyle: true,
            setProperties: {
                'style:parent-style-name': 'simple',
                'style:family': 'paragraph',
                'style:text-properties': {
                    'fo:font-weight': 'bold'
                }
            }
        };
        r.shouldBe(t, "t.operations.shift().spec()", "t.expectedOperation0");

        t.expectedOperation1 = {
            optype: "SetParagraphStyle",
            timestamp: undefined,
            memberid: inputMemberId,
            styleName: 'auto74656_0',
            position: 1
        };
        r.shouldBe(t, "t.operations.shift().spec()", "t.expectedOperation1");
        r.shouldBe(t, "t.operations.shift()", "undefined");
    }

    function createParagraphStyleOp_NoSelectedText_ReturnsEmptyArray() {
        createOdtDocument("", "<text:p>a[</text:p><text:p>]</text:p>");

        t.operations = t.formattingController.createParagraphStyleOps(1);

        r.shouldBe(t, "t.operations.shift()", "undefined");
    }

    function createParagraphStyleOp_NoSelectedText_UsesStyleBeforeSelection() {
        createOdtDocument(
            "<style:style style:name='simple' style:family='paragraph'>" +
                "<style:text-properties fo:font-weight='normal'/>" +
            "</style:style>" +
            "<style:style style:name='bold' style:family='text'>" +
                "<style:text-properties fo:font-weight='bold'/>" +
            "</style:style>",
            "<text:p text:style-name='simple'><text:span text:style-name='bold'>a[</text:span></text:p><text:p>]</text:p>");

        t.operations = t.formattingController.createParagraphStyleOps(1);

        t.expectedOperation0 = {
            optype: "AddStyle",
            timestamp: undefined,
            memberid: inputMemberId,
            styleName: 'auto74656_0',
            styleFamily: 'paragraph',
            isAutomaticStyle: true,
            setProperties: {
                'style:parent-style-name': 'simple',
                'style:family': 'paragraph',
                'style:text-properties': {
                    'fo:font-weight': 'bold'
                }
            }
        };
        r.shouldBe(t, "t.operations.shift().spec()", "t.expectedOperation0");

        t.expectedOperation1 = {
            optype: "SetParagraphStyle",
            timestamp: undefined,
            memberid: inputMemberId,
            styleName: 'auto74656_0',
            position: 1
        };
        r.shouldBe(t, "t.operations.shift().spec()", "t.expectedOperation1");
        r.shouldBe(t, "t.operations.shift()", "undefined");
    }

    this.tests = function () {
        return r.name([
            getSelectionInfo_ReportedStyleSummaryIncludesCursorStyling,
            getSelectionInfo_ReportedStyleSummaryStaysInAnnotationScope,
            createCursorStyleOp_UseCachedStyle_ReturnsSetOpForCachedStyle,
            createParagraphStyleOp_OnLastStepInParagraph_CreatesParagraphStyleForNewParagraph,
            createParagraphStyleOp_NoSelectedText_ReturnsEmptyArray,
            createParagraphStyleOp_NoSelectedText_UsesStyleBeforeSelection
        ]);
    };
    this.asyncTests = function () {
        return [
        ];
    };
};
gui.DirectFormattingControllerTests.prototype.description = function () {
    "use strict";
    return "Test the DirectFormattingController class.";
};
