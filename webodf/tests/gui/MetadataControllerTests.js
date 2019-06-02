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

/*global runtime, core, gui, odf, ops, xmldom*/

/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
gui.MetadataControllerTests = function MetadataControllerTests(runner) {
    "use strict";
    var r = runner,
        t,
        testarea,
        internalMetadataTagnames = ["dc:creator", "dc:date", "meta:editing-cycles"],
        officens = odf.Namespaces.officens,
        inputMemberId = "Joe";

    /**
     * Trying to avoid having to load a complete document for these tests. Mocking ODF
     * canvas allows some simplification in the testing setup
     * @param {!Element} node
     * @extends {odf.OdfCanvas} Well.... we don't really, but please shut your face closure compiler :)
     * @constructor
     */
    /*jslint emptyblock:true*/
    function MockOdfCanvas(node) {
        var odfContainer;

        this.odfContainer = function() {return odfContainer; };
        this.getContentElement = function () { return node.getElementsByTagNameNS(officens, 'text')[0]; };
        this.getElement = function () { return node; };
        this.rootElement = node;
        this.refreshSize = function() { };
        this.rerenderAnnotations = function() { };

        // init
        odfContainer = new odf.OdfContainer(odf.OdfContainer.DocumentType.TEXT);
        odfContainer.setRootElement(node);
    }
    /*jslint emptyblock:false*/

    /**
     * @param {!ops.OdtDocument} odtDocument
     * @extends {ops.Session} Don't mind me... I'm just lying to closure compiler again!
     * @constructor
     */
    function MockSession(odtDocument) {
        var self = this,
            /**@type{!ops.OperationFactory}*/
            operationFactory = new ops.OperationFactory();

        this.getOdtDocument = function() {
            return odtDocument;
        };

        this.enqueue = function(operations) {
            operations.forEach(function(op) {
                var /**@type{?ops.Operation}*/
                    timedOp,
                    opspec = op.spec();

                // need to set the timestamp, otherwise things fail in odtDocument
                opspec.timestamp = Date.now();
                timedOp = /**@type {!ops.Operation}*/(operationFactory.create(opspec));
                odtDocument.executeOperation(timedOp);
            });
        };

        function init() {
            var op = new ops.OpAddMember();
            op.init({
                memberid: inputMemberId,
                setProperties: /**@type {!ops.MemberProperties}*/({
                    fullName: "Metha",
                    color: "black",
                    imageUrl: "avatar-joe.png"
                })
            });
            self.enqueue([op]);
        }
        init();
    }

    /**
     * @param {!gui.MetadataController} metadataController
     * @constructor
     */
    function MetadataChangeListener(metadataController) {
        var changedMetadata = null;

        function onMetadataChanged(changes) {
            if (changedMetadata === null) {
                changedMetadata = changes;
            } else {
                // merge signal data
                Object.keys(changes.setProperties).forEach(function (key) {
                    changedMetadata.setProperties[key] = changes.setProperties[key];
                });
                changes.removedProperties.forEach(function (key) {
                    delete changedMetadata.setProperties[key];
                    if (changedMetadata.removedProperties.indexOf(key) === -1) {
                        changedMetadata.removedProperties.push(key);
                    }
                });
            }

            // remove automatic updated metadata
            internalMetadataTagnames.forEach(function(internalTagName) {
                if (changedMetadata.setProperties && changedMetadata.setProperties[internalTagName]) {
                    delete changedMetadata.setProperties[internalTagName];
                }
            });
        }

        this.getChangedMetadata = function() {
            return changedMetadata;
        };

        this.reset = function() {
            changedMetadata = null;
        };

        // init
        metadataController.subscribe(gui.MetadataController.signalMetadataChanged, onMetadataChanged);
    }

    /**
     * Create a new ODT document with the specified meta data
     * @param {!string} xml
     * @return {!Element} Root document node
     */
    function createOdtDocument(xml) {
        var domDocument = testarea.ownerDocument,
            doc,
            node;

        doc = core.UnitTest.createOdtDocument("<office:meta>" + xml + "</office:meta><office:body><office:text></office:text></office:body>", odf.Namespaces.namespaceMap);
        node = /**@type{!Element}*/(domDocument.importNode(doc.documentElement, true));
        testarea.appendChild(node);

        t.odtDocument = new ops.OdtDocument(new MockOdfCanvas(node));
        t.session = new MockSession(t.odtDocument);
        t.metadataController = new gui.MetadataController(t.session, inputMemberId);
        t.metadataChangeListener = new MetadataChangeListener(t.metadataController);

        return node;
    }

    /**
     * Return a serialized string of the document metedata content, excluding the wrapping <office:text>
     * tags and all non-odf elements. Also excluding the internal metadata like dc:date.
     * If such an internal metadata should not be excluded because it is used for the tests,
     * pass it as parameter unfilteredTagName.
     * @param {?string|undefined=} unfilteredTagName  name of the tag which will not get removed as internal
     * @return {!string}
     */
    function serializeMetadataContent(unfilteredTagName) {
        var nsmap = odf.Namespaces.namespaceMap,
            serializer = new xmldom.LSSerializer(),
            filter = new odf.OdfNodeFilter(),
            result;

        serializer.filter = filter;
        result = serializer.writeToString(t.odtDocument.getDocumentElement().meta, nsmap);
        result = result.replace(/<[\/]{0,1}office:meta>/g, "");
        // remove automatic updated metadata, unless filtered
        internalMetadataTagnames.forEach(function(removedTagName) {
            if (removedTagName !== unfilteredTagName) {
                result = result.replace(new RegExp('<'+removedTagName+'>.*</'+removedTagName+'>'), "");
            }
        });
        return result;
    }

    /**
     * @param {!string} tagName
     * @param {!string} content
     * @return {!string}
     */
    function tagged(tagName, content) {
        return '<'+tagName+'>'+content+'</'+tagName+'>';
    }

    this.setUp = function () {
        testarea = core.UnitTest.provideTestAreaDiv();
        t = { doc: testarea.ownerDocument };
    };
    this.tearDown = function () {
        core.UnitTest.cleanupTestAreaDiv();
        t = {};
    };

    /**
     * @param {!string} metadataName
     * @param {?string} data
     * @return {undefined}
     */
    function getMetaData(metadataName, data) {
        createOdtDocument(data ? tagged(metadataName, data) : "");

        // check data via controller interface
        t.actualData = t.metadataController.getMetadata(metadataName);
        t.expectedData = data;
        r.shouldBe(t, "t.actualData", "t.expectedData");
    }

    /**
     * @param {!string} metadataName
     * @param {?string} oldData
     * @param {!string} newData
     * @param {!boolean} shouldBeUpdated
     * @return {undefined}
     */
    function updateMetaData(metadataName, oldData, newData, shouldBeUpdated) {
        var metaDataProperties = {};

        createOdtDocument(oldData ? tagged(metadataName, oldData) : "");
        t.metadataChangeListener.reset();

        metaDataProperties[metadataName] = newData;
        t.metadataController.setMetadata(metaDataProperties);

        // check data via controller interface
        t.actualData = t.metadataController.getMetadata(metadataName);
        t.expectedData = shouldBeUpdated ? newData : oldData;
        r.shouldBe(t, "t.actualData", "t.expectedData");
        // check also raw data
        t.actualDoc = serializeMetadataContent(metadataName);
        t.expectedDoc = (shouldBeUpdated || oldData) ? tagged(metadataName, /**@type{!string}*/(t.expectedData)) : "";
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
        // check event listener
        t.signalledChangedMetadata = t.metadataChangeListener.getChangedMetadata();
        if (shouldBeUpdated) {
            t.expectedSignalledChangedMetadata = {
                setProperties: {},
                removedProperties: []
            };
            t.expectedSignalledChangedMetadata.setProperties[metadataName] = t.expectedData;
        } else {
            t.expectedSignalledChangedMetadata = null;
        }
        r.shouldBe(t, "t.signalledChangedMetadata", "t.expectedSignalledChangedMetadata");
    }

    /**
     * @param {!string} metadataName
     * @param {?string} oldData
     * @param {!boolean} shouldBeRemoved
     * @return {undefined}
     */
    function removeMetaData(metadataName, oldData, shouldBeRemoved) {
        createOdtDocument(oldData ? tagged(metadataName, oldData) : "");
        t.metadataChangeListener.reset();

        t.metadataController.setMetadata(null, [metadataName]);

        // check data via controller interface
        t.actualData = t.metadataController.getMetadata(metadataName);
        t.expectedData = shouldBeRemoved ? null : oldData;
        r.shouldBe(t, "t.actualData", "t.expectedData");
        // check also raw data
        t.actualDoc = serializeMetadataContent(metadataName);
        t.expectedDoc = (shouldBeRemoved || !oldData) ? "" : tagged(metadataName, /**@type{!string}*/(oldData));
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
        // check event listener
        t.signalledChangedMetadata = t.metadataChangeListener.getChangedMetadata();
        t.expectedSignalledChangedMetadata = shouldBeRemoved ? {
            setProperties: {},
            removedProperties: [metadataName]
        } : null;
        r.shouldBe(t, "t.signalledChangedMetadata", "t.expectedSignalledChangedMetadata");
    }

    function getNonexisting_dc_data() {
        getMetaData("dc:date", null);
    }

    function getNonexisting_text_title() {
        getMetaData("text:title", null);
    }

    function getExisting_dc_data() {
        getMetaData("dc:date", "2013-08-01T18:44:55");
    }

    function getExisting_text_title() {
        getMetaData("text:title", "Old title");
    }

    function setNonexisting_dc_data() {
        updateMetaData("dc:date", null, "2010-01-01T00:00:00", false);
    }

    function setNonexisting_text_title() {
        updateMetaData("text:title", null, "New title", true);
    }

    function overwriteExisting_dc_data() {
        updateMetaData("dc:date", "2013-08-01T18:44:55", "2010-01-01T00:00:00", false);
    }

    function overwriteExisting_text_title() {
        updateMetaData("text:title", "Old title", "New title", true);
    }

    function removeExisting_dc_data() {
        removeMetaData("dc:date", "2013-08-01T18:44:55", false);
    }

    function removeExisting_text_title() {
        removeMetaData("text:title", "Old title", true);
    }

    this.tests = function () {
        return r.name([
            getNonexisting_dc_data,
            getNonexisting_text_title,

            getExisting_dc_data,
            getExisting_text_title,

            setNonexisting_dc_data,
            setNonexisting_text_title,

            overwriteExisting_dc_data,
            overwriteExisting_text_title,

            removeExisting_dc_data,
            removeExisting_text_title
        ]);
    };

    this.asyncTests = function () {
        return [
        ];
    };
};

gui.MetadataControllerTests.prototype.description = function () {
    "use strict";
    return "Test the MetadataController class.";
};
