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

/*global runtime, core, ops, Node*/

(function() {
    "use strict";
    // Multiple cached translators may exist in the same runtime. Therefore, each node id should
    // be globally unique, so they can be safely re-used by multiple translators
    var /**@type{number}*/
        nextNodeId = 0;

    /**
     * Implementation of a step to DOM point lookup cache.
     *
     * A cache point ("bookmark") is created each time updateBookmark is called, saving the number of steps from the root
     * node to the bookmarked node. This cached point is linked to the node via a unique identifier.
     *
     * The cache works by tracking "damage" to it's bookmarks (via steps inserted & removal). As re-iteration over the
     * damaged sections occur, the bookmarks are updated, and the damage repaired.
     *
     * A visual example of the cache during various states is as follows:
     * legend: -=good bookmark, x=damaged bookmark, !=indeterminate bookmark, ?=requested step,
     *          @=current iterator position
     * 
     * [--------------] <-- cache before steps change
     * [----x!!!!!!!!!] <-- damage occurs (e.g., a step is deleted) which means all bookmarks after the damage point are
     *                      now indeterminate as their step location is now outdated
     * [----xxxxxxxxxx] <-- trailing bookmarks now considered "damaged", and will not be used until they can be repaired
     * [---@xxxx?xxxxx] <-- when a bookmark is requested for step in the damaged region, the last undamaged bookmark will
     *                      be returned instead. The consumer of this interface already knows additional iteration may
     *                      be necessary to reach the desired step count, so this case is no different than if the cache
     *                      was unprimed.
     * [------@xxxxxxx] <-- as re-iteration over the doc occurs, bookmark positions are updated and the damage start
     *                      point is moved along to the next damaged node
     *
     * This cache depends on OdtStepsTranslator.handleStepsInserted & handleStepsRemoved being called at the step of change,
     * along with information about the region that has changed. The cache is able to cope with nodes being cloned, as
     * long as the position of change is correctly reported.
     *
     * However, this implementation will NOT cope with nodes being re-ordered, even if a change event is reported.
     * This is because the cache relies on the nodes order remaining fixed as long as they are in the DOM.
     * If node reordering is desired, it can be achieved through cloning the node into the new position and removing
     * the original node (the clone will be detected and rectified).
     *
     * @constructor
     * @param {!Element} rootElement
     * @param {!number} bucketSize  Minimum number of steps between cache points
     * @param {!function(!number, !core.PositionIterator):undefined} restoreBookmarkPosition Fine-tune the iterator position after
     *      it is set to a specific bookmark location.
     */
    ops.StepsCache = function StepsCache(rootElement, bucketSize, restoreBookmarkPosition) {
        var coordinatens = "urn:webodf:names:steps",
            // Note, our coding standards usually require a key of !string for a dictionary.
            // As I'm often assigning numbers as well (which JS quite happily converts for me)
            // using both types saves me a lot of extra typing
            /**@type{!Object.<(!string|!number), !ops.StepsCache.Bookmark>}*/
            stepToDomPoint = {},
            /**@type{!Object.<!string, !ops.StepsCache.Bookmark>}*/
            nodeToBookmark = {},
            domUtils = core.DomUtils,
            /**@type{!RootBookmark}*/
            basePoint,
            /**@type{!number|undefined}*/
            lastUndamagedCacheStep,
            /**
             * @const
             * @type {!number}
             */
            DOCUMENT_POSITION_FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING,
            /**
             * @const
             * @type {!number}
             */
            DOCUMENT_POSITION_PRECEDING = Node.DOCUMENT_POSITION_PRECEDING,
            verifyCache;

        /**
         * Bookmark tied to a specific node
         * @constructor
         * @param {!string} nodeId
         * @param {!Element} bookmarkNode
         *
         * @implements {ops.StepsCache.Bookmark}
         */
        function NodeBookmark(nodeId, bookmarkNode) {
            var self = this;
            this.nodeId = nodeId;
            this.steps = -1;
            this.node = bookmarkNode;
            this.nextBookmark = null;
            this.previousBookmark = null;

            /**
             * @param {!core.PositionIterator} iterator
             * @return {undefined}
             */
            this.setIteratorPosition = function(iterator) {
                iterator.setPositionBeforeElement(bookmarkNode);
                restoreBookmarkPosition(self.steps, iterator);
            };
        }

        /**
         * Bookmark indicating the first walkable position in the document
         * @constructor
         * @param {!string} nodeId
         * @param {!number} steps
         * @param {!Node} rootNode
         *
         * @implements {ops.StepsCache.Bookmark}
         */
        function RootBookmark(nodeId, steps, rootNode) {
            var self = this;
            this.nodeId = nodeId;
            this.steps = steps;
            this.node = rootNode;
            this.nextBookmark = null;
            this.previousBookmark = null;

            /**
             * @param {!core.PositionIterator} iterator
             * @return {undefined}
             */
            this.setIteratorPosition = function (iterator) {
                iterator.setUnfilteredPosition(rootNode, 0);
                restoreBookmarkPosition(self.steps, iterator);
            };
        }

        /**
         * Return a summary string of the supplied bookmark node id(s)
         * @param {!ops.StepsCache.Bookmark} bookmark1
         * @param {?ops.StepsCache.Bookmark=} bookmark2
         * @return {!string}
         */
        function inspectBookmarks(bookmark1, bookmark2) {
            var parts = "[" + bookmark1.nodeId;
            if (bookmark2) {
                parts += " => " + bookmark2.nodeId;
            }
            return parts + "]";
        }

        /**
         * Returns true if the specified bookmark is undamaged
         * @param {!ops.StepsCache.Bookmark} bookmark
         * @return {!boolean}
         */
        function isUndamagedBookmark(bookmark) {
            return lastUndamagedCacheStep === undefined
                || bookmark === basePoint
                || bookmark.steps <= lastUndamagedCacheStep;
        }

        /**
         * Run a series of verification checks against the complete cache to ensure it is operating
         * correctly. Note, this is VERY expensive, and should only be done when attempting to diagnose
         * caching problems
         * @return {undefined}
         */
        function verifyCacheImpl() {
            var bookmark = basePoint,
                previousBookmark,
                nextBookmark,
                documentPosition,
                loopCheck = new core.LoopWatchDog(0, 100000),
                /**@type{!Object.<!string, !string>}*/
                stepToDomPointNodeIds = {};

            while (bookmark) {
                loopCheck.check();
                previousBookmark = bookmark.previousBookmark;
                if (previousBookmark) {
                    // Make sure previous => current chain is intact
                    runtime.assert(previousBookmark.nextBookmark === bookmark,
                        "Broken bookmark link to previous @" + inspectBookmarks(previousBookmark, bookmark));
                } else {
                    // If there is no previous, ensure this is the basePoint bookmark
                    runtime.assert(bookmark === basePoint, "Broken bookmark link @" + inspectBookmarks(bookmark));
                    runtime.assert(isUndamagedBookmark(basePoint), "Base point is damaged @" + inspectBookmarks(bookmark));
                }
                nextBookmark = bookmark.nextBookmark;
                if (nextBookmark) {
                    // Make sure current => next chain is intact
                    runtime.assert(nextBookmark.previousBookmark === bookmark,
                        "Broken bookmark link to next @" + inspectBookmarks(bookmark, nextBookmark));
                }

                if (isUndamagedBookmark(bookmark)) {
                    runtime.assert(domUtils.containsNode(rootElement, bookmark.node),
                        "Disconnected node is being reported as undamaged @" + inspectBookmarks(bookmark));
                    if (previousBookmark) {
                        documentPosition = bookmark.node.compareDocumentPosition(previousBookmark.node);
                        /*jslint bitwise:true*/
                        runtime.assert(documentPosition === 0 || (documentPosition & DOCUMENT_POSITION_PRECEDING) !== 0,
                            "Bookmark order with previous does not reflect DOM order @" + inspectBookmarks(previousBookmark, bookmark));
                        /*jslint bitwise:false*/
                    }
                    if (nextBookmark) {
                        if (domUtils.containsNode(rootElement, nextBookmark.node)) {
                            documentPosition = bookmark.node.compareDocumentPosition(nextBookmark.node);
                            /*jslint bitwise:true*/
                            runtime.assert(documentPosition === 0 || (documentPosition & DOCUMENT_POSITION_FOLLOWING) !== 0,
                                "Bookmark order with next does not reflect DOM order @" + inspectBookmarks(bookmark, nextBookmark));
                            /*jslint bitwise:false*/
                        }
                    }
                }

                bookmark = bookmark.nextBookmark;
            }

            Object.keys(stepToDomPoint).forEach(function(step) {
                var domPointBookmark = stepToDomPoint[step];
                if (lastUndamagedCacheStep === undefined || step <= lastUndamagedCacheStep) {
                    runtime.assert(domPointBookmark.steps <= step, "Bookmark step of " + domPointBookmark.steps +
                        " exceeds cached step lookup for " + step + " @" + inspectBookmarks(domPointBookmark));
                }

                runtime.assert(stepToDomPointNodeIds.hasOwnProperty(domPointBookmark.nodeId) === false,
                        "Bookmark " + inspectBookmarks(domPointBookmark) + " appears twice in cached step lookup at steps " +
                        stepToDomPointNodeIds[domPointBookmark.nodeId] + " and " + step);
                stepToDomPointNodeIds[domPointBookmark.nodeId] = step;
            });
        }

        /**
         * Returns the closest quantized step at or before the requested step
         * @param {!number} steps
         * @return {!number}
         */
        function getBucket(steps) {
            return Math.floor(steps / bucketSize) * bucketSize;
        }

        /**
         * Returns the closest quantized step at or just after the requested step
         * @param {!number} steps
         * @return {!number}
         */
        function getDestinationBucket(steps) {
            return Math.ceil(steps / bucketSize) * bucketSize;
        }

        /**
         * @param {!Element} node
         * @return {undefined}
         */
        function clearNodeId(node) {
            node.removeAttributeNS(coordinatens, "nodeId");
        }

        /**
         * @param {!Node} node
         * @return {!string}
         */
        function getNodeId(node) {
            var id = "";
            if (node.nodeType === Node.ELEMENT_NODE) {
                id = /**@type{!Element}*/(node).getAttributeNS(coordinatens, "nodeId") || "";
            }
            return id;
        }

        /**
         * @param {!Element} node
         * @return {!string}
         */
        function setNodeId(node) {
            var nodeId = nextNodeId.toString();
            node.setAttributeNS(coordinatens, "nodeId", nodeId);
            nextNodeId += 1;
            return nodeId;
        }

        /**
         * The element might have been cloned from another part of the document and have a stale or duplicate
         * nodeId
         * @param {!Node} node
         * @param {!ops.StepsCache.Bookmark} bookmark
         * @return {!boolean} True if the bookmark is actually for the supplied node
         */
        function isValidBookmarkForNode(node, bookmark) {
            return bookmark.node === node;
        }

        /**
         * Fetches (or creates) a bookmark for the specified node.
         *
         * @param {!Element} node
         * @return {!ops.StepsCache.Bookmark}
         */
        function getNodeBookmark(node) {
            var nodeId = getNodeId(node) || setNodeId(node),
                existingBookmark;
            existingBookmark = nodeToBookmark[nodeId];
            if (!existingBookmark) {
                existingBookmark = nodeToBookmark[nodeId] = new NodeBookmark(nodeId, node);
            } else if (!isValidBookmarkForNode(node, existingBookmark)) {
                runtime.log("Cloned node detected. Creating new bookmark");
                nodeId = setNodeId(node);
                existingBookmark = nodeToBookmark[nodeId] = new NodeBookmark(nodeId, node);
            }
            return existingBookmark;
        }

        /**
         * Returns the closest undamaged bookmark before or at the specified step
         * @param {!number} steps
         * @return {!ops.StepsCache.Bookmark}
         */
        function getClosestBookmark(steps) {
            var cacheBucket,
                cachePoint,
                loopGuard = new core.LoopWatchDog(0, 10000);

            // This function promises to return an undamaged bookmark at all times.
            // Easiest way to ensure this is don't allow requests to damaged sections
            // of the cache.
            if (lastUndamagedCacheStep !== undefined && steps > lastUndamagedCacheStep) {
                steps = lastUndamagedCacheStep;
            }
            cacheBucket = getBucket(steps);

            while (!cachePoint && cacheBucket >= 0) {
                cachePoint = stepToDomPoint[cacheBucket];
                cacheBucket -= bucketSize;
            }

            cachePoint = cachePoint || basePoint;
            while (cachePoint.nextBookmark && cachePoint.nextBookmark.steps <= steps) {
                loopGuard.check();
                cachePoint = cachePoint.nextBookmark;
            }
            runtime.assert(steps === -1 || cachePoint.steps <= steps,
                    "Bookmark @" + inspectBookmarks(cachePoint) + " at step " + cachePoint.steps +
                    " exceeds requested step of " + steps);
            return cachePoint;
        }

        /**
         * Returns the closest undamaged bookmark before (or equal to) the supplied bookmark
         * @param {!ops.StepsCache.Bookmark} bookmark
         * @return {!ops.StepsCache.Bookmark}
         */
        function getUndamagedBookmark(bookmark) {
            // Based on logic in the repairCacheUpToStep, a damaged bookmark is guaranteed to have it's
            // steps moved beyond the damage point. This makes it simple to check if the bookmark is
            // in the damaged region, and return the last undamaged one if it is.
            if (lastUndamagedCacheStep !== undefined && bookmark.steps > lastUndamagedCacheStep) {
                bookmark = getClosestBookmark(lastUndamagedCacheStep);
            }
            return bookmark;
        }

        /**
         * Remove a bookmark from the cache chain
         * @param {!ops.StepsCache.Bookmark} currentBookmark
         * @return {undefined}
         */
        function removeBookmark(currentBookmark) {
            if (currentBookmark.previousBookmark) {
                currentBookmark.previousBookmark.nextBookmark = currentBookmark.nextBookmark;
            }

            if (currentBookmark.nextBookmark) {
                currentBookmark.nextBookmark.previousBookmark = currentBookmark.previousBookmark;
            }
        }

        /**
         * Returns true if the newBookmark is already directly on or after the previous bookmark
         * @param {!ops.StepsCache.Bookmark} previousBookmark
         * @param {!ops.StepsCache.Bookmark} newBookmark
         * @return {!boolean}
         */
        function isAlreadyInOrder(previousBookmark, newBookmark) {
            return previousBookmark === newBookmark || previousBookmark.nextBookmark === newBookmark;
        }

        /**
         * Insert a bookmark into the cache chain just after the previous bookmark
         * @param {!ops.StepsCache.Bookmark} previousBookmark
         * @param {!ops.StepsCache.Bookmark} newBookmark
         * @return {undefined}
         */
        function insertBookmark(previousBookmark, newBookmark) {
            var nextBookmark;
            // Check if the newBookmark is already in the chain at the correct location. Don't bother updating
            // if it is in place.
            if (!isAlreadyInOrder(previousBookmark, newBookmark)) {
                if (previousBookmark.steps === newBookmark.steps) {
                    // It is valid for multiple bookmarks to share the same step.
                    // In this case, step order becomes ambiguous so DOM order is now required to determine the
                    // correct insertion point
                    /*jslint bitwise:true*/
                    while ((newBookmark.node.compareDocumentPosition(previousBookmark.node) & DOCUMENT_POSITION_FOLLOWING) !== 0
                            && previousBookmark !== basePoint) {
                        // if the previous bookmark FOLLOWS the new bookmark, navigate back one
                        previousBookmark = /**@type{!ops.StepsCache.Bookmark}*/(previousBookmark.previousBookmark);
                    }
                    /*jslint bitwise:false*/
                }

                if (!isAlreadyInOrder(previousBookmark, newBookmark)) {
                    // Removing the existing item first helps prevent infinite-loops from being created in the event of
                    // some type of undiscovered cache bug.
                    removeBookmark(newBookmark);
                    // Assign this value before we override it just below
                    nextBookmark = previousBookmark.nextBookmark;

                    newBookmark.nextBookmark = previousBookmark.nextBookmark;
                    newBookmark.previousBookmark = previousBookmark;
                    previousBookmark.nextBookmark = newBookmark;
                    if (nextBookmark) {
                        nextBookmark.previousBookmark = newBookmark;
                    }
                }
            }
        }

        /**
         * Signal that all bookmarks up to the specified step have been iterated over and are up-to-date. This allows
         * removed nodes and invalid bookmarks to be removed from the cache. This function will return the closest
         * undamaged bookmark just at or prior to the supplied step.
         * @param {!number} currentIteratorStep
         * @return {!ops.StepsCache.Bookmark}
         */
        function repairCacheUpToStep(currentIteratorStep) {
            var damagedBookmark,
                undamagedBookmark,
                nextBookmark,
                stepsBucket;

            if (lastUndamagedCacheStep !== undefined && lastUndamagedCacheStep < currentIteratorStep) {
                // The step indicates where in the document re-iteration has covered. This function
                // is called every time a bookmark is updated, and the lastUndamagedCacheStep is updated
                // after every call. This means that all bookmarks between the undamagedBookmark and the current step
                // have not been updated, so they are either:
                // a) no longer in the document and should be removed
                // or b) are no longer before this step and should be pushed back into the damaged region

                undamagedBookmark = getClosestBookmark(lastUndamagedCacheStep); // Get the last undamaged bookmark
                damagedBookmark = undamagedBookmark.nextBookmark; // Don't need to check the undamaged bookmark however

                while (damagedBookmark && damagedBookmark.steps <= currentIteratorStep) {
                    nextBookmark = damagedBookmark.nextBookmark;
                    stepsBucket = getDestinationBucket(damagedBookmark.steps);
                    // A damaged bookmark is not valid in the stepToDomPoint. In order to minimise update load though
                    // we don't remove them all at once. Each bookmark is checked vs. the damage point first before use,
                    // so in order to guarantee we never return a damaged bookmark, we only need to remove damaged
                    // bookmarks before the damage point.

                    if (stepToDomPoint[stepsBucket] === damagedBookmark) {
                        // stepToDomPoint is a sparsely populated cache. For damaged bookmarks, the
                        // safest thing to do is to remove them entirely from view
                        delete stepToDomPoint[stepsBucket];
                    }
                    if (!domUtils.containsNode(rootElement, damagedBookmark.node)) {
                        // Node no longer exists in the document. Discard the bookmark as well
                        removeBookmark(damagedBookmark);
                        delete nodeToBookmark[damagedBookmark.nodeId];
                    } else {
                        // Move the damaged bookmark clearly past the undamaged step
                        // If this appears later in the sequence, the step number will be corrected then
                        damagedBookmark.steps = currentIteratorStep + 1;
                    }
                    damagedBookmark = nextBookmark;
                }

                // Have now recovered the cache up to the supplied step. All bookmarks up to this
                // step are guaranteed to be up-to-date.
                lastUndamagedCacheStep = currentIteratorStep;
            } else {
                undamagedBookmark = getClosestBookmark(currentIteratorStep);
            }
            return undamagedBookmark;
        }

        /**
         * Cache the current step, using the supplied node as the anchor
         * @param {!number} steps Current steps offset from position 0
         * @param {!Node} node
         * @return {undefined}
         */
        this.updateBookmark = function(steps, node) {
            var previousCacheBucket,
                newCacheBucket = getDestinationBucket(steps),
                existingCachePoint,
                bookmark,
                closestPriorBookmark;

            closestPriorBookmark = repairCacheUpToStep(steps);
            // Note, the node bookmark must be updated after the repair as if steps < lastUndamagedCacheStep
            // the repair will assume any nodes after lastUndamagedCacheStep are damaged.
            bookmark = getNodeBookmark(/**@type{!HTMLElement}*/(node));
            if (bookmark.steps !== steps) {
                previousCacheBucket = getDestinationBucket(bookmark.steps);
                if (previousCacheBucket !== newCacheBucket && stepToDomPoint[previousCacheBucket] === bookmark) {
                    delete stepToDomPoint[previousCacheBucket];
                }
                bookmark.steps = steps;
            }
            insertBookmark(closestPriorBookmark, bookmark);
            existingCachePoint = stepToDomPoint[newCacheBucket];
            // E.g., steps <= 500 are valid for a request starting at 500 and counting forward
            if (!existingCachePoint || bookmark.steps > existingCachePoint.steps) {
                // The current node & offset are closer to the cache bucket boundary than the existing entry was
                stepToDomPoint[newCacheBucket] = bookmark;
            }
            verifyCache();
        };

        /**
         * Set the iterator to the closest known position before or at the requested step, returning the number of steps
         * from position 0.
         * @param {!number} steps
         * @param {!core.PositionIterator} iterator
         * @return {!number} Corresponding step for the current iterator position
         */
        this.setToClosestStep = function (steps, iterator) {
            var cachePoint;
            verifyCache();
            cachePoint = getClosestBookmark(steps);
            cachePoint.setIteratorPosition(iterator);
            return cachePoint.steps;
        };

        /**
         * Finds the nearest ancestor node that has an associated bookmark
         * @param {!Node} node
         * @return {?ops.StepsCache.Bookmark}
         */
        function findBookmarkedAncestor(node) {
            var currentNode = node,
                nodeId,
                bookmark = null;

            while (!bookmark && currentNode && currentNode !== rootElement) {
                nodeId = getNodeId(currentNode);
                if (nodeId) {
                    // Take care as a nodeId may be bookmarked in another translator, but not this particular instance
                    // Keep crawling up the hierarchy until a node is found with a node id AND bookmark in this translator
                    bookmark = nodeToBookmark[nodeId];
                    if (bookmark && !isValidBookmarkForNode(currentNode, bookmark)) {
                        runtime.log("Cloned node detected. Creating new bookmark");
                        bookmark = null;
                        clearNodeId(/**@type{!Element}*/(currentNode));
                    }
                }
                currentNode = currentNode.parentNode;
            }
            return bookmark;
        }

        /**
         * Set the iterator to the closest known position before or at the requested node & offset, returning the number
         * of steps from position 0.
         * @param {!Node} node
         * @param {!number} offset
         * @param {!core.PositionIterator} iterator
         * @return {!number} Corresponding step for the current iterator position
         */
        this.setToClosestDomPoint = function (node, offset, iterator) {
            var /**@type{?ops.StepsCache.Bookmark}*/
                bookmark,
                b,
                /**@type{string|number}*/
                key;

            verifyCache();
            if (node === rootElement && offset === 0) {
                bookmark = basePoint;
            } else if (node === rootElement && offset === rootElement.childNodes.length) {
                bookmark = basePoint;
                for (key in stepToDomPoint) {
                    if (stepToDomPoint.hasOwnProperty(key)) {
                        b = stepToDomPoint[key];
                        if (b.steps > bookmark.steps) {
                            bookmark = b;
                        }
                    }
                }
            } else {
                bookmark = findBookmarkedAncestor(node.childNodes.item(offset) || node);
                if (!bookmark) {
                    // No immediate bookmark was found, so crawl backwards using the iterator and try and find a known position
                    iterator.setUnfilteredPosition(node, offset);
                    while (!bookmark && iterator.previousNode()) {
                        bookmark = findBookmarkedAncestor(iterator.getCurrentNode());
                    }
                }
            }

            bookmark = getUndamagedBookmark(bookmark || basePoint);
            bookmark.setIteratorPosition(iterator);
            return bookmark.steps;
        };

        /**
         * Mark all steps beyond inflectionStep as no longer accurate. Note, if a negative value
         * is passed in it is treated as a -1, and the whole cache will be cleared.
         * @param {!number} inflectionStep
         * @return {undefined}
         */
        this.damageCacheAfterStep = function(inflectionStep) {
            if (inflectionStep < 0) {
                // Truncate negative steps to be 0. Saves some badness from occurring if a negative is passed in.
                inflectionStep = -1;
            }
            if (lastUndamagedCacheStep === undefined) {
                lastUndamagedCacheStep = inflectionStep;
            } else if (inflectionStep < lastUndamagedCacheStep) {
                lastUndamagedCacheStep = inflectionStep;
            }
            verifyCache();
        };

        function init() {
            var rootElementId = getNodeId(rootElement) || setNodeId(rootElement);
            basePoint = new RootBookmark(rootElementId, 0, rootElement);
            /*jslint emptyblock:true*/
            verifyCache = ops.StepsCache.ENABLE_CACHE_VERIFICATION ? verifyCacheImpl : function() { };
            /*jslint emptyblock:false*/
        }
        init();
    };

    /**
     * Enable or disable cache verification operation after every modification. VERY SLOW.
     * This is primarily used in testing or during interactive diagnostics
     * @type {!boolean}
     */
    ops.StepsCache.ENABLE_CACHE_VERIFICATION = true;

    /*jslint emptyblock: true, unparam: true*/
    /**
     * @interface
     */
    ops.StepsCache.Bookmark = function Bookmark() { };

    /**
     * @type {!string}
     */
    ops.StepsCache.Bookmark.prototype.nodeId;

    /**
     * @type {!Node}
     */
    ops.StepsCache.Bookmark.prototype.node;

    /**
     * @type {!number}
     */
    ops.StepsCache.Bookmark.prototype.steps;

    /**
     * @type {?ops.StepsCache.Bookmark}
     */
    ops.StepsCache.Bookmark.prototype.previousBookmark;

    /**
     * @type {?ops.StepsCache.Bookmark}
     */
    ops.StepsCache.Bookmark.prototype.nextBookmark;

    /**
     * @param {!core.PositionIterator} iterator
     * @return {undefined}
     */
    ops.StepsCache.Bookmark.prototype.setIteratorPosition = function(iterator) { };
}());