/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global core, ops, gui, odf, NodeFilter, runtime*/

/**
 * @implements {core.Destroyable}
 * @param {!ops.Session} session
 * @param {!gui.SessionConstraints} sessionConstraints
 * @param {!gui.SessionContext} sessionContext
 * @param {!string} inputMemberId
 * @constructor
 */
gui.ListController = function ListController(session, sessionConstraints, sessionContext, inputMemberId) {
    "use strict";
    var odtDocument = session.getOdtDocument(),
        odfUtils = odf.OdfUtils,
        domUtils = core.DomUtils,
        eventNotifier = new core.EventNotifier([
            gui.ListController.listStylingChanged,
            gui.ListController.enabledChanged
        ]),
        /**@type{!gui.ListController.SelectionInfo}*/
        lastSignalledSelectionInfo,
        /**@type{!core.LazyProperty.<!gui.ListController.SelectionInfo>}*/
        cachedSelectionInfo,
        /**@const*/
        NEXT = core.StepDirection.NEXT,
        /**@const*/
        DEFAULT_NUMBERING_STYLE = "WebODF-Numbering",
        /**@const*/
        DEFAULT_BULLETED_STYLE = "WebODF-Bulleted";

    /**
     * @param {!ops.OdtCursor|!string} cursorOrId
     * @return {undefined}
     */
    function onCursorEvent(cursorOrId) {
        var cursorMemberId = (typeof cursorOrId === "string")
            ? cursorOrId : cursorOrId.getMemberId();

        if (cursorMemberId === inputMemberId) {
            cachedSelectionInfo.reset();
        }
    }

    /**
     * @return {undefined}
     */
    function onParagraphStyleModified() {
        // this is reset on paragraph style change due to paragraph styles possibly linking to list styles
        // through the use of the style:list-style-name attribute
        // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#attribute-style_list-style-name
        cachedSelectionInfo.reset();
    }

    /**
     * @param {!{paragraphElement:Element}} args
     * @return {undefined}
     */
    function onParagraphChanged(args) {
        var cursor = odtDocument.getCursor(inputMemberId),
            p = args.paragraphElement;

        if (cursor && odfUtils.getParagraphElement(cursor.getNode()) === p) {
            cachedSelectionInfo.reset();
        }
    }

    /**
     * @return {!gui.ListController.SelectionInfo}
     */
    function getSelectionInfo() {
        var cursor = odtDocument.getCursor(inputMemberId),
            cursorNode = cursor && cursor.getNode(),
            styleSummary = new gui.ListStyleSummary(cursorNode, odtDocument.getRootNode(), odtDocument.getFormatting()),
            isEnabled = true;

        if (sessionConstraints.getState(gui.CommonConstraints.EDIT.REVIEW_MODE) === true) {
            isEnabled = sessionContext.isLocalCursorWithinOwnAnnotation();
        }

        return new gui.ListController.SelectionInfo(isEnabled, styleSummary);
    }

    /**
     * @return {undefined}
     */
    function emitSelectionChanges() {
        var hasStyleChanged = true,
            hasEnabledChanged = true,
            newSelectionInfo = cachedSelectionInfo.value(),
            lastStyleSummary,
            newStyleSummary;

        if (lastSignalledSelectionInfo) {
            lastStyleSummary = lastSignalledSelectionInfo.styleSummary;
            newStyleSummary = newSelectionInfo.styleSummary;

            hasStyleChanged = lastStyleSummary.isNumberedList !== newStyleSummary.isNumberedList ||
                lastStyleSummary.isBulletedList !== newStyleSummary.isBulletedList;

            hasEnabledChanged = lastSignalledSelectionInfo.isEnabled !== newSelectionInfo.isEnabled;
        }

        lastSignalledSelectionInfo = newSelectionInfo;

        if (hasStyleChanged) {
            eventNotifier.emit(gui.ListController.listStylingChanged, lastSignalledSelectionInfo.styleSummary);
        }

        if (hasEnabledChanged) {
            eventNotifier.emit(gui.ListController.enabledChanged, lastSignalledSelectionInfo.isEnabled);
        }
    }

    /**
     * @return {undefined}
     */
    function forceSelectionInfoRefresh() {
        cachedSelectionInfo.reset();
        emitSelectionChanges();
    }

    /**
     * Find all top level text:list elements in the given range.
     * This includes any elements that contain the start or end containers of the range.
     * @param {!Range} range
     * @return {!Array.<!Element>}
     */
    function getTopLevelListElementsInRange(range) {
        var elements,
            topLevelList,
            rootNode = odtDocument.getRootNode();

        /**
         * @param {!Node} node
         * @return {!number}
         */
        function isListOrListItem(node) {
            var result = NodeFilter.FILTER_REJECT;
            if (odfUtils.isListElement(node) && !odfUtils.isListItemOrListHeaderElement(node.parentNode)) {
                result = NodeFilter.FILTER_ACCEPT;
            } else if (odfUtils.isTextContentContainingNode(node) || odfUtils.isGroupingElement(node)) {
                result = NodeFilter.FILTER_SKIP;
            }
            return result;
        }

        // ignore the list element if it is nested within another list
        elements = domUtils.getNodesInRange(range, isListOrListItem, NodeFilter.SHOW_ELEMENT);

        // add any top level lists that contain the start or end containers of the range
        // check in the elements collection for duplicates in case these top level lists intersected the specified range
        topLevelList = odfUtils.getTopLevelListElement(/**@type{!Node}*/(range.startContainer), rootNode);
        if (topLevelList && topLevelList !== elements[0]) {
            elements.unshift(topLevelList);
        }

        topLevelList = odfUtils.getTopLevelListElement(/**@type{!Node}*/(range.endContainer), rootNode);
        if (topLevelList && topLevelList !== elements[elements.length - 1]) {
            elements.push(topLevelList);
        }

        return elements;
    }

    /**
     * @param {!Element} initialParagraph
     * @return {!{startParagraph: !Element, endParagraph: !Element}}
     */
    function createParagraphGroup(initialParagraph) {
        return {
            startParagraph: initialParagraph,
            endParagraph: initialParagraph
        };
    }

    /**
     * @param {!string} styleName
     * @return {!ops.OpAddListStyle}
     */
    function createDefaultListStyleOp(styleName) {
        var op = new ops.OpAddListStyle(),
            defaultListStyle;

        if (styleName === DEFAULT_NUMBERING_STYLE) {
            defaultListStyle = gui.DefaultNumberedListStyle;
        } else {
            defaultListStyle = gui.DefaultBulletedListStyle;
        }

        op.init({
            memberid: inputMemberId,
            styleName: styleName,
            isAutomaticStyle: true,
            listStyle: defaultListStyle
        });

        return op;
    }

    /**
     * Takes all the paragraph elements in the current selection and breaks
     * them into add list operations based on their common ancestors. Paragraph elements
     * with the same common ancestor will be grouped into the same operation
     * @param {!string=} styleName
     * @return {!Array.<!ops.Operation>}
     */
    function determineOpsForAddingLists(styleName) {
        var paragraphElements,
            /**@type{!Array.<!{startParagraph: !Element, endParagraph: !Element}>}*/
            paragraphGroups = [],
            paragraphParent,
            commonAncestor,
            i;

        paragraphElements = odfUtils.getParagraphElements(odtDocument.getCursor(inputMemberId).getSelectedRange());

        for (i = 0; i < paragraphElements.length; i += 1) {
            paragraphParent = paragraphElements[i].parentNode;

            //TODO: handle selections that intersect with existing lists
            // This also needs to handle converting a list between numbering or bullets which MUST preserve the list structure
            if (odfUtils.isListItemOrListHeaderElement(paragraphParent)) {
                runtime.log("DEBUG: Current selection intersects with an existing list which is not supported at this time");
                paragraphGroups.length = 0;
                break;
            }

            if (paragraphParent === commonAncestor) {
                // if the current paragraph has the same common ancestor as the current group of paragraphs
                // then the paragraph group gets extended to include the current paragraph
                paragraphGroups[paragraphGroups.length - 1].endParagraph = paragraphElements[i];
            } else {
                // if the ancestor of this paragraph does not match then begin a new group of paragraphs
                commonAncestor = paragraphParent;
                paragraphGroups.push(createParagraphGroup(paragraphElements[i]));
            }
        }

        // each paragraph group becomes one add list operation
        return paragraphGroups.map(function (group) {
            // take the first step of the start and end paragraph of each group and
            // pass them in as the coordinates for the add list operation
            var newOp = new ops.OpAddList();
            newOp.init({
                memberid: inputMemberId,
                startParagraphPosition: odtDocument.convertDomPointToCursorStep(group.startParagraph, 0, NEXT),
                endParagraphPosition: odtDocument.convertDomPointToCursorStep(group.endParagraph, 0, NEXT),
                styleName: styleName
            });
            return newOp;
        });
    }

    /**
     * Finds all the lists to be removed in the current selection and creates an operation for each
     * top level list element found
     * @return {!Array.<!ops.Operation>}
     */
    function determineOpsForRemovingLists() {
        var topLevelListElements,
            stepIterator = odtDocument.createStepIterator(
                odtDocument.getRootNode(),
                0,
                [odtDocument.getPositionFilter()],
                odtDocument.getRootNode());

        topLevelListElements = getTopLevelListElementsInRange(odtDocument.getCursor(inputMemberId).getSelectedRange());

        return topLevelListElements.map(function (listElement) {
            var newOp = new ops.OpRemoveList();

            stepIterator.setPosition(listElement, 0);
            runtime.assert(stepIterator.roundToNextStep(), "Top level list element contains no steps");

            newOp.init({
                memberid: inputMemberId,
                firstParagraphPosition: odtDocument.convertDomPointToCursorStep(stepIterator.container(), stepIterator.offset())
            });
            return newOp;
        });
    }

    /**
     * @param {function():!Array.<!ops.Operation>} executeFunc
     * @return {!boolean}
     */
    function executeListOperations(executeFunc) {
        var newOps;

        if (!cachedSelectionInfo.value().isEnabled) {
            return false;
        }

        newOps = executeFunc();

        if (newOps.length > 0) {
            session.enqueue(newOps);
            return true;
        }

        return false;
    }

    /**
     * @return {!boolean}
     */
    this.isEnabled = function () {
        return cachedSelectionInfo.value().isEnabled;
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
     * @param {!string=} styleName
     * @return {!boolean}
     */
    function makeList(styleName) {
        var /**@type{!boolean}*/
            isExistingStyle,
            /**@type{!boolean}*/
            isDefaultStyle;

        // check if the style name passed in exists in the document or is a WebODF default numbered or bulleted style.
        // If no style name is passed in then the created list will have a style applied as described here:
        // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#__RefHeading__1419242_253892949
        if (styleName) {
            isExistingStyle = Boolean(odtDocument.getFormatting().getStyleElement(styleName, "list-style"));
            isDefaultStyle = styleName === DEFAULT_NUMBERING_STYLE || styleName === DEFAULT_BULLETED_STYLE;

            // if the style doesn't exist in the document and isn't a WebODF default style then we can't continue
            if (!isExistingStyle && !isDefaultStyle) {
                runtime.log("DEBUG: Could not create a list with the style name: " + styleName + " as it does not exist in the document");
                return false;
            }
        }

        return executeListOperations(function () {
            var newOps = determineOpsForAddingLists(styleName);

            // this will only create an add list style op for WebODF default styles and only when they don't exist already
            if (newOps.length > 0 && isDefaultStyle && !isExistingStyle) {
                newOps.unshift(createDefaultListStyleOp(/**@type{!string}*/(styleName)));
            }
            return newOps;
        });
    }

    /**
     * @return {!boolean}
     */
    function removeList() {
        return executeListOperations(determineOpsForRemovingLists);
    }

    this.removeList = removeList;

    /**
     * @param {!boolean} checked
     * @return {!boolean}
     */
    this.setNumberedList = function (checked) {
        if (checked) {
            return makeList(DEFAULT_NUMBERING_STYLE);
        }
        return removeList();

    };

    /**
     * @param {!boolean} checked
     * @return {!boolean}
     */
    this.setBulletedList = function (checked) {
        if (checked) {
            return makeList(DEFAULT_BULLETED_STYLE);
        }
        return removeList();
    };

    /**
     * @param {!function(!Error=)} callback
     * @return {undefined}
     */
    this.destroy = function (callback) {
        odtDocument.unsubscribe(ops.Document.signalCursorAdded, onCursorEvent);
        odtDocument.unsubscribe(ops.Document.signalCursorRemoved, onCursorEvent);
        odtDocument.unsubscribe(ops.Document.signalCursorMoved, onCursorEvent);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.unsubscribe(ops.OdtDocument.signalProcessingBatchEnd, emitSelectionChanges);
        sessionConstraints.unsubscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, forceSelectionInfoRefresh);
        callback();
    };

    /**
     * @return {undefined}
     */
    function init() {
        odtDocument.subscribe(ops.Document.signalCursorAdded, onCursorEvent);
        odtDocument.subscribe(ops.Document.signalCursorRemoved, onCursorEvent);
        odtDocument.subscribe(ops.Document.signalCursorMoved, onCursorEvent);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.subscribe(ops.OdtDocument.signalProcessingBatchEnd, emitSelectionChanges);
        sessionConstraints.subscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, forceSelectionInfoRefresh);

        cachedSelectionInfo = new core.LazyProperty(getSelectionInfo);
    }

    init();
};

/**@const*/
gui.ListController.listStylingChanged = "listStyling/changed";

/**@const*/
gui.ListController.enabledChanged = "enabled/changed";

/**
 * @param {!boolean} isEnabled
 * @param {!gui.ListStyleSummary} styleSummary
 * @constructor
 * @struct
 */
gui.ListController.SelectionInfo = function (isEnabled, styleSummary) {
    "use strict";

    /**
     * Whether the controller is enabled based on the selection
     * @type {!boolean}
     */
    this.isEnabled = isEnabled;

    /**
     * Summary of list style information for the selection
     * @type {!gui.ListStyleSummary}
     */
    this.styleSummary = styleSummary;
};


