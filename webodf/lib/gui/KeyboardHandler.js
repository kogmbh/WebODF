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

/*global gui, runtime */
/*jslint bitwise: true*/

/**
 * @constructor
 * @return {?}
 */
gui.KeyboardHandler = function KeyboardHandler() {
    "use strict";
    var modifier = gui.KeyboardHandler.Modifier,
        defaultBinding = null,
        bindings = {};

    /**
     * @return {!number}
     */
    function getModifiers(e) {
        var modifiers = modifier.None;
        if (e.metaKey) { modifiers |= modifier.Meta; }
        if (e.ctrlKey) { modifiers |= modifier.Ctrl; }
        if (e.altKey) { modifiers |= modifier.Alt; }
        if (e.shiftKey) { modifiers |= modifier.Shift; }
        return modifiers;
    }

    /**
     * @return {!string}
     */
    function getKeyCombo(keyCode, modifiers) {
        if (!modifiers) {
            modifiers = modifier.None;
        }
        return keyCode + ':' + modifiers;
    }

    /**
     * @param {!Function}   callback
     */
    this.setDefault = function (callback) {
        defaultBinding = callback;
    };

    /**
     * @param {!number}     keyCode
     * @param {!number}     modifiers
     * @param {!Function}   callback
     */
    this.bind = function (keyCode, modifiers, callback) {
        var keyCombo = getKeyCombo(keyCode, modifiers);
        runtime.assert(bindings.hasOwnProperty(keyCombo) === false,
            "tried to overwrite the callback handler of key combo: " + keyCombo);
        bindings[keyCombo] = callback;
    };

    /**
     * @param {!number}     keyCode
     * @@param {!number}    modifiers
     */
    this.unbind = function (keyCode, modifiers) {
        var keyCombo = getKeyCombo(keyCode, modifiers);
        delete bindings[keyCombo];
    };

    /*
     * removes all the bindings includes the default binding
     */
    this.reset = function () {
        defaultBinding = null;
        bindings = {};
    };

    /**
     * @param {!Event} e
     */
    this.handleEvent = function (e) {
        var keyCombo = getKeyCombo(e.keyCode, getModifiers(e)),
            callback = bindings[keyCombo],
            handled = false;

        if (callback) {
            handled = callback();
        } else if (defaultBinding !== null) {
            handled = defaultBinding(e);
        }

        if (handled) {
            if (e.preventDefault) {
                e.preventDefault();
            } else {
                e.returnValue = false;
            }
        }
    };
};

/**@const*/
gui.KeyboardHandler.Modifier = {
    None: 0,
    Meta: 1,
    Ctrl: 2,
    Alt: 4,
    CtrlAlt: 6,
    Shift: 8,
    MetaShift: 9,
    CtrlShift: 10,
    AltShift: 12
};

/**@const*/
gui.KeyboardHandler.KeyCode = {
    Backspace: 8,
    Tab: 9,
    Clear: 12,
    Enter: 13,
    End: 35,
    Home: 36,
    Left: 37,
    Up: 38,
    Right: 39,
    Down: 40,
    Delete: 46,
    A: 65,
    B: 66,
    C: 67,
    D: 68,
    E: 69,
    F: 70,
    G: 71,
    H: 72,
    I: 73,
    J: 74,
    K: 75,
    L: 76,
    M: 77,
    N: 78,
    O: 79,
    P: 80,
    Q: 81,
    R: 82,
    S: 83,
    T: 84,
    U: 85,
    V: 86,
    W: 87,
    X: 88,
    Y: 89,
    Z: 90
};

(function () {
    "use strict";
    return gui.KeyboardHandler;
}());
