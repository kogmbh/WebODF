/**
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

/*global runtime, gui, odf, core, xmldom */

/**
 * @constructor
 * @param {!function():!Element} getRootNode
 * @param {!gui.KeyboardHandler} keyDownHandler
 * @param {!gui.KeyboardHandler} keyUpHandler
 */
gui.HyperlinkClickHandler = function HyperlinkClickHandler(getRootNode, keyDownHandler, keyUpHandler) {
    "use strict";
    var /**@const
         @type{!string}*/
        webodfns = "urn:webodf:names:helper",
        /**@const
         @type{!string}*/
        links = "links",
        /**@const
         @type{!string}*/
        inactive = "inactive",
        modifier = gui.KeyboardHandler.Modifier,
        keyCode = gui.KeyboardHandler.KeyCode,
        xpath = xmldom.XPath,
        odfUtils = new odf.OdfUtils(),
        /**@type{!Window}*/
        window = /**@type{!Window}*/(runtime.getWindow()),
        /**@type{!number}*/
        activeModifier = modifier.None,
        eventNotifier = new core.EventNotifier([
            gui.HyperlinkClickHandler.signalModifierUpdated
        ]);

    runtime.assert(window !== null,
        "Expected to be run in an environment which has a global window, like a browser.");

    /**
     * @param {?Node} node
     * @return {?Element}
     */
    function getHyperlinkElement(node) {
        while (node !== null) {
            if (odfUtils.isHyperlink(node)) {
                return /**@type{!Element}*/(node);
            }
            if (odfUtils.isParagraph(node)) {
                break;
            }
            node = node.parentNode;
        }
        return null;
    }

    /**
     * @param {!Event} e
     * @return {undefined}
     */
    this.handleClick = function (e) {
        var target = e.target || e.srcElement,
            pressedModifier,
            linkElement,
            /**@type{!string}*/
            url,
            rootNode,
            bookmarks;

        if (e.ctrlKey) {
            pressedModifier = modifier.Ctrl;
        } else if (e.metaKey) {
            pressedModifier = modifier.Meta;
        }

        if (activeModifier !== modifier.None && activeModifier !== pressedModifier) {
            return;
        }

        linkElement = getHyperlinkElement(/**@type{?Node}*/(target));
        if (!linkElement) {
            return;
        }

        url = odfUtils.getHyperlinkTarget(linkElement);
        if (url === "") {
            return;
        }

        if (url[0] === '#') { // bookmark
            url = url.substring(1);
            rootNode = /** @type {!Element} */(getRootNode());
            bookmarks = xpath.getODFElementsWithXPath(rootNode,
                "//text:bookmark-start[@text:name='" + url + "']",
                odf.Namespaces.lookupNamespaceURI);

            if (bookmarks.length === 0) {
                bookmarks = xpath.getODFElementsWithXPath(rootNode,
                    "//text:bookmark[@text:name='" + url + "']",
                    odf.Namespaces.lookupNamespaceURI);
            }

            if (bookmarks.length > 0) {
                bookmarks[0].scrollIntoView(true);
            }
        } else {
            // Ask the browser to open the link in a new window.
            runtime.getWindow().open(url);
        }

        if (e.preventDefault) {
            e.preventDefault();
        } else {
            e.returnValue = false;
        }
    };

    /**
     * Show pointer cursor when hover over hyperlink
     * @return {undefined}
     */
    function showPointerCursor() {
        getRootNode().removeAttributeNS(webodfns, links);
    }

    /**
     * Show text cursor when hover over hyperlink
     * @return {undefined}
     */
    function showTextCursor() {
        getRootNode().setAttributeNS(webodfns, links, inactive);
    }

    /**
     * @param {!number} modifierKey
     * @return {undefined}
     */
    function bindEvents(modifierKey) {
        window.removeEventListener("focus", showTextCursor, false);
        if (modifierKey !== modifier.None) {
            window.addEventListener("focus", showTextCursor, false);
        }

        keyDownHandler.unbind(keyCode.LeftMeta, modifier.Meta);
        keyDownHandler.unbind(keyCode.MetaInMozilla, modifier.Meta);
        keyDownHandler.unbind(keyCode.Ctrl, modifier.Ctrl);
        keyUpHandler.unbind(keyCode.LeftMeta, modifier.None);
        keyUpHandler.unbind(keyCode.MetaInMozilla, modifier.None);
        keyUpHandler.unbind(keyCode.Ctrl, modifier.None);
        switch (modifierKey) {
        case modifier.Ctrl:
            keyDownHandler.bind(keyCode.Ctrl, modifier.Ctrl, showPointerCursor);
            // event.ctrlKey and event.metaKey are always equal false in keyup event. Cannot really refer a source,
            // but seem this is how all browsers behave. Probably because there is no such need in this event.
            keyUpHandler.bind(keyCode.Ctrl, modifier.None, showTextCursor);
            break;
        case modifier.Meta:
            keyDownHandler.bind(keyCode.LeftMeta, modifier.Meta, showPointerCursor);
            keyDownHandler.bind(keyCode.MetaInMozilla, modifier.Meta, showPointerCursor);
            // event.ctrlKey and event.metaKey are always equal false in keyup event. Cannot really refer a source,
            // but seem this is how all browsers behave. Probably because there is no such need in this event.
            keyUpHandler.bind(keyCode.LeftMeta, modifier.None, showTextCursor);
            keyUpHandler.bind(keyCode.MetaInMozilla, modifier.None, showTextCursor);
            break;
        }
    }

    /**
     * Sets the modifier key for activating the hyperlink.
     * @param {!number} value
     * @return {undefined}
     */
    this.setModifier = function (value) {
        if (activeModifier === value) {
            return;
        }
        runtime.assert(value === modifier.None || value === modifier.Ctrl || value === modifier.Meta,
            "Unsupported KeyboardHandler.Modifier value: " + value);

        activeModifier = value;
        if (activeModifier !== modifier.None) {
            showTextCursor();
        } else {
            showPointerCursor();
        }
        bindEvents(activeModifier);
        eventNotifier.emit(gui.HyperlinkClickHandler.signalModifierUpdated, activeModifier);
    };

    /**
     * @param {!string} eventid
     * @param {*} args
     * @return {undefined}
     */
    this.emit = function (eventid, args) {
        eventNotifier.emit(eventid, args);
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
};

/**@const*/gui.HyperlinkClickHandler.signalModifierUpdated = "modifier/updated";
