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
/*global gui, runtime*/

/**
 * This class attempts to implement undo/redo behaviour identical
 * to how LibreOffice behaves.
 *
 * State iteration rules are:
 * - Multiple text inserts in the same direction are treated as one state
 * - Multiple text removes in the same direction are treated as one state
 * - An Undo state always consumes all trailing cursor move operations
 * - An edit operation cannot follow non-edit operations. A state can
 *      start with non-edit operations if it contains no further edit ops.
 * @constructor
 */
gui.UndoStateRules = function UndoStateRules() {
    "use strict";

    /**
     * Return the first element from the end of the array that matches the supplied predicate.
     * Each subsequent call to previous will return the next element from the end of the array
     * that matches the predicate.
     * @constructor
     * @param {!Array.<!ops.Operation>} array
     * @param {!function(!ops.Operation):!boolean} predicate
     */
    function ReverseIterator(array, predicate) {
        var index = array.length;

        /**
         * Return the previous element in the array that matches the predicate
         * @return {?ops.Operation} Returns null when no more elements in the array match the predicate
         */
        this.previous = function () {
            for (index = index - 1; index >= 0; index -= 1) {
                if (predicate(array[index])) {
                    return array[index];
                }
            }
            return null;
        };
    }

    /**
     * @param {!ops.Operation} op
     * @return {string}
     */
    function getOpType(op) {
        return op.spec().optype;
    }

    /**
     * @param {!ops.Operation} op
     * @return {number}
     */
    function getOpPosition(op) {
        return op.spec().position;
    }

    /**
     * Returns true if the supplied operation
     * is considered an editing operation.
     * @param {!ops.Operation} op
     * @return {!boolean} Returns true if the supplied op is an edit operation
     */
    function isEditOperation(op) {
        return op.isEdit;
    }
    this.isEditOperation = isEditOperation;

    /**
     * Returns true if the supplied optype is allowed to
     * aggregate multiple operations in a single undo or redo state
     * @param {!ops.Operation} op
     * @return {!boolean}
     */
    function canAggregateOperation(op) {
        switch (getOpType(op)) {
        case "RemoveText":
        case "InsertText":
            return true;
        default:
            return false;
        }
    }

    /**
     * Returns true if the newly supplied operation is continuing
     * in the same direction of travel as the recent edit operations
     * @param {!ops.Operation} thisOp
     * @param {!ops.Operation} lastEditOp
     * @param {!ops.Operation} secondLastEditOp
     * @return {!boolean}
     */
    function isSameDirectionOfTravel(thisOp, lastEditOp, secondLastEditOp) {
        // Note, the operations in the recent queue are most
        // recent to least recent. As such, the direction order
        // should be thisPos => existing2 => existing1
        var thisPosition = getOpPosition(thisOp),
            lastPosition = getOpPosition(lastEditOp),
            secondLastPosition = getOpPosition(secondLastEditOp),
            diffLastToSecondLast = lastPosition - secondLastPosition,
            diffThisToLast = thisPosition - lastPosition;
        // Next, the tricky part... determining the direction of travel
        // Each aggregate operation can have two directions of travel:
        // RemoveText:
        // - delete via backspace - direction will be -1 as cursor moves back
        // - delete via delete key - direction will be 0 as cursor doesn't move
        // InsertText:
        // - prepend text - direction will be 0 as cursor doesn't move
        // - append text - direction will be 1 as cursor moves forward

        return diffThisToLast === diffLastToSecondLast;
    }

    /**
     * Returns true if the two operations are considered adjacent.
     * @param {!ops.Operation} thisOp
     * @param {!ops.Operation} lastEditOp
     * @return {!boolean}
     */
    function isAdjacentOperation(thisOp, lastEditOp) {
        var positionDifference = getOpPosition(thisOp) - getOpPosition(lastEditOp);
        // RemoveText:
        // - delete via backspace - direction will be -1 as cursor moves back
        // - delete via delete key - direction will be 0 as cursor doesn't move
        // InsertText:
        // - prepend text - direction will be 0 as cursor doesn't move
        // - append text - direction will be 1 as cursor moves forward
        return positionDifference === 0 || Math.abs(positionDifference) === 1;
    }

    /**
     *
     * @param {!ops.Operation} thisOp
     * @param {!ops.Operation} lastEditOp
     * @param {?ops.Operation} secondLastEditOp
     * @return {!boolean}
     */
    function continuesOperations(thisOp, lastEditOp, secondLastEditOp) {
        if (!secondLastEditOp) {
            // No previous edit operations, so can't calculate a direction of travel.
            // Just check new op is adjacent to existing op
            return isAdjacentOperation(thisOp, lastEditOp);
        }
        return isSameDirectionOfTravel(thisOp, lastEditOp, secondLastEditOp);
    }

    /**
     * Returns true if thisOp can be grouped together with the most recent edit operations.
     *
     * For an operation to be considered continuous it must:
     * - Be of a type that supports aggregation (e.g., insert text or remove text)
     * - Be of the same type as the most recent edit operation
     * - Be considered adjacent (and in the same direction as) the most recent edit operation
     *
     * @param {!ops.Operation} thisOp
     * @param {!Array.<!ops.Operation>} recentOperations
     * @return {!boolean}
     */
    function continuesMostRecentEditOperation(thisOp, recentOperations) {
        var thisOpType = getOpType(thisOp),
            editOpsFinder = new ReverseIterator(recentOperations, isEditOperation),
            lastEditOp = editOpsFinder.previous();

        runtime.assert(Boolean(lastEditOp), "No edit operations found in state");
        if (thisOpType === getOpType(/**@type{!ops.Operation}*/(lastEditOp))) {
            // Operation type is identical, so check if these operations are continuous
            return continuesOperations(thisOp, /**@type{!ops.Operation}*/(lastEditOp), editOpsFinder.previous());
        }
        return false;
    }

    /**
     * Returns true if thisOp can be grouped together with the most recent edit operations group.
     *
     * For an operation to be considered continuous it must:
     * - Be of a type that supports aggregation (e.g., insert text or remove text)
     * - Be continuous with the most recent edit operation of the same type in the most recent operations group
     *   (see isContinuousWithExistingOperation for the definition of "continuous")
     *
     * @param {!ops.Operation} thisOp
     * @param {!Array.<!ops.Operation>} recentOperations
     * @return {!boolean}
     */
    function continuesMostRecentEditGroup(thisOp, recentOperations) {
        var thisOpType = getOpType(thisOp),
            editOpsFinder = new ReverseIterator(recentOperations, isEditOperation),
            candidateOp = editOpsFinder.previous(),
            lastEditOp,
            secondLastEditOp = null,
            inspectedGroupsCount,
            groupId;

        runtime.assert(Boolean(candidateOp), "No edit operations found in state");
        groupId = candidateOp.group;
        runtime.assert(groupId !== undefined, "Operation has no group");
        inspectedGroupsCount = 1; // Need to keep track of how many edit groups have been inspected

        // Check if the current operation continues any operation in the latest group
        while (candidateOp && candidateOp.group === groupId) {
            if (thisOpType === getOpType(candidateOp)) {
                // A matching edit operation was found in the most recent edit group
                lastEditOp = candidateOp;
                break;
            }
            candidateOp = editOpsFinder.previous();
        }

        if (lastEditOp) {
            // Now try and find a second operation of the same type in either of the most recent two edit groups
            candidateOp = editOpsFinder.previous();
            while (candidateOp) {
                if (candidateOp.group !== groupId) {
                    if (inspectedGroupsCount === 2) {
                        // No second compatible op was found within two edit groups, so abandon searching for more
                        // and check continuity against lastEditOp only
                        break;
                    }
                    groupId = candidateOp.group;
                    inspectedGroupsCount += 1;
                }
                if (thisOpType === getOpType(candidateOp)) {
                    // Found an operation of the same type within the last two edit groups on the stack
                    secondLastEditOp = candidateOp;
                    break;
                }
                candidateOp = editOpsFinder.previous();
            }
            return continuesOperations(thisOp, /**@type{!ops.Operation}*/(lastEditOp), secondLastEditOp);
        }
        return false;
    }

    /**
     * Returns true if the provided operation is part of the existing
     * set of operations according to the undo rules
     * @param {!ops.Operation} operation
     * @param {!Array.<!ops.Operation>} recentOperations
     * @return {!boolean}
     */
    function isPartOfOperationSet(operation, recentOperations) {
        var areOperationsGrouped = operation.group !== undefined, // Expect groups to be consistently used (if in use at all)
            lastOperation;
        if (!isEditOperation(operation)) {
            // Non-edit operations always get appended to the existing undo state
            // this covers things such as move cursor ops
            return true;
        }
        if (recentOperations.length === 0) {
            // This is the first operation of a pristine state
            return true;
        }
        lastOperation = recentOperations[recentOperations.length - 1];
        if (areOperationsGrouped && operation.group === lastOperation.group) {
            // Operation groups match, so these were queued as a group
            return true;
        }
        if (canAggregateOperation(operation) && recentOperations.some(isEditOperation)) {
            // The are existing edit operations. Check if the current op can be combined with existing operations
            // E.g., multiple insert text or remove text ops
            if (areOperationsGrouped) {
                return continuesMostRecentEditGroup(operation, recentOperations);
            }
            return continuesMostRecentEditOperation(operation, recentOperations);
        }
        // The following are all true at this point:
        // - new operation is an edit operation (check 1)
        // - existing undo state has at least one existing operation (check 2)
        // - new operation is not part of most recent operation group (check 3)
        // - new operation is not continuous with the existing edit operations (check 4 + 5)
        return false;
    }
    this.isPartOfOperationSet = isPartOfOperationSet;
};
