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
 * @source: http://gitorious.org/webodf/webodf/
 */
/*global runtime, core, gui, odf, NodeFilter*/
runtime.loadClass("gui.SelectionMover");
runtime.loadClass("gui.StyleHelper");
runtime.loadClass("odf.Formatting");
/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
gui.StyleHelperTests = function StyleHelperTests(runner) {
    "use strict";
    var self = this,
        t,
        r = runner,
        namespace = {
            "text":"urn:oasis:names:tc:opendocument:xmlns:text:1.0",
            "office":"urn:oasis:names:tc:opendocument:xmlns:office:1.0",
            "style":"urn:oasis:names:tc:opendocument:xmlns:style:1.0",
            "fo":"urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
            "draw":"urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
            "svg":"urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0",
            "dr3d":"urn:oasis:names:tc:opendocument:xmlns:dr3d:1.0"
        };

    this.setUp = function () {
        t = {
            formatting: new odf.Formatting(),
            testArea : core.UnitTest.provideTestAreaDiv(),
            ns: namespace
        };
        t.styleHelper = new gui.StyleHelper(t.formatting);
    };
    this.tearDown = function () {
        t.range.detach();
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };
    function createDocument(dom) {
        var xml, container, fragment;

        xml = "<office:styles>";
        xml += "    <style:style style:name='P1' style:display-name='P1 Display' style:family='paragraph'>";
        xml += "        <style:text-properties fo:font-name='P1 Font' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='S1' style:display-name='S1 Display' style:family='text'>";
        xml += "        <style:text-properties fo:font-name='S1 Font' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='SBold' style:display-name='SBold Display' style:family='text'>";
        xml += "        <style:text-properties fo:font-weight='bold'/>";
        xml += "    </style:style>";
        xml += "    <style:style style:name='SItalic' style:family='text'>";
        xml += "        <style:text-properties fo:font-style='italic' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='SUnderline' style:family='text'>";
        xml += "        <style:text-properties style:text-underline-style='solid' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='SStrikeThrough' style:family='text'>";
        xml += "        <style:text-properties style:text-line-through-style='solid' />";
        xml += "    </style:style>";
        xml += "</office:styles>";

        xml += "<office:automatic-styles>";
        xml += "    <text:list-style style:name='L1' style:display-name='L1 Display'>";
        xml += "        <text:list-level-style-bullet text:level='1' text:bullet-char='*' />";
        xml += "        <text:list-level-style-bullet text:level='2' text:bullet-char='@' />";
        xml += "    </text:list-style>";
        xml += "    <text:list-style style:name='L2' style:display-name='L2 Display'>";
        xml += "        <text:list-level-style-number text:level='1' text:num-format='1' />";
        xml += "    </text:list-style>";
        xml += "</office:automatic-styles>";

        xml += "<office:text>" + dom + "</office:text>";

        fragment = core.UnitTest.createOdtDocument(xml, namespace);
        t.testArea.appendChild(fragment.documentElement);
        container = { rootElement : {
            styles : t.testArea.firstChild.childNodes[0],
            automaticStyles: t.testArea.firstChild.childNodes[1]
        }};
        t.formatting.setOdfContainer(container);
        t.range = t.testArea.ownerDocument.createRange();
        return t.testArea.firstChild.childNodes[2].childNodes.length === 1
            ? t.testArea.firstChild.childNodes[2].firstChild
            : t.testArea.firstChild.childNodes[2];
    }
    function getAppliedStyles_SimpleHierarchy() {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='S1'>A</text:span></text:p>");
        t.range.selectNode(t.doc.firstChild.firstChild);

        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        r.shouldBe(t, "t.appliedStyles.length", "1");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "2");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'S1', displayName: 'S1 Display', family: 'text'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'S1 Font'})");
    }
    function getAppliedStyles_NestedHierarchy() {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='S1'><text:span text:style-name='SBold'>A</text:span></text:span></text:p>");
        t.range.selectNode(t.doc.firstChild.firstChild);

        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        r.shouldBe(t, "t.appliedStyles.length", "1");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "3");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'SBold', displayName: 'SBold Display', family: 'text'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'S1', displayName: 'S1 Display', family: 'text'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'S1 Font', 'fo:font-weight': 'bold'})");
    }
    function getAppliedStyles_CompleteContent_OnlyReportsUniqueStyles() {
        t.doc = createDocument("<text:p text:style-name='P1'>A<text:span text:style-name='S1'>B</text:span>C</text:p>");
        t.range.selectNode(t.doc);

        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        r.shouldBe(t, "t.appliedStyles.length", "2");

        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "1");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'P1 Font'})");

        t.appliedStyles.shift();

        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "2");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'S1', displayName: 'S1 Display', family: 'text'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'S1 Font'})");
    }
    function getAppliedStyles_StartsAtChild_WithNoText() {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='S1'></text:span>B</text:p>");
        t.range.setStart(t.doc, 0);
        t.range.setEndBefore(t.doc.childNodes[1]);

        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        r.shouldBe(t, "t.appliedStyles.length", "0");
    }
    function getAppliedStyles_StartsAfterChild() {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='S1'></text:span>B</text:p>");
        t.range.setStart(t.doc, 1);
        t.range.setEnd(t.doc, 2);

        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        r.shouldBe(t, "t.appliedStyles.length", "1");

        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "1");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'P1 Font'})");
    }
    function getAppliedStyles_StartsAndEnds_InSameTextNode() {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='S1'></text:span>ABC</text:p>");
        t.range.setStart(t.doc.childNodes[1], 1);
        t.range.setEnd(t.doc.childNodes[1], 2);

        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        r.shouldBe(t, "t.appliedStyles.length", "1");

        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "1");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'P1 Font'})");
    }
    function getAppliedStyles_StartsAndEnds_InDifferentTextNodes() {
        t.doc = createDocument("<text:p text:style-name='P1'>A<text:span text:style-name='S1'>B</text:span>C</text:p>");
        t.range.setStart(t.doc.childNodes[0], 0);
        t.range.setEnd(t.doc.childNodes[2], 1);

        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        r.shouldBe(t, "t.appliedStyles.length", "2");

        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "1");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'P1 Font'})");

        t.appliedStyles.shift();

        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "2");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'S1', displayName: 'S1 Display', family: 'text'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'S1 Font'})");
    }
    function getAppliedStyles_SimpleList() {
        var xml = "<text:list text:style-name='L2'><text:list-item>" +
            "<text:p text:style-name='P1'><text:span text:style-name='S1'>A</text:span></text:p>" +
            "</text:list-item></text:list>";
        t.doc = createDocument(xml);
        t.range.selectNode(t.doc.firstChild.firstChild);

        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        r.shouldBe(t, "t.appliedStyles.length", "1");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "3");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'S1', displayName: 'S1 Display', family: 'text'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'L2', displayName: 'L2 Display', family: 'list-style'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'S1 Font'})");
    }
    function getAppliedStyles_NestedList() {
        var xml = "<text:list text:style-name='L1'><text:list-item>" +
            "<text:list text:style-name='L2'><text:list-item>" +
            "<text:p text:style-name='P1'><text:span text:style-name='S1'>A</text:span></text:p>" +
            "</text:list-item></text:list>" +
            "</text:list-item></text:list>";
        t.doc = createDocument(xml);
        t.range.selectNode(t.doc.firstChild.firstChild);

        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        r.shouldBe(t, "t.appliedStyles.length", "1");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "4");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'S1', displayName: 'S1 Display', family: 'text'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'L2', displayName: 'L2 Display', family: 'list-style'})");
        r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'L1', displayName: 'L1 Display', family: 'list-style'})");
        r.shouldBe(t, "t.appliedStyles[0]['style:text-properties']", "({'fo:font-name': 'S1 Font'})");
    }
    function getAppliedStyles_InvalidNodes() {
        var i, node,
            invalidNodes = [
            "draw:text-box",
            "svg:title",
            "dr3d:scene",
            "text:note-body",
            "text:ruby-text",
            "office:annotation",
            "office:binary-data",
            "office:event-listeners",
            "editinfo"
        ];

        for (i=0; i<invalidNodes.length; i+=1) {
            if (i > 0) {
                self.setUp();
            }

            node = "<" + invalidNodes[i] + "><text:span text:style-name='SBold'>test</text:span></" + invalidNodes[i] + ">";
            t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='S1'>A</text:span>" + node + "</text:p>");
            t.range.selectNode(t.doc);
            t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

            r.shouldBe(t, "t.appliedStyles.length", "1");
            r.shouldBe(t, "t.appliedStyles[0].orderedStyles.length", "2");
            r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'S1', displayName: 'S1 Display', family: 'text'})");
            r.shouldBe(t, "t.appliedStyles[0].orderedStyles.shift()", "({name: 'P1', displayName: 'P1 Display', family: 'paragraph'})");

            if (i<invalidNodes.length-1) {
                self.tearDown();
            }
        }
    }
    function isBold_CollapsedRangeReturnTrue () {
        var cursor = new core.Cursor(t.testArea.ownerDocument, "Joe"),
            mover;
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='SBold'>A</text:span><text:span text:style-name='S1'>B</text:span></text:p>");
        mover = new gui.SelectionMover(cursor, t.doc);
        mover.movePointForward(2);
        t.range = cursor.getSelectedRange();
        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        t.isBold = t.styleHelper.isBold(t.appliedStyles);
        r.shouldBe(t, "t.isBold", "true");
    }
    function isBold_ReturnTrue () {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='SBold'>A</text:span><text:span text:style-name='SBold'>B</text:span></text:p>");
        t.range.selectNode(t.doc);
        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        t.isBold = t.styleHelper.isBold(t.appliedStyles);
        r.shouldBe(t, "t.isBold", "true");
    }
    function isBold_ReturnFalse() {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='S1'>A</text:span><text:span text:style-name='SBold'>B</text:span></text:p>");
        t.range.selectNode(t.doc);
        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        t.isBold = t.styleHelper.isBold(t.appliedStyles);
        r.shouldBe(t, "t.isBold", "false");
    }
    function isItalic_ReturnTrue () {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='SItalic'>A</text:span><text:span text:style-name='SItalic'>B</text:span></text:p>");
        t.range.selectNode(t.doc);
        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        t.isItalic = t.styleHelper.isItalic(t.appliedStyles);
        r.shouldBe(t, "t.isItalic", "true");
    }
    function hasUnderline_ReturnTrue () {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='SUnderline'>A</text:span><text:span text:style-name='SUnderline'>B</text:span></text:p>");
        t.range.selectNode(t.doc);
        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        t.hasUnderline = t.styleHelper.hasUnderline(t.appliedStyles);
        r.shouldBe(t, "t.hasUnderline", "true");
    }
    function hasStrikeThrough_ReturnTrue () {
        t.doc = createDocument("<text:p text:style-name='P1'><text:span text:style-name='SStrikeThrough'>A</text:span><text:span text:style-name='SStrikeThrough'>B</text:span></text:p>");
        t.range.selectNode(t.doc);
        t.appliedStyles = t.styleHelper.getAppliedStyles(t.range);

        t.hasStrikeThrough = t.styleHelper.hasStrikeThrough(t.appliedStyles);
        r.shouldBe(t, "t.hasStrikeThrough", "true");
    }
    this.tests = function () {
        return [
            getAppliedStyles_SimpleHierarchy,
            getAppliedStyles_NestedHierarchy,
            getAppliedStyles_StartsAtChild_WithNoText,
            getAppliedStyles_StartsAfterChild,
            getAppliedStyles_CompleteContent_OnlyReportsUniqueStyles,
            getAppliedStyles_StartsAndEnds_InSameTextNode,
            getAppliedStyles_StartsAndEnds_InDifferentTextNodes,
            getAppliedStyles_SimpleList,
            getAppliedStyles_NestedList,
            getAppliedStyles_InvalidNodes,

            isBold_CollapsedRangeReturnTrue,
            isBold_ReturnTrue,
            isBold_ReturnFalse,
            isItalic_ReturnTrue,
            hasUnderline_ReturnTrue,
            hasStrikeThrough_ReturnTrue
        ];
    };
    this.asyncTests = function () {
        return [];
    };
};
gui.StyleHelperTests.prototype.description = function () {
    "use strict";
    return "Test the StyleHelperTests class.";
};
(function () {
    "use strict";
    return gui.StyleHelperTests;
}());
