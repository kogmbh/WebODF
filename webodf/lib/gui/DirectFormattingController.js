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
 * You should have received a copy of the GNU Affero General Public License
 * along with this code.  If not, see <http://www.gnu.org/licenses/>.
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
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global core, ops, odf, gui, runtime*/

runtime.loadClass("core.EventNotifier");
runtime.loadClass("core.Utils");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("ops.OpAddStyle");
runtime.loadClass("ops.OpApplyDirectStyling");
runtime.loadClass("ops.OpSetParagraphStyle");
runtime.loadClass("gui.StyleSummary");

/**
 * @constructor
 * @param {!ops.Session} session
 * @param {!string} inputMemberId
 * @param {!odf.ObjectNameGenerator} objectNameGenerator
 * @param {!boolean} directParagraphStylingEnabled
 */
gui.DirectFormattingController = function DirectFormattingController(session, inputMemberId, objectNameGenerator, directParagraphStylingEnabled) {
    "use strict";

    var self = this,
        odtDocument = session.getOdtDocument(),
        utils = new core.Utils(),
        odfUtils = new odf.OdfUtils(),
        eventNotifier = new core.EventNotifier([
            gui.DirectFormattingController.textStylingChanged,
            gui.DirectFormattingController.paragraphStylingChanged
        ]),
        /**@const*/textns = odf.Namespaces.textns,
        /**@const*/FILTER_ACCEPT = core.PositionFilter.FilterResult.FILTER_ACCEPT,
        directCursorStyleProperties,
        // cached text settings
        selectionAppliedStyles = [],
        selectionStylesSummary = new gui.StyleSummary(selectionAppliedStyles);

    /**
     * Fetch all the text nodes in the specified range, or if the range is collapsed, the node just to
     * the left of the cursor.
     * @param {!Range} range
     * @return {!Array.<!Node>}
     */
    function getNodes(range) {
        var container, nodes;

        if (range.collapsed) {
            container = range.startContainer;
            // Attempt to find the node at the specified startOffset within the startContainer.
            // In the case where a range starts at (parent, 1), this will mean the
            // style information is retrieved for the child node at index 1.

            // Also, need to check the length is less than the number of child nodes, as a range is
            // legally able to start at (parent, parent.childNodes.length).
            if (container.hasChildNodes() && range.startOffset < container.childNodes.length) {
                container = container.childNodes.item(range.startOffset);
            }
            nodes = [container];
        } else {
            nodes = odfUtils.getTextNodes(range, true);
        }

        return nodes;
    }

    /**
     * Get all styles currently applied to the selected range. If the range is collapsed,
     * this will return the style the next inserted character will have
     * @return {!Array.<Object>}
     */
    function getSelectionAppliedStyles() {
        var cursor = odtDocument.getCursor(inputMemberId),
            range = cursor && cursor.getSelectedRange(),
            nodes = range ? getNodes(range) : [],
            selectionStyles = odtDocument.getFormatting().getAppliedStyles(nodes);

        if (selectionStyles[0] && directCursorStyleProperties) {
            // direct cursor styles add to the style of the existing range, overriding where defined
            selectionStyles[0] = utils.mergeObjects(selectionStyles[0],
                /**@type {!Object}*/(directCursorStyleProperties));
        }
        return selectionStyles;
    }

    /**
     * Create a map containing all the keys that have a different value
     * in the new summary object.
     * @param {!Array.<!string>} keys Array of function names to evaluate and diff
     * @param {!gui.StyleSummary} oldSummary
     * @param {!gui.StyleSummary} newSummary
     * @return {!Object.<!string, *>}
     */
    function createDiff(keys, oldSummary, newSummary) {
        var diffMap = {};
        keys.forEach(function(funcName) {
            var oldValue = oldSummary[funcName](),
                newValue = newSummary[funcName]();

            if (oldValue !== newValue) {
                diffMap[funcName] = newValue;
            }
        });
        return diffMap;
    }

    /**
     * @return {undefined}
     */
    function updateSelectionStylesInfo() {
        var textStyleDiff,
            paragraphStyleDiff,
            newSelectionStylesSummary,
            textStylingKeys = ['isBold', 'isItalic', 'hasUnderline', 'hasStrikeThrough', 'fontSize', 'fontName'],
            paragraphStylingKeys = ['isAlignedLeft', 'isAlignedCenter', 'isAlignedRight', 'isAlignedJustified'];

        selectionAppliedStyles = getSelectionAppliedStyles();
        newSelectionStylesSummary = new gui.StyleSummary(selectionAppliedStyles);

        textStyleDiff = createDiff(textStylingKeys, selectionStylesSummary, newSelectionStylesSummary);
        paragraphStyleDiff = createDiff(paragraphStylingKeys, selectionStylesSummary, newSelectionStylesSummary);

        selectionStylesSummary = newSelectionStylesSummary;

        if (Object.keys(textStyleDiff).length > 0) {
            eventNotifier.emit(gui.DirectFormattingController.textStylingChanged, textStyleDiff);
        }

        if (Object.keys(paragraphStyleDiff).length > 0) {
            eventNotifier.emit(gui.DirectFormattingController.paragraphStylingChanged, paragraphStyleDiff);
        }
    }

    /**
     * @param {!ops.OdtCursor|!string} cursorOrId
     * @return {undefined}
     */
    function onCursorEvent(cursorOrId) {
        var cursorMemberId = (typeof cursorOrId === "string")
                                ? cursorOrId : cursorOrId.getMemberId();
        if (cursorMemberId === inputMemberId) {
            updateSelectionStylesInfo();
        }
    }

    /**
     * @return {undefined}
     */
    function onParagraphStyleModified() {
        // TODO: check if the cursor (selection) is actually affected
        updateSelectionStylesInfo();
    }

    /**
     * @param {!Object} args
     * @return {undefined}
     */
    function onParagraphChanged(args) {
        var cursor = odtDocument.getCursor(inputMemberId);

        if (cursor && odtDocument.getParagraphElement(cursor.getNode()) === args.paragraphElement) {
            updateSelectionStylesInfo();
        }
    }

    /**
     * @param {!function():boolean} predicate
     * @param {!function(!boolean):undefined} toggleMethod
     * @return {!boolean}
     */
    function toggle(predicate, toggleMethod) {
        toggleMethod(!predicate());
        return true;
    }

    /**
     * Apply the supplied text properties to the current range. If no range is selected,
     * this styling will be applied to the next character entered.
     * @param {!Object} textProperties
     * @return {undefined}
     */
    function formatTextSelection(textProperties) {
        var selection = odtDocument.getCursorSelection(inputMemberId),
            op,
            properties = {'style:text-properties' : textProperties};

        if (selection.length !== 0) {
            op = new ops.OpApplyDirectStyling();
            op.init({
                memberid: inputMemberId,
                position: selection.position,
                length: selection.length,
                setProperties: properties
            });
            session.enqueue([op]);
        } else {
            // Direct styling is additive. E.g., if the user selects bold and then italic, the intent is to produce
            // bold & italic text
            directCursorStyleProperties = utils.mergeObjects(directCursorStyleProperties || {}, properties);
            updateSelectionStylesInfo();
        }
    }
    this.formatTextSelection = formatTextSelection;

    /**
     * @param {!string} propertyName
     * @param {!string} propertyValue
     * @return {undefined}
     */
    function applyTextPropertyToSelection(propertyName, propertyValue) {
        var textProperties = {};
        textProperties[propertyName] = propertyValue;
        formatTextSelection(textProperties);
    }

    /**
     * Generate an operation that would apply the current direct cursor styling to the specified
     * position and length
     * @param {!number} position
     * @param {!number} length
     * @param {!boolean} useCachedStyle
     * @return {ops.Operation}
     */
    this.createCursorStyleOp = function (position, length, useCachedStyle) {
        var styleOp = null,
            properties = useCachedStyle ? selectionAppliedStyles[0] : directCursorStyleProperties;

        if (properties && properties['style:text-properties']) {
            styleOp = new ops.OpApplyDirectStyling();
            styleOp.init({
                memberid: inputMemberId,
                position: position,
                length: length,
                setProperties: {'style:text-properties': properties['style:text-properties']}
            });
            directCursorStyleProperties = null;
            updateSelectionStylesInfo();
        }
        return styleOp;
    };

    /**
     * Listen for local operations and clear the local cursor styling if necessary
     * @param {!ops.Operation} op
     */
    function clearCursorStyle(op) {
        var spec = op.spec();
        if (directCursorStyleProperties && spec.memberid === inputMemberId) {
            if (spec.optype !== "SplitParagraph") {
                // Most operations by the local user should clear the current cursor style
                // SplitParagraph is an exception because at the time the split occurs, there has been no element
                // added to apply the style to. Even after a split, the cursor should still style the next inserted
                // character
                directCursorStyleProperties = null;
                updateSelectionStylesInfo();
            }
        }
    }

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setBold(checked) {
        var value = checked ? 'bold' : 'normal';
        applyTextPropertyToSelection('fo:font-weight', value);
    }
    this.setBold = setBold;

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setItalic(checked) {
        var value = checked ? 'italic' : 'normal';
        applyTextPropertyToSelection('fo:font-style', value);
    }
    this.setItalic = setItalic;

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setHasUnderline(checked) {
        var value = checked ? 'solid' : 'none';
        applyTextPropertyToSelection('style:text-underline-style', value);
    }
    this.setHasUnderline = setHasUnderline;

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setHasStrikethrough(checked) {
        var value = checked ? 'solid' : 'none';
        applyTextPropertyToSelection('style:text-line-through-style', value);
    }
    this.setHasStrikethrough = setHasStrikethrough;

    /**
     * @param {!number} value
     * @return {undefined}
     */
    function setFontSize(value) {
        applyTextPropertyToSelection('fo:font-size', value + "pt");
    }
    this.setFontSize = setFontSize;

    /**
     * @param {!string} value
     * @return {undefined}
     */
    function setFontName(value) {
        applyTextPropertyToSelection('style:font-name', value);
    }
    this.setFontName = setFontName;

    /**
     * Get all styles currently applied to the selected range. If the range is collapsed,
     * this will return the style the next inserted character will have.
     * (Note, this is not used internally by WebODF, but is provided as a convenience method
     * for external consumers)
     * @return {!Array.<!Object>}
     */
    this.getAppliedStyles = function () {
        return selectionAppliedStyles;
    };

    /**
     * @return {!boolean}
     */
    this.toggleBold = toggle.bind(self, function() { return selectionStylesSummary.isBold(); }, setBold);

    /**
     * @return {!boolean}
     */
    this.toggleItalic = toggle.bind(self, function() { return selectionStylesSummary.isItalic(); }, setItalic);

    /**
     * @return {!boolean}
     */
    this.toggleUnderline = toggle.bind(self, function() { return selectionStylesSummary.hasUnderline(); }, setHasUnderline);

    /**
     * @return {!boolean}
     */
    this.toggleStrikethrough = toggle.bind(self, function() { return selectionStylesSummary.hasStrikeThrough(); }, setHasStrikethrough);

    /**
     * @return {!boolean}
     */
    this.isBold = function () {
        return selectionStylesSummary.isBold();
    };

    /**
     * @return {!boolean}
     */
    this.isItalic = function () {
        return selectionStylesSummary.isItalic();
    };

    /**
     * @return {!boolean}
     */
    this.hasUnderline = function () {
        return selectionStylesSummary.hasUnderline();
    };

    /**
     * @return {!boolean}
     */
    this.hasStrikeThrough = function () {
        return selectionStylesSummary.hasStrikeThrough();
    };

    /**
     * @return {number|undefined}
     */
    this.fontSize = function () {
        return selectionStylesSummary.fontSize();
    };

    /**
     * @return {string|undefined}
     */
    this.fontName = function () {
        return selectionStylesSummary.fontName();
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedLeft = function () {
        return selectionStylesSummary.isAlignedLeft();
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedCenter = function() {
        return selectionStylesSummary.isAlignedCenter();
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedRight = function () {
        return selectionStylesSummary.isAlignedRight();
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedJustified = function () {
        return selectionStylesSummary.isAlignedJustified();
    };

    /**
     * Round the step up to the next step
     * @param {!number} step
     * @return {!boolean}
     */
    function roundUp(step) {
        return step === ops.StepsTranslator.NEXT_STEP;
    }

    /**
     * @param {!Object.<!string, *>} obj
     * @param {!string} key
     * @return {*}
     */
    function getOwnProperty(obj, key) {
        return obj.hasOwnProperty(key) ? obj[key] : undefined;
    }

    /**
     * @param {!function(!Object) : !Object} applyDirectStyling
     * @return {undefined}
     */
    function applyParagraphDirectStyling(applyDirectStyling) {
        var range = odtDocument.getCursor(inputMemberId).getSelectedRange(),
            paragraphs = odfUtils.getParagraphElements(range),
            formatting = odtDocument.getFormatting(),
            operations = [],
            derivedStyleNames = {},
            defaultStyleName;

        paragraphs.forEach(function(paragraph) {
            var paragraphStartPoint = odtDocument.convertDomPointToCursorStep(paragraph, 0, roundUp),
                paragraphStyleName = paragraph.getAttributeNS(odf.Namespaces.textns, "style-name"),
                newParagraphStyleName,
                opAddStyle,
                opSetParagraphStyle,
                paragraphProperties;

            // Try and reuse an existing paragraph style if possible
            if (paragraphStyleName) {
                newParagraphStyleName = getOwnProperty(derivedStyleNames, paragraphStyleName);
            } else {
                newParagraphStyleName = defaultStyleName;
            }

            if (!newParagraphStyleName) {
                newParagraphStyleName = objectNameGenerator.generateStyleName();
                if (paragraphStyleName) {
                    derivedStyleNames[paragraphStyleName] = newParagraphStyleName;
                    paragraphProperties = formatting.createDerivedStyleObject(paragraphStyleName, "paragraph", {});
                } else {
                    defaultStyleName = newParagraphStyleName;
                    paragraphProperties = {};
                }

                // The assumption is that applyDirectStyling will return the same transform given the same
                // paragraph properties (e.g., there is nothing dependent on whether this is the 10th paragraph)
                paragraphProperties = applyDirectStyling(paragraphProperties);
                opAddStyle = new ops.OpAddStyle();
                opAddStyle.init({
                    memberid: inputMemberId,
                    styleName: newParagraphStyleName,
                    styleFamily: 'paragraph',
                    isAutomaticStyle: true,
                    setProperties: paragraphProperties
                });
                operations.push(opAddStyle);
            }


            opSetParagraphStyle = new ops.OpSetParagraphStyle();
            opSetParagraphStyle.init({
                memberid: inputMemberId,
                styleName: newParagraphStyleName,
                position: paragraphStartPoint
            });

            operations.push(opSetParagraphStyle);
        });
        session.enqueue(operations);
    }

    /**
     * @param {!Object} styleOverrides
     * @return {undefined}
     */
    function applySimpleParagraphDirectStyling(styleOverrides) {
        applyParagraphDirectStyling(function (paragraphStyle) { return utils.mergeObjects(paragraphStyle, styleOverrides); });
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
    this.alignParagraphLeft = function () {
        alignParagraph('left');
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.alignParagraphCenter = function () {
        alignParagraph('center');
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.alignParagraphRight = function () {
        alignParagraph('right');
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.alignParagraphJustified = function () {
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
    this.indent = function () {
        applyParagraphDirectStyling(modifyParagraphIndent.bind(null, 1));
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.outdent = function () {
        applyParagraphDirectStyling(modifyParagraphIndent.bind(null, -1));
        return true;
    };

    /**
     * Check if the selection is at the end of the last paragraph.
     * @param {!Range} range
     * @param {!Node} paragraphNode
     * @return {boolean}
     */
    function isSelectionAtTheEndOfLastParagraph(range, paragraphNode) {
        var iterator = gui.SelectionMover.createPositionIterator(paragraphNode),
            rootConstrainedFilter = new core.PositionFilterChain();
        rootConstrainedFilter.addFilter(odtDocument.getPositionFilter());
        rootConstrainedFilter.addFilter(odtDocument.createRootFilter(inputMemberId));

        iterator.setUnfilteredPosition(/**@type{!Node}*/(range.endContainer), range.endOffset);
        while (iterator.nextPosition()) {
            if (rootConstrainedFilter.acceptPosition(iterator) === FILTER_ACCEPT) {
                return odtDocument.getParagraphElement(iterator.getCurrentNode()) !== paragraphNode;
            }
        }
        return true;
    }

    /**
     * Returns true if the first text node in the selection has different text style from the first paragraph; otherwise false.
     * @param {!Range} range
     * @param {!Node} paragraphNode
     * @return {!boolean}
     */
    function isTextStyleDifferentFromFirstParagraph(range, paragraphNode) {
        var textNodes = getNodes(range),
            textStyle = odtDocument.getFormatting().getAppliedStyles(textNodes)[0],
            paragraphStyle = odtDocument.getFormatting().getAppliedStylesForElement(paragraphNode);
        if (!textStyle || textStyle['style:family'] !== 'text' || !textStyle['style:text-properties']) {
            return false;
        }
        if (!paragraphStyle || !paragraphStyle['style:text-properties']) {
            return true;
        }

        textStyle = textStyle['style:text-properties'];
        paragraphStyle = paragraphStyle['style:text-properties'];
        return !Object.keys(textStyle).every(function (key) {
            return textStyle[key] === paragraphStyle[key];
        });
    }

    /**
     * TODO: HACK, REMOVE
     * Generates operations that would create and apply the current direct cursor
     * styling to the paragraph at given position.
     * @param position
     * @return {!Array.<!ops.Operation>}
     */
    this.createParagraphStyleOps = function (position) {
        var cursor = odtDocument.getCursor(inputMemberId),
            range = cursor.getSelectedRange(),
            operations = [], op,
            startNode, endNode, paragraphNode,
            properties, parentStyleName, styleName;

        if (cursor.hasForwardSelection()) {
            startNode = cursor.getAnchorNode();
            endNode = cursor.getNode();
        } else {
            startNode = cursor.getNode();
            endNode = cursor.getAnchorNode();
        }

        paragraphNode = /**@type{!Node}*/(odtDocument.getParagraphElement(endNode));
        runtime.assert(Boolean(paragraphNode), "DirectFormattingController: Cursor outside paragraph");
        if (!isSelectionAtTheEndOfLastParagraph(range, paragraphNode)) {
            return operations;
        }

        if (endNode !== startNode) {
            paragraphNode = /**@type{!Node}*/(odtDocument.getParagraphElement(startNode));
        }

        if (!directCursorStyleProperties && !isTextStyleDifferentFromFirstParagraph(range, paragraphNode)) {
            return operations;
        }

        properties = selectionAppliedStyles[0];
        if (!properties) {
            return operations;
        }

        parentStyleName = paragraphNode.getAttributeNS(textns, 'style-name');
        if (parentStyleName) {
            properties = {
                'style:text-properties': properties['style:text-properties']
            };
            properties = odtDocument.getFormatting().createDerivedStyleObject(parentStyleName, 'paragraph', properties);
        }

        styleName = objectNameGenerator.generateStyleName();
        op = new ops.OpAddStyle();
        op.init({
            memberid: inputMemberId,
            styleName: styleName,
            styleFamily: 'paragraph',
            isAutomaticStyle: true,
            setProperties: properties
        });
        operations.push(op);

        op = new ops.OpSetParagraphStyle();
        op.init({
            memberid: inputMemberId,
            styleName: styleName,
            position: position
        });
        operations.push(op);

        return operations;
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
    this.destroy = function (callback) {
        odtDocument.unsubscribe(ops.OdtDocument.signalCursorAdded, onCursorEvent);
        odtDocument.unsubscribe(ops.OdtDocument.signalCursorRemoved, onCursorEvent);
        odtDocument.unsubscribe(ops.OdtDocument.signalCursorMoved, onCursorEvent);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        odtDocument.unsubscribe(ops.OdtDocument.signalOperationEnd, clearCursorStyle);
        callback();
    };

    /**
     * @return {undefined}
     */
    /*jslint emptyblock: true*/
    function emptyFunction() {
    }
    /*jslint emptyblock: false*/

    function init() {
        odtDocument.subscribe(ops.OdtDocument.signalCursorAdded, onCursorEvent);
        odtDocument.subscribe(ops.OdtDocument.signalCursorRemoved, onCursorEvent);
        odtDocument.subscribe(ops.OdtDocument.signalCursorMoved, onCursorEvent);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        odtDocument.subscribe(ops.OdtDocument.signalOperationEnd, clearCursorStyle);
        updateSelectionStylesInfo();

        if (!directParagraphStylingEnabled) {
            self.alignParagraphCenter = emptyFunction;
            self.alignParagraphJustified = emptyFunction;
            self.alignParagraphLeft = emptyFunction;
            self.alignParagraphRight = emptyFunction;
            self.createParagraphStyleOps = function () { return []; };
            self.indent = emptyFunction;
            self.outdent = emptyFunction;
        }
    }

    init();
};

/**@const*/gui.DirectFormattingController.textStylingChanged = "textStyling/changed";
/**@const*/gui.DirectFormattingController.paragraphStylingChanged = "paragraphStyling/changed";

(function () {
    "use strict";
    return gui.DirectFormattingController;
}());

