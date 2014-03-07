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

/*global runtime, gui, core, Node */

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
            "beforepaste": true,
            // Capture long-press events inside the canvas
            "longpress": true,
            // Capture compound drag events inside the canvas
            "drag": true,
            // Capture compound dragstop events inside the canvas
            "dragstop": true
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
       /**@type{!Object.<string,!CompoundEvent>}*/
        compoundEvents = {},
       /**@type{!Object.<string,!EventDelegate>}*/
        eventDelegates = {},
        /**@type{!HTMLInputElement}*/
        eventTrap,
        canvasElement = /**@type{!HTMLElement}*/(odtDocument.getCanvas().getElement()),
        eventManager = this,
        /**@type{!Object.<!number, !boolean>}*/
        longPressTimers = {},
        /**@const*/LONGPRESS_DURATION = 400; // milliseconds

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
     * A compound event is an event that is not directly supported
     * by any browser APIs but which can be representation as a
     * logical consequence of a combination of several preexisting
     * events. For example: long press, double tap, pinch, etc.
     * @constructor
     * @param {!string} eventName
     * @param {!Array.<!string>} dependencies,
     * @param {!function(!Event, !Object, !function(!Object)):undefined} eventProxy
     */
    function CompoundEvent(eventName, dependencies, eventProxy) {
        var /**@type{!Object}*/
            cachedState = {},
            events = new core.EventNotifier(['eventTriggered']);

        /**
         * @param {!Event} event
         * @return {undefined}
         */
        function subscribedProxy(event) {
            eventProxy(event, cachedState, function (compoundEventInstance) {
                compoundEventInstance.type = eventName;
                events.emit('eventTriggered', compoundEventInstance);
            });
        }

        /**
         * @param {!Function} cb
         * @return {undefined}
         */
        this.subscribe = function (cb) {
            events.subscribe('eventTriggered', cb);
        };

        /**
         * @param {!Function} cb
         * @return {undefined}
         */
        this.unsubscribe = function (cb) {
            events.unsubscribe('eventTriggered', cb);
        };

        /**
         * @return {undefined}
         */
        this.destroy = function () {
            dependencies.forEach(function (eventName) {
                eventManager.unsubscribe(eventName, subscribedProxy);
            });
        };

        function init() {
            dependencies.forEach(function (eventName) {
                eventManager.subscribe(eventName, subscribedProxy);
            });
        }
        init();
    }

    /**
     * @param {!number} timer
     * @return {undefined}
     */
    function clearTimeout(timer) {
        runtime.clearTimeout(timer);
        delete longPressTimers[timer];
    }

    /**
     * @param {!Function} fn
     * @param {!number} duration
     * @return {!number}
     */
    function setTimeout(fn, duration) {
        var timer = runtime.setTimeout(function () {
            fn();
            clearTimeout(timer);
        }, duration);
        longPressTimers[timer] = true;
        return timer;
    }

    /**
     * @param {!Event} e
     * @return {Node}
     */
    function getTarget(e) {
        // e.srcElement because IE10 likes to be different...
        return /**@type{Node}*/(e.target) || e.srcElement || null;
    }

    /**
     * A long-press occurs when a finger is placed
     * against the screen and not lifted or moved
     * before a specific short duration (400ms seems
     * approximately the time iOS takes).
     * @param {!Event} event
     * @param {!Object} cachedState
     * @param {!function(!Object):undefined} callback
     * @return {undefined}
     */
    function emitLongPressEvent(event, cachedState, callback) {
        var touchEvent = /**@type{!TouchEvent}*/(event),
            fingers = /**@type{!number}*/(touchEvent.touches.length),
            touch = /**@type{!Touch}*/(touchEvent.touches[0]),
            timer = /**@type{{timer: !number}}*/(cachedState).timer;

        if (event.type === 'touchmove' || event.type === 'touchend') {
            if (timer) {
                clearTimeout(timer);
            }
        } else if (event.type === 'touchstart') {
            if (fingers !== 1) {
                runtime.clearTimeout(timer);
            } else {
                timer = setTimeout(function () {
                    // Try to block native selection
                    // from appearing
                    event.preventDefault();
                    callback({
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        pageX: touch.pageX,
                        pageY: touch.pageY,
                        target: getTarget(event),
                        detail: 1
                    });
                }, LONGPRESS_DURATION);
            }
        }
        cachedState.timer = timer;
    }

    /**
     * Drag events are generated whenever an element with class
     * 'draggable' is touched and subsequent finger movements
     * lie on the same element. This prevents the default
     * action of touchmove, i.e. usually scrolling.
     * @param {!Event} event
     * @param {!Object} cachedState
     * @param {!function(!Object):undefined} callback
     * @return {undefined}
     */
    function emitDragEvent(event, cachedState, callback) {
        var touchEvent = /**@type{!TouchEvent}*/(event),
            fingers = /**@type{!number}*/(touchEvent.touches.length),
            touch = /**@type{!Touch}*/(touchEvent.touches[0]),
            target = /**@type{!Element}*/(getTarget(event)),
            cachedTarget = /**@type{{target: ?Element}}*/(cachedState).target;

        if (fingers !== 1
                || event.type === 'touchend') {
            cachedTarget = null;
        } else if (event.type === 'touchstart' && target.getAttribute('class') === 'draggable') {
            cachedTarget = target;
        } else if (event.type === 'touchmove' && cachedTarget) {
            // Prevent the default action of 'touchmove', i.e. scrolling.
            event.preventDefault();
            // Stop propagation, so even if there is no native scroll,
            // we can block the pan processing in ZoomHelper as well.
            event.stopPropagation();
            callback({
                clientX: touch.clientX,
                clientY: touch.clientY,
                pageX: touch.pageX,
                pageY: touch.pageY,
                target: cachedTarget,
                detail: 1
            });
        }
        cachedState.target = cachedTarget;
    }

    /**
     * Drag-stop events are generated whenever an touchend
     * is preceded by a drag event.
     * @param {!Event} event
     * @param {!Object} cachedState
     * @param {!function(!Object):undefined} callback
     * @return {undefined}
     */
    function emitDragStopEvent(event, cachedState, callback) {
        var touchEvent = /**@type{!TouchEvent}*/(event),
            target = /**@type{!Element}*/(getTarget(event)),
            /**@type{!Touch}*/
            touch,
            dragging = /**@type{{dragging: ?boolean}}*/(cachedState).dragging;

        if (event.type === 'drag') {
            dragging = true;
        } else if (event.type === 'touchend' && dragging) {
            dragging = false;
            touch = /**@type{!Touch}*/(touchEvent.changedTouches[0]);
            callback({
                clientX: touch.clientX,
                clientY: touch.clientY,
                pageX: touch.pageX,
                pageY: touch.pageY,
                target: target,
                detail: 1
            });
        }
        cachedState.dragging = dragging;
    }

    /**
     * Adds a class 'webodf-touchEnabled' to the canvas
     * @return {undefined}
     */
    function declareTouchEnabled() {
        canvasElement.classList.add('webodf-touchEnabled');
        eventManager.unsubscribe('touchstart', declareTouchEnabled);
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
        var onVariant,
            bound = false;

        if (compoundEvents.hasOwnProperty(eventType)) {
            compoundEvents[eventType].subscribe(eventHandler);
            return;
        }

        onVariant = "on" + eventType;
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
        var delegate = eventDelegates[eventName] || null;
        if (!delegate && shouldCreate) {
            delegate = eventDelegates[eventName] = new EventDelegate();
            if (bindToWindow[eventName]) {
                // Internet explorer will only supply mouse up & down on the window object
                // For other browser though, listening to both will cause two events to be processed
                listenEvent(window, eventName, delegate.handleEvent);
            }
            listenEvent(eventTrap, eventName, delegate.handleEvent);
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
     * @return {!HTMLInputElement}
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
        // Clear all long press timers, just in case
        Object.keys(longPressTimers).forEach(function (timer) {
            clearTimeout(parseInt(timer, 10));
        });
        longPressTimers.length = 0;

        Object.keys(compoundEvents).forEach(function (compoundEventName) {
            compoundEvents[compoundEventName].destroy();
        });
        compoundEvents = {};

        eventManager.unsubscribe('touchstart', declareTouchEnabled);
        eventTrap.parentNode.removeChild(eventTrap);
        // TODO: drop left eventDelegates, complain about those not unsubscribed
        // Also investigate if delegates need to proper unlisten from events in any case

        callback();
    };

    function init() {
        var sizerElement = odtDocument.getOdfCanvas().getSizer(),
            doc = sizerElement.ownerDocument;

        runtime.assert(Boolean(window), "EventManager requires a window object to operate correctly");
        eventTrap = /**@type{!HTMLInputElement}*/(doc.createElement("input"));
        eventTrap.id = "eventTrap";
        // Negative tab index still allows focus, but removes accessibility by keyboard
        eventTrap.setAttribute("tabindex", -1);
        sizerElement.appendChild(eventTrap);

        compoundEvents.longpress = new CompoundEvent('longpress', ['touchstart', 'touchmove', 'touchend'], emitLongPressEvent);
        compoundEvents.drag = new CompoundEvent('drag', ['touchstart', 'touchmove', 'touchend'], emitDragEvent);
        compoundEvents.dragstop = new CompoundEvent('dragstop', ['drag', 'touchend'], emitDragStopEvent);

        eventManager.subscribe('touchstart', declareTouchEnabled);
    }
    init();
};
