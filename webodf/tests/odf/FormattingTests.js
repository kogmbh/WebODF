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
/*global runtime, core, odf*/
runtime.loadClass("odf.Formatting");
/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
odf.FormattingTests = function FormattingTests(runner) {
    "use strict";
    var t,
        r = runner,
        namespace = {
            "text":"urn:oasis:names:tc:opendocument:xmlns:text:1.0",
            "office":"urn:oasis:names:tc:opendocument:xmlns:office:1.0",
            "style":"urn:oasis:names:tc:opendocument:xmlns:style:1.0",
            "fo":"urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
        };

    this.setUp = function () {
        t = {
            formatting : new odf.Formatting(),
            body : core.UnitTest.provideTestAreaDiv(),
            ns : namespace
        };
    };
    this.tearDown = function () {
        t.range.detach();
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };
    /**
     * @param {!string} dom
     * @param {string=} pageLayoutStyle
     * @returns {!Node}
     */
    function createDocument(dom, pageLayoutStyle) {
        var xml, container, fragment;

        xml = "<office:styles>";
        xml += "    <style:style style:name='P1' style:display-name='P1 Display' style:family='paragraph' master-page-name='Index'>";
        xml += "        <style:text-properties fo:font-name='P1 Font' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='P2' style:display-name='P1 Display' style:family='paragraph'>";
        xml += "        <style:text-properties fo:font-name='P2 Font' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='S1' style:display-name='S1 Display' style:family='text'>";
        xml += "        <style:text-properties fo:font-name='S1 Font' />";
        xml += "    </style:style>";
        xml += "    <style:style style:name='S2' style:display-name='S2 Display' style:family='text'>";
        xml += "        <style:text-properties fo:font-weight='bold'/>";
        xml += "    </style:style>";
        xml += "</office:styles>";

        xml += "<office:automatic-styles>";
        xml += pageLayoutStyle;
        xml += "    <text:list-style style:name='L1' style:display-name='L1 Display'>";
        xml += "        <text:list-level-style-bullet text:level='1' text:bullet-char='*' />";
        xml += "        <text:list-level-style-bullet text:level='2' text:bullet-char='@' />";
        xml += "    </text:list-style>";
        xml += "    <text:list-style style:name='L2' style:display-name='L2 Display'>";
        xml += "        <text:list-level-style-number text:level='1' text:num-format='1' />";
        xml += "    </text:list-style>";
        xml += "    <style:style style:name='autoWithInherit' style:parent-style-name='S1' style:family='text'>";
        xml += "        <style:text-properties fo:font-weight='bold'/>";
        xml += "    </style:style>";
        xml += "    <style:style style:name='autoWithoutInherit' style:family='text'>";
        xml += "        <style:text-properties fo:font-weight='bold'/>";
        xml += "    </style:style>";
        xml += "</office:automatic-styles>";
        xml += "<office:text>" + dom + "</office:text>";

        xml += "<office:master-styles>";
        xml += "    <style:master-page style:name='Standard' style:page-layout-name='pm1'/>";
        xml += "    <style:master-page style:name='Index' style:page-layout-name='pm2'/>";
        xml += "</office:master-styles>";

        fragment = core.UnitTest.createOdtDocument(xml, namespace);
        t.body.appendChild(fragment.documentElement);
        container = { rootElement : {
            styles : t.body.firstChild.childNodes[0],
            automaticStyles: t.body.firstChild.childNodes[1],
            masterStyles : t.body.firstChild.childNodes[2]
        }};
        t.formatting.setOdfContainer(container);
        t.range = t.body.ownerDocument.createRange();
        return t.body.firstChild.childNodes[2].firstChild;
    }
    function getStyleElement_ParagraphStyle() {
        createDocument("<text:p/>");

        t.element = t.formatting.getStyleElement("P1", "paragraph");

        r.shouldBeNonNull(t, "t.element");
        r.shouldBe(t, "t.element.getAttributeNS(t.ns.style, 'name')", "'P1'");
    }
    function getStyleElement_TextStyle() {
        createDocument("<text:p/>");

        t.element = t.formatting.getStyleElement("S1", "text");

        r.shouldBeNonNull(t, "t.element");
        r.shouldBe(t, "t.element.getAttributeNS(t.ns.style, 'name')", "'S1'");
    }
    function getStyleElement_ListStyle() {
        createDocument("<text:p/>");

        t.element = t.formatting.getStyleElement("L2", "list-style");

        r.shouldBeNonNull(t, "t.element");
        r.shouldBe(t, "t.element.getAttributeNS(t.ns.style, 'name')", "'L2'");
    }
    function getStyleElement_MismatchedFamily_ReturnsNull() {
        createDocument("<text:p/>");

        t.element = t.formatting.getStyleElement("L2", "paragraph");

        r.shouldBeNull(t, "t.element");
    }
    function updateStyle_UpdatesStyleElement() {
        createDocument("<text:p/>");
        t.element = t.formatting.getStyleElement("P1", "paragraph");

        t.formatting.updateStyle(t.element, {
            "style:family" : "frog",
            "style:paragraph-properties": { "fo:background-color" : "red" },
            "style:text-properties": { "fo:font-size" : "12pt" }
        });

        r.shouldBe(t, "t.element.getAttributeNS(t.ns.style, 'family')", "'frog'");

        t.paragraphProperties = t.element.getElementsByTagNameNS(t.ns.style, 'paragraph-properties')[0];
        t.textProperties = t.element.getElementsByTagNameNS(t.ns.style, 'text-properties')[0];
        r.shouldBe(t, "t.paragraphProperties.getAttributeNS(t.ns.fo, 'background-color')", "'red'");
        r.shouldBe(t, "t.textProperties.getAttributeNS(t.ns.fo, 'font-size')", "'12pt'");
        r.shouldBe(t, "t.textProperties.getAttributeNS(t.ns.fo, 'font-name')", "'P1 Font'");
    }
    function updateStyle_IgnoresUnknownElementPrefixes() {
        var i;
        createDocument("<text:p/>");
        t.element = t.formatting.getStyleElement("P1", "paragraph");

        t.formatting.updateStyle(t.element, {
            "custom:item" : "custom-value",
            "style:family" : "frog"
        });

        r.shouldBe(t, "t.element.getAttributeNS(t.ns.style, 'family')", "'frog'");
        for (i = 0; i < t.element.attributes.length; i += 1) {
            t.attribute = t.element.attributes[i];
            r.shouldBe(t, "t.attribute.value === 'custom-value'", "false");
        }
    }
    function createDerivedStyleObject_Style() {
        createDocument("<text:p/>");

        t.newStyle = t.formatting.createDerivedStyleObject("P1", "paragraph", {"derived" : true});

        r.shouldBe(t, "t.newStyle['style:parent-style-name']", "'P1'");
        r.shouldBe(t, "t.newStyle['style:family']", "'paragraph'");
        r.shouldBe(t, "t.newStyle['derived']", "true");
    }
    function createDerivedStyleObject_AutomaticStyle_Inherited() {
        createDocument("<text:p/>");

        t.newStyle = t.formatting.createDerivedStyleObject("autoWithInherit", "text", {"derived" : true});

        r.shouldBe(t, "t.newStyle['style:parent-style-name']", "'S1'");
        r.shouldBe(t, "t.newStyle['style:family']", "'text'");
        r.shouldBe(t, "t.newStyle['style:text-properties']", "({ 'fo:font-weight' : 'bold' })");
    }
    function createDerivedStyleObject_AutomaticStyle_NonInherited() {
        createDocument("<text:p/>");

        t.newStyle = t.formatting.createDerivedStyleObject("autoWithoutInherit", "text", {"derived" : true});

        r.shouldBe(t, "t.newStyle.hasOwnProperty('style:parent-style-name')", "false");
        r.shouldBe(t, "t.newStyle['style:family']", "'text'");
        r.shouldBe(t, "t.newStyle['style:text-properties']", "({ 'fo:font-weight' : 'bold' })");
    }
    function getStyleAttributes_ReturnsAllStyleAttributes() {
        createDocument("<text:p/>");
        t.styleElement = t.formatting.getStyleElement('P1', 'paragraph');

        t.styleAttributes = t.formatting.getStyleAttributes(t.styleElement);

        r.shouldBe(t, "t.styleAttributes['style:name']", "'P1'");
        r.shouldBe(t, "t.styleAttributes['style:display-name']", "'P1 Display'");
        r.shouldBe(t, "t.styleAttributes['style:family']", "'paragraph'");
        r.shouldBe(t, "t.styleAttributes['style:text-properties']", "({'fo:font-name':'P1 Font'})");
    }
    function getContentSize_PageSizePaddingAndMarginSpecified() {
        createDocument("<text:p style:name='P1'/>", "<style:page-layout name='pm2' scope='document-styles'><style:page-layout-properties fo:page-width='10cm' fo:page-height='20cm' fo:margin-top='1cm' fo:margin-bottom='0cm' fo:margin-left='1.5cm' fo:margin-right='1.5cm' fo:padding='3cm' /></style:page-layout>");
        t.contentSize = t.formatting.getContentSize("P1", "paragraph");
        r.shouldBe(t, "t.contentSize", "({'width':1,'height':13})");
    }
    function getContentSize_PageSizePaddingAndMarginNotSpecified() {
        createDocument("<text:p style:name='P2'/>", "<style:page-layout name='pm1' scope='document-styles'><style:page-layout-properties style:print-orientation='landscape' /></style:page-layout>");
        t.contentSize = t.formatting.getContentSize("P2", "paragraph");
        r.shouldBe(t, "t.contentSize", "({'width':25.7,'height':17.001})");
    }
    this.tests = function () {
        return [
            getStyleElement_ParagraphStyle,
            getStyleElement_TextStyle,
            getStyleElement_ListStyle,
            getStyleElement_MismatchedFamily_ReturnsNull,

            updateStyle_UpdatesStyleElement,
            updateStyle_IgnoresUnknownElementPrefixes,

            createDerivedStyleObject_Style,
            createDerivedStyleObject_AutomaticStyle_Inherited,
            createDerivedStyleObject_AutomaticStyle_NonInherited,

            getStyleAttributes_ReturnsAllStyleAttributes,

            getContentSize_PageSizePaddingAndMarginSpecified,
            getContentSize_PageSizePaddingAndMarginNotSpecified
        ];
    };
    this.asyncTests = function () {
        return [];
    };
};
odf.FormattingTests.prototype.description = function () {
    "use strict";
    return "Test the Formatting class.";
};
(function () {
    "use strict";
    return odf.FormattingTests;
}());
