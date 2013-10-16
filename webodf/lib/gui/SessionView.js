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

/*global Node, document, runtime, gui, ops, core */

runtime.loadClass("gui.Caret");
runtime.loadClass("ops.TrivialMemberModel");
runtime.loadClass("ops.EditInfo");
runtime.loadClass("gui.EditInfoMarker");

/**
 * @constructor
 * @struct
 */
gui.SessionViewOptions = function () {
    "use strict";

    /**
     * Set the initial edit information marker visibility
     * @type {boolean}
     */
    this.editInfoMarkersInitiallyVisible = true;

    /**
     * Sets the initial visibility of the avatar
     * @type {boolean}
     */
    this.caretAvatarsInitiallyVisible = true;

    /**
     * Specify that the caret should blink if a non-collapsed range is selected
     * @type {boolean}
     */
    this.caretBlinksOnRangeSelect = true;
};

gui.SessionView = (function () {
    "use strict";

    /**
     * Return a user-specified option, or the default value if no user option
     * is provided
     * @param {boolean} userValue
     * @param {!boolean} defaultValue
     * @returns {!boolean}
     */
    function configOption(userValue, defaultValue) {
        return userValue !== undefined ? Boolean(userValue) : defaultValue;
    }

    /**
     * TODO: We really don't want to let SessionView be aware of localMemberId,
     * so eventually we'll need to refactor this. It is only here so that the id can
     * be matched with the memberids for which CSS is generated, to generate the same CSS
     * for shadow cursors.
     * @constructor
     * @param {!gui.SessionViewOptions} viewOptions
     * @param {!ops.Session} session
     * @param {!gui.CaretManager} caretManager
     */
    function SessionView(viewOptions, localMemberId, session, caretManager, selectionViewManager) {
        var avatarInfoStyles,
            editInfons = 'urn:webodf:names:editinfo',
            editInfoMap = {},
            showEditInfoMarkers = configOption(viewOptions.editInfoMarkersInitiallyVisible, true),
            showCaretAvatars = configOption(viewOptions.caretAvatarsInitiallyVisible, true),
            blinkOnRangeSelect = configOption(viewOptions.caretBlinksOnRangeSelect, true),
            rerenderIntervalId,
            rerenderSelectionViews = false,
            /**@const*/RERENDER_INTERVAL = 200; // milliseconds

        /**
         * @param {!string} nodeName
         * @param {!string} memberId
         * @param {!string} pseudoClass
         * @return {!string}
         */
        function createAvatarInfoNodeMatch(nodeName, memberId, pseudoClass) {
            return nodeName + '[editinfo|memberid="' + memberId + '"]' + pseudoClass;
        }

        /**
         * @param {!string} nodeName
         * @param {!string} memberId
         * @param {string} pseudoClass
         * @return {?Node}
         */
        function getAvatarInfoStyle(nodeName, memberId, pseudoClass) {
            var node = avatarInfoStyles.firstChild,
                nodeMatch = createAvatarInfoNodeMatch(nodeName, memberId, pseudoClass);

            while (node) {
                if ((node.nodeType === Node.TEXT_NODE) && (node.data.indexOf(nodeMatch) === 0)) {
                    return node;
                }
                node = node.nextSibling;
            }
            return null;
        }

        /**
         * @param {!string} memberId
         * @param {!string} name
         * @param {!string} color
         * @return {undefined}
         */
        function setAvatarInfoStyle(memberId, name, color) {
            /**
             * @param {!string} nodeName
             * @param {!string} rule
             * @param {!string} pseudoClass
             */
            function setStyle(nodeName, rule, pseudoClass) {
                var styleRule = createAvatarInfoNodeMatch(nodeName, memberId, pseudoClass) + rule,
                    styleNode = getAvatarInfoStyle(nodeName, memberId, pseudoClass);

                // TODO: this does not work with Firefox 16.0.1, throws a HierarchyRequestError on first try.
                // And Chromium a "SYNTAX_ERR: DOM Exception 12" now
                // avatarEditedStyles.sheet.insertRule(paragraphStyleName+styleRuleRudimentCStr, 0);
                // Workaround for now:
                if (styleNode) {
                    styleNode.data = styleRule;
                } else {
                    avatarInfoStyles.appendChild(document.createTextNode(styleRule));
                }
            }

            setStyle('div.editInfoMarker', '{ background-color: ' + color + '; }', '');
            setStyle('span.editInfoColor', '{ background-color: ' + color + '; }', '');
            setStyle('span.editInfoAuthor', '{ content: "' + name + '"; }', ':before');
            setStyle('dc|creator', '{ content: "' + name + '"; display: none;}', ':before');
            setStyle('dc|creator', '{ background-color: ' + color + '; }', '');
            setStyle('div.selectionOverlay', '{ background-color: ' + color + ';}', '');
        }

        /**
         * @param {!Element} element
         * @param {!string} memberId
         * @param {!number} timestamp
         * @return {undefined}
         */
        function highlightEdit(element, memberId, timestamp) {
            var editInfo,
                editInfoMarker,
                id = '',
                editInfoNode = element.getElementsByTagNameNS(editInfons, 'editinfo')[0];

            if (editInfoNode) {
                id = editInfoNode.getAttributeNS(editInfons, 'id');
                editInfoMarker = editInfoMap[id];
            } else {
                id = Math.random().toString();
                editInfo = new ops.EditInfo(element, session.getOdtDocument());
                editInfoMarker = new gui.EditInfoMarker(editInfo, showEditInfoMarkers);

                editInfoNode = element.getElementsByTagNameNS(editInfons, 'editinfo')[0];
                editInfoNode.setAttributeNS(editInfons, 'id', id);
                editInfoMap[id] = editInfoMarker;
            }

            editInfoMarker.addEdit(memberId, new Date(timestamp));
        }

        /**
         * Updates the visibility on all existing editInfo entries
         * @param {!boolean} visible
         * @return {undefined}
         */
        function setEditInfoMarkerVisibility(visible) {
            var editInfoMarker, keyname;

            for (keyname in editInfoMap) {
                if (editInfoMap.hasOwnProperty(keyname)) {
                    editInfoMarker = editInfoMap[keyname];
                    if (visible) {
                        editInfoMarker.show();
                    } else {
                        editInfoMarker.hide();
                    }
                }
            }
        }

        /**
         * Updates the visibility on all existing avatars
         * @param {!boolean} visible
         * @return {undefined}
         */
        function setCaretAvatarVisibility(visible) {
            caretManager.getCarets().forEach(function(caret) {
                if (visible) {
                    caret.showHandle();
                } else {
                    caret.hideHandle();
                }
            });
        }

        /**
         * Show edit information markers displayed near edited paragraphs
         * @return {undefined}
         */
        this.showEditInfoMarkers = function () {
            if (showEditInfoMarkers) {
                return;
            }

            showEditInfoMarkers = true;
            setEditInfoMarkerVisibility(showEditInfoMarkers);
        };

        /**
         * Hide edit information markers displayed near edited paragraphs
         * @return {undefined}
         */
        this.hideEditInfoMarkers = function () {
            if (!showEditInfoMarkers) {
                return;
            }

            showEditInfoMarkers = false;
            setEditInfoMarkerVisibility(showEditInfoMarkers);
        };

        /**
         * Show member avatars above the cursor
         * @return {undefined}
         */
        this.showCaretAvatars = function () {
            if (showCaretAvatars) {
                return;
            }

            showCaretAvatars = true;
            setCaretAvatarVisibility(showCaretAvatars);
        };

        /**
         * Hide member avatars above the cursor
         * @return {undefined}
         */
        this.hideCaretAvatars = function () {
            if (!showCaretAvatars) {
                return;
            }

            showCaretAvatars = false;
            setCaretAvatarVisibility(showCaretAvatars);
        };

        /**
         * @return {!ops.Session}
         */
        this.getSession = function () {
            return session;
        };
        /**
         * @param {!string} memberid
         * @return {?gui.Caret}
         */
        this.getCaret = function (memberid) {
            return caretManager.getCaret(memberid);
        };

        /**
         * @param {!string} memberId
         * @param {?Object} memberData
         * @return {undefined}
         *
         * Setting memberData to null will apply empty (bogus) member data.
         */
        function renderMemberData(memberId, memberData) {
            var caret = caretManager.getCaret(memberId);

            // this takes care of incorrectly implemented MemberModels,
            // which might end up returning undefined member data
            if (!memberData) {
                runtime.log("MemberModel sent undefined data for member \"" + memberId + "\".");
                return;
            }

            if (caret) {
                caret.setAvatarImageUrl(memberData.imageurl);
                caret.setColor(memberData.color);
            }

            setAvatarInfoStyle(memberId, memberData.fullname, memberData.color);
            if (localMemberId === memberId) {
                // Shadow cursor has an empty member ID
                setAvatarInfoStyle("", memberData.fullname, memberData.color);
            }
        }

        /**
         * @param {!ops.OdtCursor} cursor
         * @return {undefined}
         */
        function onCursorAdded(cursor) {
            var memberId = cursor.getMemberId(),
                memberModel = session.getMemberModel();

            caretManager.registerCursor(cursor, showCaretAvatars, blinkOnRangeSelect);
            selectionViewManager.registerCursor(cursor, true);

            // preset bogus data
            // TODO: indicate loading state
            // (instead of setting the final 'unknown identity' data)
            renderMemberData(memberId, null);
            // subscribe to real updates
            memberModel.getMemberDetailsAndUpdates(memberId, renderMemberData);

            runtime.log("+++ View here +++ eagerly created an Caret for '" + memberId + "'! +++");
        }

        function onCursorMoved(cursor) {
            var memberId = cursor.getMemberId(),
                localSelectionView = selectionViewManager.getSelectionView(localMemberId),
                shadowSelectionView = selectionViewManager.getSelectionView(gui.ShadowCursor.ShadowCursorMemberId),
                localCaret = caretManager.getCaret(localMemberId);

            if (memberId === localMemberId) {
                // If our actual cursor moved, then hide the shadow cursor's selection
                shadowSelectionView.hide();
                localSelectionView.show();
                if (localCaret) {
                    localCaret.show();
                }
            } else if (memberId === gui.ShadowCursor.ShadowCursorMemberId) {
                // If the shadow cursor moved, then hide the current cursor's selection
                shadowSelectionView.show();
                localSelectionView.hide();
                if (localCaret) {
                    localCaret.hide();
                }
            }
        }

        /**
         * @param {!string} memberid
         * @return {undefined}
         */
        function onCursorRemoved(memberid) {
            var /**@type{!boolean}*/ hasMemberEditInfo = false,
                keyname;

            // check if there is any edit info with this member
            for (keyname in editInfoMap) {
                if (editInfoMap.hasOwnProperty(keyname) &&
                        editInfoMap[keyname].getEditInfo().getEdits().hasOwnProperty(memberid)) {
                    hasMemberEditInfo = true;
                    break;
                }
            }

            selectionViewManager.removeSelectionView(memberid);

            if (!hasMemberEditInfo) {
                session.getMemberModel().unsubscribeMemberDetailsUpdates(memberid, renderMemberData);
            }
        }

        /**
         * @param {!Object} info
         * @return {undefined}
         */
        function onParagraphChanged(info) {
            highlightEdit(info.paragraphElement, info.memberId, info.timeStamp);
        }

        /**
         * @return {undefined}
         */
        function requestRerenderOfSelectionViews() {
            rerenderSelectionViews = true;
        }

        /**
         * Starts an interval loop that rerenders selection views and whatever else
         * needs refreshing every RERENDER_INTERVAL milliseconds.
         * @return {undefined}
         */
        function startRerenderLoop() {
            rerenderIntervalId = runtime.getWindow().setInterval(function () {
                if (rerenderSelectionViews) {
                    selectionViewManager.rerenderSelectionViews();
                    rerenderSelectionViews = false;
                }
            }, RERENDER_INTERVAL);
        }
        /**
         * Stops the rerender loop.
         */
        function stopRerenderLoop() {
            runtime.getWindow().clearInterval(rerenderIntervalId);
        }

        /**
         * @param {!function(!Object=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function(callback) {
            var odtDocument = session.getOdtDocument(),
                memberModel = session.getMemberModel(),
                editInfoArray = Object.keys(editInfoMap).map(function(keyname) { return editInfoMap[keyname]; });

            odtDocument.unsubscribe(ops.OdtDocument.signalCursorAdded, onCursorAdded);
            odtDocument.unsubscribe(ops.OdtDocument.signalCursorRemoved, onCursorRemoved);
            odtDocument.unsubscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
            odtDocument.unsubscribe(ops.OdtDocument.signalCursorMoved, onCursorMoved);

            odtDocument.unsubscribe(ops.OdtDocument.signalParagraphChanged, requestRerenderOfSelectionViews);
            odtDocument.unsubscribe(ops.OdtDocument.signalTableAdded, requestRerenderOfSelectionViews);
            odtDocument.unsubscribe(ops.OdtDocument.signalParagraphStyleModified, requestRerenderOfSelectionViews);

            stopRerenderLoop();

            caretManager.getCarets().forEach(function(caret) {
                memberModel.unsubscribeMemberDetailsUpdates(caret.getCursor().getMemberId(), renderMemberData);
            });

            avatarInfoStyles.parentNode.removeChild(avatarInfoStyles);

            (function destroyEditInfo(i, err){
                if (err) {
                    callback(err);
                } else {
                    if(i < editInfoArray.length) {
                        editInfoArray[i].destroy(function(err){ destroyEditInfo(i+1, err);});
                    } else {
                        callback();
                    }
                }
            }(0, undefined));
        };

        function init() {
            var odtDocument = session.getOdtDocument(),
                head = document.getElementsByTagName('head')[0];

            odtDocument.subscribe(ops.OdtDocument.signalCursorAdded, onCursorAdded);
            odtDocument.subscribe(ops.OdtDocument.signalCursorRemoved, onCursorRemoved);
            odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
            odtDocument.subscribe(ops.OdtDocument.signalCursorMoved, onCursorMoved);

            startRerenderLoop();

            odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, requestRerenderOfSelectionViews);
            odtDocument.subscribe(ops.OdtDocument.signalTableAdded, requestRerenderOfSelectionViews);
            odtDocument.subscribe(ops.OdtDocument.signalParagraphStyleModified, requestRerenderOfSelectionViews);

            // Add a css sheet for user info-edited styling
            avatarInfoStyles = document.createElementNS(head.namespaceURI, 'style');
            avatarInfoStyles.type = 'text/css';
            avatarInfoStyles.media = 'screen, print, handheld, projection';
            avatarInfoStyles.appendChild(document.createTextNode('@namespace editinfo url(urn:webodf:names:editinfo);'));
            avatarInfoStyles.appendChild(document.createTextNode('@namespace dc url(http://purl.org/dc/elements/1.1/);'));
            head.appendChild(avatarInfoStyles);
        }
        init();
    }

    return SessionView;
}());
