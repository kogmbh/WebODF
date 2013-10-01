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

/*global runtime, gui */

/**
 * Event wiring and management abstraction layer
 * This class contains workarounds for various behaviour issues with events cross-browser. Additionally, this
 * class provides a mechanism for returning event focus back to the SessionController when it has been lost to
 * an external source.
 * @param {!ops.OdtDocument} odtDocument
 * @constructor
 */
gui.EventManager = function EventManager(odtDocument) {
    "use strict";
    var eventTrapDiv,
        bindToDirectHandler = {
            // In Safari 6.0.5 (7536.30.1), Using either attachEvent or addEventListener
            // results in the beforecut return value being ignored which prevents cut from being called.
            "beforecut": true,
            // Epiphany 3.6.1 requires this to allow the paste event to fire
            "beforepaste": true
        },
        // Events that should be bound to the global window rather than the canvas element
        bindToWindow = {
            // Capture selections that start outside the canvas element and end within the canvas element
            "mousedown": true,
            // Capture selections that start inside the canvas element and end outside of the element or even window
            "mouseup": true
        },
        delegatedEvents = {};

    /**
     * Delegates non-bubbling events to handlers
     * @constructor
     */
    function EventDelegate() {
        var self = this;
        this.handlers = [];

        /**
         * @param {!Event} e
         */
        this.delegate = function(e) {
            if (!e.bubbles) {
                // Non-bubbling events such as focus and blur can be manually delegated to interested handlers
                self.handlers.forEach(function(handler) {
                    // Yes yes... this is not a spec-compliant event processor... sorry!
                    handler(e);
                });
            }
        };
    }

    /**
     * @param {!Element|!Window} eventTarget
     * @param {!string} eventType
     * @param {function(!Event)|function()} eventHandler
     * @return {undefined}
     */
    function listenEvent(eventTarget, eventType, eventHandler) {
        var onVariant = "on" + eventType,
            bound = false;
        if (eventTarget.attachEvent) {
            bound = eventTarget.attachEvent(onVariant, eventHandler);
        }
        if (!bound && eventTarget.addEventListener) {
            eventTarget.addEventListener(eventType, eventHandler, false);
            bound = true;
        }

        if ((!bound || bindToDirectHandler[eventType]) && eventTarget.hasOwnProperty(onVariant)) {
            eventTarget[onVariant] = eventHandler;
        }
    }

    /**
     * @param {!Element|!Window} eventTarget
     * @param {!string} eventType
     * @param {function(!Event)|function()} eventHandler
     * @return {undefined}
     */
    function removeEvent(eventTarget, eventType, eventHandler) {
        var onVariant = "on" + eventType;
        if (eventTarget.detachEvent) {
            eventTarget.detachEvent(onVariant, eventHandler);
        }
        if (eventTarget.removeEventListener) {
            eventTarget.removeEventListener(eventType, eventHandler, false);
        }
        if (eventTarget[onVariant] === eventHandler) {
            eventTarget[onVariant] = null;
        }
    }

    /**
     * @param {!string} eventName
     * @param {function(!Event)|function()} handler
     */
    this.subscribe = function(eventName, handler) {
        var element = odtDocument.getOdfCanvas().getElement(),
            delegatedEvent;
        if (bindToWindow[eventName] && runtime.getWindow()) {
            element = runtime.getWindow();
        } else {
        delegatedEvent = delegatedEvents[eventName];
        if (!delegatedEvent) {
            delegatedEvent = delegatedEvents[eventName] = new EventDelegate();
            listenEvent(eventTrapDiv, eventName, delegatedEvent.delegate);
        }
        if (delegatedEvent.handlers.indexOf(handler) === -1) {
            delegatedEvent.handlers.push(handler);
        }
        }
        listenEvent(element, eventName, handler);
    };

    /**
     * @param {!string} eventName
     * @param {function(!Event)|function()} handler
     */
    this.unsubscribe = function(eventName, handler) {
        var element = odtDocument.getOdfCanvas().getElement(),
            delegatedEvent = delegatedEvents[eventName],
            removeIndex;
        if (bindToWindow[eventName] && runtime.getWindow()) {
            element = runtime.getWindow();
        }
        removeEvent(element, eventName, handler);
        if (delegatedEvent) {
            removeIndex = delegatedEvent.handlers.indexOf(handler);
            if (removeIndex !== -1) {
                delegatedEvent.splice(removeIndex, 1);
            }
        }
    };

    /**
     * Returns true if the event manager is currently receiving events
     * @returns {boolean}
     */
    function hasFocus() {
        var activeElement = odtDocument.getDOM().activeElement;
        return activeElement === eventTrapDiv || activeElement === odtDocument.getOdfCanvas().getElement();
    }
    this.hasFocus = hasFocus;

    /**
     * Return event focus back to the event manager
     */
    this.focus = function() {
        if (!hasFocus()) {
            eventTrapDiv.focus();
        }
    };

    function init() {
        var canvasElement = odtDocument.getOdfCanvas().getElement();

        eventTrapDiv = odtDocument.getDOM().createElement("div");
        eventTrapDiv.id = "eventTrap";
        eventTrapDiv.style.position = "fixed";
        // Centre the event trap as otherwise the browser will try and scroll the element into the centre of
        // the viewport on focus
        eventTrapDiv.style.top = "50%";
        eventTrapDiv.style.left = "50%";
        eventTrapDiv.style.height = "0";
        eventTrapDiv.style.width = "0";
        eventTrapDiv.style.backgroundColor = "transparent";
        eventTrapDiv.tabIndex = "-1"; // Negative tab index still allows focus, but removes accessibility by keyboard
        canvasElement.appendChild(eventTrapDiv);
    }

    init();
};