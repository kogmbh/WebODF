/**
 * @license
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global core, ops, odf, gui, runtime*/

runtime.loadClass("core.EventNotifier");
runtime.loadClass("core.Utils");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("ops.OpAddStyle");
runtime.loadClass("ops.OpSetParagraphStyle");
runtime.loadClass("gui.StyleHelper");

/**
 * @constructor
 * @param {!ops.Session} session
 * @param {!string} inputMemberId
 * @param {!odf.ObjectNameGenerator} objectNameGenerator
 */
gui.DirectParagraphStyler = function DirectParagraphStyler(session, inputMemberId, objectNameGenerator) {
    "use strict";

    var odtDocument = session.getOdtDocument(),
        utils = new core.Utils(),
        odfUtils = new odf.OdfUtils(),
        styleHelper = new gui.StyleHelper(odtDocument.getFormatting()),
        eventNotifier = new core.EventNotifier([gui.DirectParagraphStyler.paragraphStylingChanged]),
        // cached values
        isAlignedLeftValue,
        isAlignedCenterValue,
        isAlignedRightValue,
        isAlignedJustifiedValue;

    /**
     * @return {undefined}
     */
    function updatedCachedValues() {
        var cursor = odtDocument.getCursor(inputMemberId),
            range = cursor && cursor.getSelectedRange(),
            diffMap;

        function noteChange(oldValue, newValue, id) {
            if (oldValue !== newValue) {
                if (diffMap === undefined) {
                    diffMap = {};
                }
                diffMap[id] = newValue;
            }
            return newValue;
        }
        // TODO: these are mutually exclusive values usually, so just one value with the alignment style might be enough
        // but in a range with multiple paragraphs there could be multiple alignment styles, which should be reflected somehow
        isAlignedLeftValue = noteChange(isAlignedLeftValue, range ? styleHelper.isAlignedLeft(range) : false, 'isAlignedLeft');
        isAlignedCenterValue = noteChange(isAlignedCenterValue, range ? styleHelper.isAlignedCenter(range) : false, 'isAlignedCenter');
        isAlignedRightValue = noteChange(isAlignedRightValue, range ? styleHelper.isAlignedRight(range) : false, 'isAlignedRight');
        isAlignedJustifiedValue = noteChange(isAlignedJustifiedValue, range ? styleHelper.isAlignedJustified(range) : false, 'isAlignedJustified');

        if (diffMap) {
            eventNotifier.emit(gui.DirectParagraphStyler.paragraphStylingChanged, diffMap);
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorAdded(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    function onCursorRemoved(memberId) {
        if (memberId === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorMoved(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @return {undefined}
     */
    function onParagraphStyleModified() {
        // TODO: check if the cursor (selection) is actually affected
        updatedCachedValues();
    }

    /**
     * @param {!Object} args
     * @return {undefined}
     */
    function onParagraphChanged(args) {
        var cursor = odtDocument.getCursor(inputMemberId);

        if (cursor && odtDocument.getParagraphElement(cursor.getNode()) === args.paragraphElement) {
            updatedCachedValues();
        }
    }

    /**
     * @return {!boolean}
     */
    this.isAlignedLeft = function() {
        return isAlignedLeftValue;
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedCenter = function() {
        return isAlignedCenterValue;
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedRight = function() {
        return isAlignedRightValue;
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedJustified = function() {
        return isAlignedJustifiedValue;
    };

    /**
     * @param {!function(!Object) : !Object} applyDirectStyling
     * @return {undefined}
     */
    function applyParagraphDirectStyling(applyDirectStyling) {
        var range = odtDocument.getCursor(inputMemberId).getSelectedRange(),
            position = odtDocument.getCursorPosition(inputMemberId),
            paragraphs = odfUtils.getParagraphElements(range),
            formatting = odtDocument.getFormatting();

        paragraphs.forEach(function(paragraph) {
            var paragraphStartPoint = position + odtDocument.getDistanceFromCursor(inputMemberId, paragraph, 0),
                paragraphStyleName = paragraph.getAttributeNS(odf.Namespaces.textns, "style-name"),
                newParagraphStyleName = objectNameGenerator.generateStyleName(),
                opAddStyle,
                opSetParagraphStyle,
                paragraphProperties;

            // getDistanceFromCursor returns the last position before the node & offset
            // The first index of the paragraph may not be walkable
            paragraphStartPoint += 1;

            if (paragraphStyleName) {
                paragraphProperties = formatting.createDerivedStyleObject(paragraphStyleName, "paragraph", {});
            }
            paragraphProperties = applyDirectStyling(paragraphProperties || {});
            opAddStyle = new ops.OpAddStyle();
            opAddStyle.init({
                memberid: inputMemberId,
                styleName: newParagraphStyleName,
                styleFamily: 'paragraph',
                isAutomaticStyle: true,
                setProperties: paragraphProperties
            });

            opSetParagraphStyle = new ops.OpSetParagraphStyle();
            opSetParagraphStyle.init({
                memberid: inputMemberId,
                styleName: newParagraphStyleName,
                position: paragraphStartPoint
            });

            session.enqueue(opAddStyle);
            session.enqueue(opSetParagraphStyle);
        });
    }

    /**
     * @param {!Object} styleOverrides
     * @return {undefined}
     */
    function applySimpleParagraphDirectStyling(styleOverrides) {
        applyParagraphDirectStyling(function(paragraphStyle) { return utils.mergeObjects(paragraphStyle, styleOverrides); });
    }

    /**
     * @param {!string} alignment
     * @return {undefined}
     */
    function alignParagraph(alignment) {
        applySimpleParagraphDirectStyling({"style:paragraph-properties" : {"fo:text-align" : alignment}});
    }

    /**
     * @return {!boolean}
     */
    this.alignParagraphLeft = function() {
        alignParagraph('left');
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.alignParagraphCenter = function() {
        alignParagraph('center');
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.alignParagraphRight = function() {
        alignParagraph('right');
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.alignParagraphJustified = function() {
        alignParagraph('justify');
        return true;
    };

    /**
     * @param {!number} direction
     * @param {!Object} paragraphStyle
     * @return {!Object}
     */
    function modifyParagraphIndent(direction, paragraphStyle) {
        var tabStopDistance = odtDocument.getFormatting().getDefaultTabStopDistance(),
            paragraphProperties = paragraphStyle["style:paragraph-properties"],
            indentValue = paragraphProperties && paragraphProperties["fo:margin-left"],
            indent = indentValue && odfUtils.parseLength(indentValue),
            newIndent;

        if (indent && indent.unit === tabStopDistance.unit) {
            newIndent = (indent.value + (direction * tabStopDistance.value)) + indent.unit;
        } else {
            // TODO unit-conversion would allow indent to work irrespective of the paragraph's indent type
            newIndent = (direction * tabStopDistance.value) + tabStopDistance.unit;
        }

        return utils.mergeObjects(paragraphStyle, {"style:paragraph-properties" : {"fo:margin-left" : newIndent}});
    }

    /**
     * @return {!boolean}
     */
    this.indent = function() {
        applyParagraphDirectStyling(modifyParagraphIndent.bind(null, 1));
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.outdent = function() {
        applyParagraphDirectStyling(modifyParagraphIndent.bind(null, -1));
        return true;
    };


    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function (eventid, cb) {
        eventNotifier.subscribe(eventid, cb);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function (eventid, cb) {
        eventNotifier.unsubscribe(eventid, cb);
    };

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function(callback) {
        odtDocument.unsubscribe(ops.OdtDocument.signalCursorAdded, onCursorAdded);
        odtDocument.unsubscribe(ops.OdtDocument.signalCursorRemoved, onCursorRemoved);
        odtDocument.unsubscribe(ops.OdtDocument.signalCursorMoved, onCursorMoved);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        callback();
    };

    function init() {
        odtDocument.subscribe(ops.OdtDocument.signalCursorAdded, onCursorAdded);
        odtDocument.subscribe(ops.OdtDocument.signalCursorRemoved, onCursorRemoved);
        odtDocument.subscribe(ops.OdtDocument.signalCursorMoved, onCursorMoved);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        updatedCachedValues();
    }

    init();
};

/**@const*/gui.DirectParagraphStyler.paragraphStylingChanged = "paragraphStyling/changed";

(function () {
    "use strict";
    return gui.DirectParagraphStyler;
}());

