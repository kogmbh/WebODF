/**
 * @license
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
 *
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

/*global runtime, core, odf, xmldom*/

runtime.loadClass("odf.OdfContainer");
runtime.loadClass("xmldom.LSSerializer");

/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
odf.OdfContainerTests = function OdfContainerTests(runner) {
    "use strict";
    var t, r = runner;
    this.setUp = function () {
        t = {};
    };
    this.tearDown = function () {
        t = {};
    };

    function serialize(element) {
        var serializer = new xmldom.LSSerializer();
        return serializer.writeToString(element, odf.Namespaces.namespaceMap);
    }

    function appendXmlsToNode(node, xmlFragments) {
        if (!xmlFragments) {
            return;
        }

        xmlFragments.forEach(function(xmlFragment) {
            var xml, doc, rootNode;

            xml = "<?xml version='1.0' encoding='UTF-8'?><dummy";
            Object.keys(odf.Namespaces.namespaceMap).forEach(function(key) {
                xml += " xmlns:" + key + '="' + odf.Namespaces.namespaceMap[key] + '"';
            });
            xml += ">" + xmlFragment + "</dummy>";

            doc = runtime.parseXML(xml);
            rootNode = node.ownerDocument.importNode(doc.documentElement, true);
            while (rootNode.firstChild) {
                node.appendChild(rootNode.firstChild);
            }
        });
    }

    function createNew() {
        t.odf = new odf.OdfContainer("", null);
        r.shouldBe(t, "t.odf.state", "odf.OdfContainer.DONE");
        r.shouldBeNonNull(t, "t.odf.rootElement");
        r.shouldBeNonNull(t, "t.odf.rootElement.meta");
        r.shouldBeNonNull(t, "t.odf.rootElement.settings");
        r.shouldBeNonNull(t, "t.odf.rootElement.scripts");
        r.shouldBeNonNull(t, "t.odf.rootElement.fontFaceDecls");
        r.shouldBeNonNull(t, "t.odf.rootElement.styles");
        r.shouldBeNonNull(t, "t.odf.rootElement.automaticStyles");
        r.shouldBeNonNull(t, "t.odf.rootElement.masterStyles");
        r.shouldBeNonNull(t, "t.odf.rootElement.body");
    }

    function createNewSaveAsAndLoad(callback) {
        t.odf = new odf.OdfContainer("", null);
        r.shouldBe(t, "t.odf.state", "odf.OdfContainer.DONE");
        t.odf.saveAs("test.odt", function (err) {
            t.err = err;
            r.shouldBeNull(t, "t.err");
            t.odf = new odf.OdfContainer("test.odt", function (odf) {
                t.odf = odf;
                r.shouldBe(t, "t.odf.state", "odf.OdfContainer.DONE");
                callback();
            });
        });
    }

    function doFontFaceDeclsSaveAsAndLoadRoundTrip(args, callback) {
        t.odf = new odf.OdfContainer("", null);
        appendXmlsToNode(t.odf.rootElement.fontFaceDecls,   args.keptFontFaceDecls);
        appendXmlsToNode(t.odf.rootElement.fontFaceDecls,   args.droppedFontFaceDecls);
        appendXmlsToNode(t.odf.rootElement.styles,          args.styles);
        appendXmlsToNode(t.odf.rootElement.automaticStyles, args.automaticStyles);

        t.odf.saveAs("fontFaceDeclsTest.odt", function (err) {
            t.err = err;
            r.shouldBeNull(t, "t.err");
            t.odf = new odf.OdfContainer("fontFaceDeclsTest.odt", function (odf) {
                t.odf = odf;
                t.fontFaceDecls = "<office:font-face-decls>" + args.keptFontFaceDecls.join('') + "</office:font-face-decls>";
                t.fontFaceDeclsAfter = serialize(odf.rootElement.fontFaceDecls);

                r.shouldBe(t, "t.odf.state", "odf.OdfContainer.DONE");
                r.shouldBeNonNull(t, "t.odf.rootElement.fontFaceDecls");
                r.shouldBe(t, "t.fontFaceDecls", "t.fontFaceDeclsAfter");

                callback();
            });
        });
    }

    function testStyleOnlyFontFaceDeclsSaveAsAndLoadRoundTrip(callback) {
        doFontFaceDeclsSaveAsAndLoadRoundTrip({
            keptFontFaceDecls: [
                '<style:font-face style:name="OpenSymbol" svg:font-family="OpenSymbol"></style:font-face>'
            ],
            droppedFontFaceDecls: [
                '<style:font-face style:name="Arial" svg:font-family="Arial" style:font-family-generic="swiss"></style:font-face>',
                '<style:font-face style:name="Arial1" svg:font-family="Arial" style:font-family-generic="system" style:font-pitch="variable"></style:font-face>',
                '<style:font-face style:name="Times New Roman" svg:font-family="&apos;Times New Roman&apos;" style:font-family-generic="roman" style:font-pitch="variable"></style:font-face>',
                '<style:font-face style:name="Droid Sans Fallback" svg:font-family="&apos;Droid Sans Fallback&apos;" style:font-family-generic="system" style:font-pitch="variable"></style:font-face>'
            ],
            styles: [
                '<style:style style:name="BulletSymbols" style:family="text"><style:text-properties style:font-name="OpenSymbol" style:font-name-asian="OpenSymbol" style:font-name-complex="OpenSymbol"/></style:style>'
            ]},
            callback
        );
    }

    function testDefaultStyleOnlyFontFaceDeclsSaveAsAndLoadRoundTrip(callback) {
        doFontFaceDeclsSaveAsAndLoadRoundTrip({
            keptFontFaceDecls: [
                '<style:font-face style:name="Arial1" svg:font-family="Arial" style:font-family-generic="system" style:font-pitch="variable"></style:font-face>',
                '<style:font-face style:name="Times New Roman" svg:font-family="&apos;Times New Roman&apos;" style:font-family-generic="roman" style:font-pitch="variable"></style:font-face>',
                '<style:font-face style:name="Droid Sans Fallback" svg:font-family="&apos;Droid Sans Fallback&apos;" style:font-family-generic="system" style:font-pitch="variable"></style:font-face>'
            ],
            droppedFontFaceDecls: [
                '<style:font-face style:name="Arial" svg:font-family="Arial" style:font-family-generic="swiss"></style:font-face>',
                '<style:font-face style:name="OpenSymbol" svg:font-family="OpenSymbol"></style:font-face>'
            ],
            styles: [
                '<style:default-style style:family="paragraph"><style:text-properties style:font-name="Times New Roman" style:font-name-asian="Droid Sans Fallback" style:font-name-complex="Arial1"/></style:default-style>'
            ]},
            callback
        );
    }

    function testAutomaticStyleOnlyFontFaceDeclsSaveAsAndLoadRoundTrip(callback) {
        doFontFaceDeclsSaveAsAndLoadRoundTrip({
            keptFontFaceDecls: [
                '<style:font-face style:name="Arial" svg:font-family="Arial" style:font-family-generic="swiss"></style:font-face>',
                '<style:font-face style:name="Arial1" svg:font-family="Arial" style:font-family-generic="system" style:font-pitch="variable"></style:font-face>'
            ],
            droppedFontFaceDecls: [
                '<style:font-face style:name="Times New Roman" svg:font-family="&apos;Times New Roman&apos;" style:font-family-generic="roman" style:font-pitch="variable"></style:font-face>',
                '<style:font-face style:name="OpenSymbol" svg:font-family="OpenSymbol"></style:font-face>',
                '<style:font-face style:name="Droid Sans Fallback" svg:font-family="&apos;Droid Sans Fallback&apos;" style:font-family-generic="system" style:font-pitch="variable"></style:font-face>'
            ],
            automaticStyles: [
                '<style:style style:name="T1" style:family="text"><style:text-properties style:font-name="Arial" style:font-name-complex="Arial1"/></style:style>'
            ]},
            callback
        );
    }

    function testMultiStylesFontFaceDeclsSaveAsAndLoadRoundTrip(callback) {
        doFontFaceDeclsSaveAsAndLoadRoundTrip({
            keptFontFaceDecls: [
                '<style:font-face style:name="Arial" svg:font-family="Arial" style:font-family-generic="swiss"></style:font-face>',
                '<style:font-face style:name="Arial1" svg:font-family="Arial" style:font-family-generic="system" style:font-pitch="variable"></style:font-face>',
                '<style:font-face style:name="Times New Roman" svg:font-family="&apos;Times New Roman&apos;" style:font-family-generic="roman" style:font-pitch="variable"></style:font-face>',
                '<style:font-face style:name="OpenSymbol" svg:font-family="OpenSymbol"></style:font-face>',
                '<style:font-face style:name="Droid Sans Fallback" svg:font-family="&apos;Droid Sans Fallback&apos;" style:font-family-generic="system" style:font-pitch="variable"></style:font-face>'
            ],
            droppedFontFaceDecls: [
                '<style:font-face style:name="Unused" svg:font-family="Arial" style:font-family-generic="swiss" style:font-pitch="variable"></style:font-face>'
            ],
            styles: [
                '<style:default-style style:family="paragraph"><style:text-properties style:font-name="Times New Roman" style:font-name-asian="Droid Sans Fallback" style:font-name-complex="Arial1"/></style:default-style>',
                '<style:style style:name="BulletSymbols" style:family="text"><style:text-properties style:font-name="OpenSymbol" style:font-name-asian="OpenSymbol" style:font-name-complex="OpenSymbol"/></style:style>'
            ],
            automaticStyles: [
                '<style:style style:name="T1" style:family="text"><style:text-properties style:font-name="Arial" style:font-name-complex="Arial1"/></style:style>'
            ]},
            callback
        );
    }


/*
    function compareZipEntryList(odf1path, odf2path, callback) {
        var z1 = new core.Zip(odf1path, function (err, z1) {
            t.err = err;
            r.shouldBeNull(t, "t.err");
            var z2 = new core.Zip(odf2path, function (err, z2) {
                t.err = err;
                r.shouldBeNull(t, "t.err");
                r.shouldBe(t, "t.e1", "t.e2.length");
                t.e1 = z1.getEntries();
                t.e2 = z2.getEntries();
                r.shouldBe(t, "t.e1.length", "t.e2.length");
                var i, j, f1;
                t.allPresent = true;
                for (i = 0; t.allPresent && i < t.e1.length; i += 1) {
                    f1 = t.e1[i].filename;
                    j = 0;
                    while (t.e2[j].filename !== f1 && j < t.e2.length) {
                        j += 1;
                    }
                    if (j === t.e2.length) {
                        runtime.log("Not present: " + f1);
                    } else {
                        t.date1 = t.e1[i].date;
                        t.date2 = t.e2[j].date;
                        // new date should be newer but not more than 3 years
                        r.shouldBe(t, "t.date2.getTime() - t.date1.getTime() >= 0", "true");
                        r.shouldBe(t, "t.date2.getTime() - t.date1.getTime() < 100000000000", "true");
                    }
                    t.allPresent = j !== t.e2.length;
                }
                r.shouldBe(t, "t.allPresent", "true");
                callback();
            });
            return z2;
        });
        return z1;
    }
    function compare(odf1, odf2, odf1path, odf2path, callback) {
        compareZipEntryList(odf1path, odf2path, callback);
    }
    function loadAndSave(callback) {
        var path = "odf/styletest.odt",
            newpath = "odf/newstyletest.odt";
        t.odf = new odf.OdfContainer(path, function (o1) {
            t.odf = o1;
            r.shouldBe(t, "t.odf.state", "odf.OdfContainer.DONE");
            t.odf.saveAs(newpath, function (err) {
                t.err = err;
                r.shouldBeNull(t, "t.err");
                t.odf2 = new odf.OdfContainer(newpath, function (o2) {
                    t.odf2 = o2;
                    r.shouldBe(t, "t.odf2.state", "odf.OdfContainer.DONE");
                    compare(o1, o2, path, newpath, callback);
                });
            });
        });
    }
*/
    this.tests = function () {
        return [
            createNew
        ];
    };
    this.asyncTests = function () {
        return [
            createNewSaveAsAndLoad,
            testDefaultStyleOnlyFontFaceDeclsSaveAsAndLoadRoundTrip,
            testStyleOnlyFontFaceDeclsSaveAsAndLoadRoundTrip,
            testAutomaticStyleOnlyFontFaceDeclsSaveAsAndLoadRoundTrip,
            testMultiStylesFontFaceDeclsSaveAsAndLoadRoundTrip
            //loadAndSave
        ];
    };
};
odf.OdfContainerTests.prototype.description = function () {
    "use strict";
    return "Test the OdfContainer class.";
};
(function () {
    "use strict";
    return odf.OdfContainerTests;
}());
