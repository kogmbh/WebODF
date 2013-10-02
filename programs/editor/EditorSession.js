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

/*global define, runtime, core, gui, ops, document */

define("webodf/editor/EditorSession", [
    "dojo/text!resources/fonts/fonts.css"
], function (fontsCSS) { // fontsCSS is retrieved as a string, using dojo's text retrieval AMD plugin
    "use strict";

    runtime.libraryPaths = function () {
        return [ "../../webodf/lib" ];
    };

    runtime.loadClass("core.DomUtils");
    runtime.loadClass("ops.OdtDocument");
    runtime.loadClass("ops.Session");
    runtime.loadClass("odf.Namespaces");
    runtime.loadClass("odf.OdfCanvas");
    runtime.loadClass("gui.CaretManager");
    runtime.loadClass("gui.Caret");
    runtime.loadClass("gui.SessionController");
    runtime.loadClass("gui.SessionView");
    runtime.loadClass("gui.TrivialUndoManager");
    runtime.loadClass("core.EventNotifier");

    /**
     * Instantiate a new editor session attached to an existing operation session
     * @param {!ops.Session} session
     * @param {!string} localMemberId
     * @param {{viewOptions:gui.SessionViewOptions,directStylingEnabled:boolean}} config
     * @constructor
     */
    var EditorSession = function EditorSession(session, localMemberId, config) {
        var self = this,
            currentParagraphNode = null,
            currentCommonStyleName = null,
            currentStyleName = null,
            caretManager,
            odtDocument = session.getOdtDocument(),
            textns = odf.Namespaces.textns,
            fontStyles = document.createElement('style'),
            formatting = odtDocument.getFormatting(),
            domUtils = new core.DomUtils(),
            eventNotifier = new core.EventNotifier([
                EditorSession.signalMemberAdded,
                EditorSession.signalMemberRemoved,
                EditorSession.signalCursorMoved,
                EditorSession.signalParagraphChanged,
                EditorSession.signalCommonStyleCreated,
                EditorSession.signalCommonStyleDeleted,
                EditorSession.signalParagraphStyleModified,
                EditorSession.signalUndoStackChanged]);


        this.sessionController = new gui.SessionController(session, localMemberId, {directStylingEnabled: config.directStylingEnabled});
        caretManager = new gui.CaretManager(self.sessionController);
        this.sessionView = new gui.SessionView(config.viewOptions, session, caretManager);
        this.availableFonts = [];

        /*
         * @return {Array.{!string}}
         */
        function getAvailableFonts() {
            var availableFonts, regex, matches;

            availableFonts = {};

            regex =  /font-family *: *(?:\'([^']*)\'|\"([^"]*)\")/gm;
            matches = regex.exec(fontsCSS);

            while (matches) {
                availableFonts[matches[1] || matches[2]] = 1;
                matches = regex.exec(fontsCSS);
            }
            availableFonts = Object.keys(availableFonts);

            return availableFonts;
        }
        this.availableFonts = getAvailableFonts();

        function checkParagraphStyleName() {
            var newStyleName,
                newCommonStyleName;

            newStyleName = currentParagraphNode.getAttributeNS(textns, 'style-name');

            if (newStyleName !== currentStyleName) {
                currentStyleName = newStyleName;
                // check if common style is still the same
                newCommonStyleName = formatting.getFirstCommonParentStyleNameOrSelf(newStyleName);
                if (!newCommonStyleName) {
                    // Default style, empty-string name
                    currentCommonStyleName = newStyleName = currentStyleName = "";
                    self.emit(EditorSession.signalParagraphChanged, {
                        type: 'style',
                        node: currentParagraphNode,
                        styleName: currentCommonStyleName
                    });
                    return;
                }
                // a common style
                if (newCommonStyleName !== currentCommonStyleName) {
                    currentCommonStyleName = newCommonStyleName;
                    self.emit(EditorSession.signalParagraphChanged, {
                        type: 'style',
                        node: currentParagraphNode,
                        styleName: currentCommonStyleName
                    });
                }
            }
        }
        /**
         * Creates a NCName from the passed string
         * @param {!string} name
         * @return {!string}
         */
        function createNCName(name) {
            var letter,
                result = "",
                i;

            // encode
            for (i = 0; i < name.length; i++) {
                letter = name[i];
                // simple approach, can be improved to not skip other allowed chars
                if (letter.match(/[a-zA-Z0-9.-_]/) !== null) {
                    result += letter;
                } else {
                    result += "_" + letter.charCodeAt(0).toString(16) + "_";
                }
            }
            // ensure leading char is from proper range
            if (result.match(/^[a-zA-Z_]/) === null) {
                result = "_" + result;
            }

            return result;
        }

        function uniqueParagraphStyleNCName(name) {
            var result,
                i = 0,
                ncMemberId = createNCName(localMemberId),
                ncName = createNCName(name);

            // create default paragraph style
            // localMemberId is used to avoid id conflicts with ids created by other members
            result = ncName + "_" + ncMemberId;
            // then loop until result is really unique
            while (formatting.hasParagraphStyle(result)) {
                result = ncName + "_" + i + "_" + ncMemberId;
                i++;
            }

            return result;
        }

        function trackCursor(cursor) {
            var node;

            node = odtDocument.getParagraphElement(cursor.getNode());
            if (!node) {
                return;
            }
            currentParagraphNode = node;
            checkParagraphStyleName();
        }

        function trackCurrentParagraph(info) {
            var cursor = odtDocument.getCursor(localMemberId),
                range = cursor && cursor.getSelectedRange(),
                paragraphRange = odtDocument.getDOM().createRange();
            paragraphRange.selectNode(info.paragraphElement);
            if ((range && domUtils.rangesIntersect(range, paragraphRange)) || info.paragraphElement === currentParagraphNode) {
                self.emit(EditorSession.signalParagraphChanged, info);
                checkParagraphStyleName();
            }
            paragraphRange.detach();
        }

        function onCursorAdded(cursor) {
            self.emit(EditorSession.signalMemberAdded, cursor.getMemberId());
            trackCursor(cursor);
        }

        function onCursorRemoved(memberId) {
            self.emit(EditorSession.signalMemberRemoved, memberId);
        }

        function onCursorMoved(cursor) {
            // Emit 'cursorMoved' only when *I* am moving the cursor, not the other users
            if (cursor.getMemberId() === localMemberId) {
                self.emit(EditorSession.signalCursorMoved, cursor);
                trackCursor(cursor);
            }
        }

        function onStyleCreated(newStyleName) {
            self.emit(EditorSession.signalCommonStyleCreated, newStyleName);
        }

        function onStyleDeleted(styleName) {
            self.emit(EditorSession.signalCommonStyleDeleted, styleName);
        }

        function onParagraphStyleModified(styleName) {
            self.emit(EditorSession.signalParagraphStyleModified, styleName);
        }

        /**
         * Call all subscribers for the given event with the specified argument
         * @param {!string} eventid
         * @param {Object} args
         */
        this.emit = function (eventid, args) {
            eventNotifier.emit(eventid, args);
        };

        /**
         * Subscribe to a given event with a callback
         * @param {!string} eventid
         * @param {!Function} cb
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

        this.getMemberDetailsAndUpdates = function (memberId, subscriber) {
            return session.getMemberModel().getMemberDetailsAndUpdates(memberId, subscriber);
        };

        this.unsubscribeMemberDetailsUpdates = function (memberId, subscriber) {
            return session.getMemberModel().unsubscribeMemberDetailsUpdates(memberId, subscriber);
        };

        this.getCursorPosition = function () {
            return odtDocument.getCursorPosition(localMemberId);
        };

        this.getCursorSelection = function () {
            return odtDocument.getCursorSelection(localMemberId);
        };

        this.getOdfCanvas = function () {
            return odtDocument.getOdfCanvas();
        };

        this.getCurrentParagraph = function () {
            return currentParagraphNode;
        };

        this.getAvailableParagraphStyles = function () {
            return formatting.getAvailableParagraphStyles();
        };

        this.getCurrentParagraphStyle = function () {
            return currentCommonStyleName;
        };

        /**
         * Adds an annotation to the document based on the current selection
         * @return {undefined}
         */
        this.addAnnotation = function () {
            var op = new ops.OpAddAnnotation(),
                selection = self.getCursorSelection(),
                length = selection.length,
                position = selection.position;

            position = length >= 0 ? position : position + length;
            length = Math.abs(length);

            op.init({
                memberid: localMemberId,
                position: position,
                length: length,
                name: localMemberId + Date.now()
            });
            session.enqueue([op]);
        };

        this.setCurrentParagraphStyle = function (value) {
            var op;
            if (currentCommonStyleName !== value) {
                op = new ops.OpSetParagraphStyle();
                op.init({
                    memberid: localMemberId,
                    position: self.getCursorPosition(),
                    styleName: value
                });
                session.enqueue([op]);
            }
        };

        this.insertTable = function (initialRows, initialColumns, tableStyleName, tableColumnStyleName, tableCellStyleMatrix) {
            var op = new ops.OpInsertTable();
            op.init({
                memberid: localMemberId,
                position: self.getCursorPosition(),
                initialRows: initialRows,
                initialColumns: initialColumns,
                tableStyleName: tableStyleName,
                tableColumnStyleName: tableColumnStyleName,
                tableCellStyleMatrix: tableCellStyleMatrix
            });
            session.enqueue([op]);
        };

        /**
         * Takes a style name and returns the corresponding paragraph style
         * element. If the style name is an empty string, the default style
         * is returned.
         * @param {!string} styleName
         * @return {Element}
         */
        this.getParagraphStyleElement = function (styleName) {
            return (styleName === "")
                ? formatting.getDefaultStyleElement('paragraph')
                : odtDocument.getParagraphStyleElement(styleName);
        };

        /**
         * Returns if the style is used anywhere in the document
         * @param {!Element} styleElement
         * @return {boolean}
         */
        this.isStyleUsed = function (styleElement) {
            return formatting.isStyleUsed(styleElement);
        };

        function getDefaultParagraphStyleAttributes () {
            var styleNode = formatting.getDefaultStyleElement('paragraph');
            if (styleNode) {
                return formatting.getInheritedStyleAttributes(styleNode);
            }

            return null;
        };

        /**
         * Returns the attributes of a given paragraph style name
         * (with inheritance). If the name is an empty string,
         * the attributes of the default style are returned.
         * @param {!string} styleName
         * @return {Object}
         */
        this.getParagraphStyleAttributes = function (styleName) {
            return (styleName === "")
                ? getDefaultParagraphStyleAttributes()
                : odtDocument.getParagraphStyleAttributes(styleName);
        };

        /**
         * Creates and enqueues a paragraph-style cloning operation.
         * Returns the created id for the new style.
         * @param {!string} styleName  id of the style to update
         * @param {!{paragraphProperties,textProperties}} setProperties  properties which are set
         * @param {!{paragraphPropertyNames,textPropertyNames}=} removedProperties  properties which are removed
         * @return {undefined}
         */
        this.updateParagraphStyle = function (styleName, setProperties, removedProperties) {
            var op;
            op = new ops.OpUpdateParagraphStyle();
            op.init({
                memberid: localMemberId,
                styleName: styleName,
                setProperties: setProperties,
                removedProperties: (!removedProperties) ? {} : removedProperties
            });
            session.enqueue([op]);
        };

        /**
         * Creates and enqueues a paragraph-style cloning operation.
         * Returns the created id for the new style.
         * @param {!string} styleName id of the style to clone
         * @param {!string} newStyleDisplayName display name of the new style
         * @return {!string}
         */
        this.cloneParagraphStyle = function (styleName, newStyleDisplayName) {
            var newStyleName = uniqueParagraphStyleNCName(newStyleDisplayName),
                styleNode = self.getParagraphStyleElement(styleName),
                formatting = odtDocument.getFormatting(),
                op, setProperties, attributes, i;

            setProperties = formatting.getStyleAttributes(styleNode);
            // copy any attributes directly on the style
            attributes = styleNode.attributes;
            for (i = 0; i < attributes.length; i += 1) {
                // skip...
                // * style:display-name -> not copied, set to new string below
                // * style:name         -> not copied, set from op by styleName property
                // * style:family       -> "paragraph" always, set by op
                if (!/^(style:display-name|style:name|style:family)/.test(attributes[i].name)) {
                    setProperties[attributes[i].name] = attributes[i].value;
                }
            }

            setProperties['style:display-name'] = newStyleDisplayName;

            op = new ops.OpAddStyle();
            op.init({
                memberid: localMemberId,
                styleName: newStyleName,
                styleFamily: 'paragraph',
                setProperties: setProperties
            });
            session.enqueue([op]);

            return newStyleName;
        };

        this.deleteStyle = function (styleName) {
            var op;
            op = new ops.OpRemoveStyle();
            op.init({
                memberid: localMemberId,
                styleName: styleName,
                styleFamily: 'paragraph'
            });
            session.enqueue([op]);
        };

        /**
         * Returns an array of the declared fonts in the ODF document,
         * with 'duplicates' like Arial1, Arial2, etc removed. The alphabetically
         * first font name for any given family is kept.
         * The elements of the array are objects containing the font's name and
         * the family.
         * @return {Array.{Object}}
         */
        this.getDeclaredFonts = function () {
            var fontMap = formatting.getFontMap(),
                usedFamilies = [],
                array = [],
                sortedNames,
                key,
                value,
                i;

            // Sort all the keys in the font map alphabetically
            sortedNames = Object.keys(fontMap);
            sortedNames.sort();

            for (i = 0; i < sortedNames.length; i += 1) {
                key = sortedNames[i];
                value = fontMap[key];

                // Use the font declaration only if the family is not already used.
                // Therefore we are able to discard the alphabetic successors of the first
                // font name.
                if (usedFamilies.indexOf(value) === -1) {
                    array.push({
                        name: key,
                        family: value
                    });
                    if (value) {
                        usedFamilies.push(value);
                    }
                }
            }

            return array;
        };

        function undoStackModified(e) {
            self.emit(EditorSession.signalUndoStackChanged, e);
        }

        this.hasUndoManager = function () {
            return Boolean(self.sessionController.getUndoManager());
        };

        this.undo = function () {
            var undoManager = self.sessionController.getUndoManager();
            undoManager.moveBackward(1);
        };

        this.redo = function () {
            var undoManager = self.sessionController.getUndoManager();
            undoManager.moveForward(1);
        };

        /**
         *
         * @param {!string} mimetype
         * @param {!string} content base64 encoded string
         * @param {!number} width
         * @param {!number} height
         */
        this.insertImage = function (mimetype, content, width, height) {
            self.sessionController.getTextManipulator().removeCurrentSelection();
            self.sessionController.getImageManager().insertImage(mimetype, content, width, height);
        };
        /**
         * @param {!function(!Object=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        this.close = function (callback) {
            callback();
            /*
            self.sessionView.close(function(err) {
                if (err) {
                    callback(err);
                } else {
                    caretManager.close(function(err) {
                        if (err) {
                            callback(err);
                        } else {
                            self.sessionController.close(callback);
                        }
                    });
                }
            });
            */
        };

        /**
         * @param {!function(!Object=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function(callback) {
            var head = document.getElementsByTagName('head')[0];

            head.removeChild(fontStyles);

            odtDocument.unsubscribe(ops.OdtDocument.signalCursorAdded, onCursorAdded);
            odtDocument.unsubscribe(ops.OdtDocument.signalCursorRemoved, onCursorRemoved);
            odtDocument.unsubscribe(ops.OdtDocument.signalCursorMoved, onCursorMoved);
            odtDocument.unsubscribe(ops.OdtDocument.signalCommonStyleCreated, onStyleCreated);
            odtDocument.unsubscribe(ops.OdtDocument.signalCommonStyleDeleted, onStyleDeleted);
            odtDocument.unsubscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
            odtDocument.unsubscribe(ops.OdtDocument.signalParagraphChanged, trackCurrentParagraph);
            odtDocument.unsubscribe(ops.OdtDocument.signalUndoStackChanged, undoStackModified);

            self.sessionView.destroy(function(err) {
                if (err) {
                    callback(err);
                } else {
                    delete self.sessionView;
                    caretManager.destroy(function(err) {
                        if (err) {
                            callback(err);
                        } else {
                            self.sessionController.destroy(function(err) {
                                if (err) {
                                    callback(err);
                                } else {
                                    delete self.sessionController;
                                    callback();
                                }
                            });
                        }
                    });
                }
            });
        };

        function init() {
            var head = document.getElementsByTagName('head')[0];

            // TODO: fonts.css should be rather done by odfCanvas, or?
            fontStyles.type = 'text/css';
            fontStyles.media = 'screen, print, handheld, projection';
            fontStyles.appendChild(document.createTextNode(fontsCSS));
            head.appendChild(fontStyles);

            // Custom signals, that make sense in the Editor context. We do not want to expose webodf's ops signals to random bits of the editor UI.
            odtDocument.subscribe(ops.OdtDocument.signalCursorAdded, onCursorAdded);
            odtDocument.subscribe(ops.OdtDocument.signalCursorRemoved, onCursorRemoved);
            odtDocument.subscribe(ops.OdtDocument.signalCursorMoved, onCursorMoved);
            odtDocument.subscribe(ops.OdtDocument.signalCommonStyleCreated, onStyleCreated);
            odtDocument.subscribe(ops.OdtDocument.signalCommonStyleDeleted, onStyleDeleted);
            odtDocument.subscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
            odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, trackCurrentParagraph);
            odtDocument.subscribe(ops.OdtDocument.signalUndoStackChanged, undoStackModified);
        }

        init();
    };

    /**@const*/EditorSession.signalMemberAdded =            "memberAdded";
    /**@const*/EditorSession.signalMemberRemoved =          "memberRemoved";
    /**@const*/EditorSession.signalCursorMoved =            "cursorMoved";
    /**@const*/EditorSession.signalParagraphChanged =       "paragraphChanged";
    /**@const*/EditorSession.signalCommonStyleCreated =     "styleCreated";
    /**@const*/EditorSession.signalCommonStyleDeleted =     "styleDeleted";
    /**@const*/EditorSession.signalParagraphStyleModified = "paragraphStyleModified";
    /**@const*/EditorSession.signalUndoStackChanged =       "signalUndoStackChanged";

    return EditorSession;
});
