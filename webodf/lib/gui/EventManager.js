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

/*global runtime, gui, core */

/**
 * Event wiring and management abstraction layer
 * This class contains workarounds for various behaviour issues with events cross-browser. Additionally, this
 * class provides a mechanism for returning event focus back to the SessionController when it has been lost to
 * an external source.
 * @constructor
 * @implements {core.Destroyable}
 * @param {!ops.OdtDocument} odtDocument
 */
gui.EventManager = function EventManager(odtDocument) {
    "use strict";
    var window = /**@type{!Window}*/(runtime.getWindow()),
        /**@type{!Object.<string,boolean>}*/
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
            "mouseup": true,
            // Focus is a non-bubbling event, and we'll usually pass focus to the event trap
            "focus": true
        },
        /**@type{!Object.<string,!EventDelegate>}*/
        eventDelegates = {},
        /**@type{!HTMLDivElement}*/
        eventTrap;

    /**
     * Get the current canvas element. The current trivial undo manager replaces the root element
     * of the ODF container with a clone from a previous state. This results in the root element
     * being changed. As such, it can't be stored, and should be queried on each use.
     * @return {!Element}
     */
    function getCanvasElement() {
        // TODO Remove when a proper undo manager arrives
        return odtDocument.getOdfCanvas().getElement();
    }

    /**
     * Ensures events that may bubble through multiple sources are only handled once.
     * @constructor
     */
    function EventDelegate() {
        var self = this,
            recentEvents = [];

        /**
         * @type {!Array.<!function(!Event):!boolean>}
         */
        this.filters = [];

        /**
         * @type {!Array.<!function(!Event)>}
         */
        this.handlers = [];

        /**
         * @param {!Event} e
         */
        this.handleEvent = function (e) {
            if (recentEvents.indexOf(e) === -1) {
                recentEvents.push(e); // Track this event as already processed by these handlers
                if (self.filters.every(function (filter) { return filter(e); })) {
                    self.handlers.forEach(function (handler) {
                        // Yes yes... this is not a spec-compliant event processor... sorry!
                        handler(e);
                    });
                }
                // Reset the processed events list after this tick is complete. The event won't be
                // processed by any other sources after this
                runtime.setTimeout(function () { recentEvents.splice(recentEvents.indexOf(e), 1); }, 0);
            }
        };
    }

    /**
     * @param {!Window} window
     * @constructor
     */
    function WindowScrollState(window) {
        var x = window.scrollX,
            y = window.scrollY;

        /**
         * Restore the scroll state captured on construction
         */
        this.restore = function () {
            if (window.scrollX !== x || window.scrollY !== y) {
                window.scrollTo(x, y);
            }
        };
    }

    /**
     * @param {!Element} element
     * @constructor
     */
    function ElementScrollState(element) {
        var top = element.scrollTop,
            left = element.scrollLeft;

        /**
         * Restore the scroll state captured on construction
         */
        this.restore = function () {
            if (element.scrollTop !== top || element.scrollLeft !== left) {
                element.scrollTop = top;
                element.scrollLeft = left;
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
            // attachEvent is only supported in Internet Explorer < 11
            eventTarget.attachEvent(onVariant, eventHandler);
            bound = true; // assume it was bound, missing @return in externs.js
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
     * Get an event delegate for the requested event name
     * @param {!string} eventName
     * @param {!boolean} shouldCreate Create a delegate for the requested event if it doesn't exist
     * @return {EventDelegate}
     */
    function getDelegateForEvent(eventName, shouldCreate) {
        var delegate = eventDelegates[eventName] || null,
            canvasElement;
        if (!delegate && shouldCreate) {
            canvasElement = getCanvasElement();
            delegate = eventDelegates[eventName] = new EventDelegate();
            if (bindToWindow[eventName]) {
                // Internet explorer will only supply mouse up & down on the window object
                // For other browser though, listening to both will cause two events to be processed
                listenEvent(window, eventName, delegate.handleEvent);
            }
            listenEvent(eventTrap, eventName, delegate.handleEvent);
            // TODO this needs to be rebound if canvasElement changes
            listenEvent(canvasElement, eventName, delegate.handleEvent);
        }
        return delegate;
    }

    /**
     * Add an event filter that is able to reject events from being processed
     * @param {!string} eventName
     * @param {!function(!Event):!boolean} filter
     */
    this.addFilter = function (eventName, filter) {
        var delegate = getDelegateForEvent(eventName, true);
        delegate.filters.push(filter);
    };

    /**
     * Remove a registered event filter
     * @param {!string} eventName
     * @param {!function(!Event):!boolean} filter
     */
    this.removeFilter = function (eventName, filter) {
        var delegate = getDelegateForEvent(eventName, true),
            index = delegate.filters.indexOf(filter);
        if (index !== -1) {
            delegate.filters.splice(index, 1);
        }
    };

    /**
     * @param {!string} eventName
     * @param {function(!Event)|function()} handler
     */
    this.subscribe = function (eventName, handler) {
        var delegate = getDelegateForEvent(eventName, true);
        delegate.handlers.push(handler);
    };

    /**
     * @param {!string} eventName
     * @param {function(!Event)|function()} handler
     */
    this.unsubscribe = function (eventName, handler) {
        var delegate = getDelegateForEvent(eventName, false),
            handlerIndex = delegate && delegate.handlers.indexOf(handler);
        if (delegate && handlerIndex !== -1) {
            delegate.handlers.splice(handlerIndex, 1);
        }
    };

    /**
     * Returns true if the event manager is currently receiving events
     * @return {boolean}
     */
    function hasFocus() {
        return odtDocument.getDOMDocument().activeElement === eventTrap;
    }
    this.hasFocus = hasFocus;

    /**
     * Find the all scrollable ancestor for the specified element
     * @param {Element} element
     * @return {!Array.<!WindowScrollState>}
     */
    function findScrollableParents(element) {
        var scrollParents = [];
        while (element) {
            // Find the first scrollable parent and track it's current position
            // This is assumed to be the document scroll pane
            if (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight) {
                scrollParents.push(new ElementScrollState(element));
            }
            element = /**@type {Element}*/(element.parentNode);
        }
        scrollParents.push(new WindowScrollState(window));
        return scrollParents;
    }

    /**
     * Return event focus back to the event manager
     */
    this.focus = function () {
        var scrollParents;
        if (!hasFocus()) {
            // http://www.whatwg.org/specs/web-apps/current-work/#focus-management
            // Passing focus back to an element that did not previously have it will also
            // cause the element to attempt to recentre back into scroll view
            scrollParents = findScrollableParents(eventTrap);
            eventTrap.focus();
            scrollParents.forEach(function (scrollParent) {
                scrollParent.restore();
            });
        }
    };

    /**
     * Returns the event trap div
     * @return {!Element}
     */
    this.getEventTrap = function () {
        return eventTrap;
    };

    /**
     * Blur focus from the event manager
     */
    this.blur = function () {
        if (hasFocus()) {
            eventTrap.blur();
        }
    };

    /**
      * @param {!function(!Object=)} callback passing an error object in case of error
      * @return {undefined}
      */
    this.destroy = function (callback) {
        var eventTrapParentNode = eventTrap.parentNode;

        // InputMethodEditor moves the eventTrap around,
        // so do not rely on still being a child of the current canvas element
        if (eventTrapParentNode) {
            eventTrapParentNode.removeChild(eventTrap);
        }

        // TODO: drop left eventDelegates, complain about those not unsubscribed
        // Also investigate if delegates need to proper unlisten from events in any case

        callback();
    };

    function init() {
        var canvasElement = getCanvasElement(),
            doc = canvasElement.ownerDocument;

        runtime.assert(Boolean(window), "EventManager requires a window object to operate correctly");
        eventTrap = /**@type{!HTMLInputElement}*/(doc.createElement("input"));
        eventTrap.id = "eventTrap";
        canvasElement.appendChild(eventTrap);
    }
    init();
};
