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

/*global core, ops, gui, runtime*/

runtime.loadClass("core.EventNotifier");
runtime.loadClass("ops.OpApplyDirectStyling");
runtime.loadClass("gui.StyleHelper");

/**
 * @constructor
 * @param {!ops.Session} session
 * @param {!string} inputMemberId
 */
gui.DirectTextStyler = function DirectTextStyler(session, inputMemberId) {
    "use strict";

    var self = this,
        odtDocument = session.getOdtDocument(),
        styleHelper = new gui.StyleHelper(odtDocument.getFormatting()),
        eventNotifier = new core.EventNotifier([gui.DirectTextStyler.textStylingChanged]),
        // cached values
        isBoldValue = false,
        isItalicValue = false,
        hasUnderlineValue = false,
        hasStrikeThroughValue = false,
        fontSizeValue,
        fontNameValue;

    /**
     * Returns the value for a hierarchy of keys.
     * E.g., get( { a: { b : 10 } }, ["a", "b"] ) will return the value 10
     * If any keys are not found, this function will return undefined
     * @param {!Object} obj
     * @param {!Array.<!string>} keys
     * @returns {*}
     */
    function get(obj, keys) {
        var i = 0,
            key = keys[i];
        while (key && obj) {
            obj = obj[key];
            i += 1;
            key = keys[i];
        }
        return keys.length === i ? obj : undefined;
    }

    /**
     * Returns the common value found at the specified key hierarchy. If one or more
     * objects in the supplied array have a different value to the first object, this
     * function will return "undefined" instead
     * @param {!Array.<!Object>} objArray
     * @param {!Array.<!string>} keys
     * @returns {*}
     */
    function getCommonValue(objArray, keys) {
        var value = get(objArray[0], keys);

        return objArray.every(function(obj) { return value === get(obj, keys);}) ? value : undefined;
    }

    /**
     * @return {undefined}
     */
    function updatedCachedValues() {
        var cursor = odtDocument.getCursor(inputMemberId),
            range = cursor && cursor.getSelectedRange(),
            currentSelectionStyles = range && styleHelper.getAppliedStyles(range),
            fontSize, diffMap;

        function noteChange(oldValue, newValue, id) {
            if (oldValue !== newValue) {
                if (diffMap === undefined) {
                    diffMap = {};
                }
                diffMap[id] = newValue;
            }
            return newValue;
        }
        isBoldValue = noteChange(isBoldValue, range ? styleHelper.isBold(range) : false, 'isBold');
        isItalicValue = noteChange(isItalicValue, range ? styleHelper.isItalic(range) : false, 'isItalic');
        hasUnderlineValue = noteChange(hasUnderlineValue, range ? styleHelper.hasUnderline(range) : false, 'hasUnderline');
        hasStrikeThroughValue = noteChange(hasStrikeThroughValue, range ? styleHelper.hasStrikeThrough(range) : false, 'hasStrikeThrough');

        fontSize = currentSelectionStyles && getCommonValue(currentSelectionStyles, ['style:text-properties', 'fo:font-size']);
        fontSizeValue = noteChange(fontSizeValue, fontSize && parseFloat(fontSize), 'fontSize'); // TODO: support other units besides pt!

        fontNameValue = noteChange(fontNameValue, currentSelectionStyles && getCommonValue(currentSelectionStyles, ['style:text-properties', 'style:font-name']), 'fontName');

        if (diffMap) {
            eventNotifier.emit(gui.DirectTextStyler.textStylingChanged, diffMap);
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorAdded(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    function onCursorRemoved(memberId) {
        if (memberId === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorMoved(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @return {undefined}
     */
    function onParagraphStyleModified() {
        // TODO: check if the cursor (selection) is actually affected
        updatedCachedValues();
    }

    /**
     * @param {!Object} args
     * @return {undefined}
     */
    function onParagraphChanged(args) {
        var cursor = odtDocument.getCursor(inputMemberId);

        if (cursor && odtDocument.getParagraphElement(cursor.getNode()) === args.paragraphElement) {
            updatedCachedValues();
        }
    }

    /**
     * @param {!function(!Range):boolean} predicate
     * @param {!function(!boolean):undefined} toggleMethod
     * @return {!boolean}
     */
    function toggle(predicate, toggleMethod) {
        var cursor = odtDocument.getCursor(inputMemberId);
        // no own cursor yet/currently added?
        if (!cursor) {
            return false;
        }
        toggleMethod(!predicate(cursor.getSelectedRange()));
        return true;
    }

    /**
     * @param {!string} propertyName
     * @param {!string} propertyValue
     * @return {undefined}
     */
    function formatTextSelection(propertyName, propertyValue) {
        var selection = odtDocument.getCursorSelection(inputMemberId),
            op = new ops.OpApplyDirectStyling(),
            properties = {};
        properties[propertyName] = propertyValue;

        op.init({
            memberid: inputMemberId,
            position: selection.position,
            length: selection.length,
            setProperties: {'style:text-properties' : properties }
        });
        session.enqueue([op]);
    }

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setBold(checked) {
        var value = checked ? 'bold' : 'normal';
        formatTextSelection('fo:font-weight', value);
    }
    this.setBold = setBold;

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setItalic(checked) {
        var value = checked ? 'italic' : 'normal';
        formatTextSelection('fo:font-style', value);
    }
    this.setItalic = setItalic;

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setHasUnderline(checked) {
        var value = checked ? 'solid' : 'none';
        formatTextSelection('style:text-underline-style', value);
    }
    this.setHasUnderline = setHasUnderline;

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setHasStrikethrough(checked) {
        var value = checked ? 'solid' : 'none';
        formatTextSelection('style:text-line-through-style', value);
    }
    this.setHasStrikethrough = setHasStrikethrough;

    /**
     * @param {!number} value
     * @return {undefined}
     */
    function setFontSize(value) {
        formatTextSelection('fo:font-size', value + "pt");
    }
    this.setFontSize = setFontSize;

    /**
     * @param {!string} value
     * @return {undefined}
     */
    function setFontName(value) {
        formatTextSelection('style:font-name', value);
    }
    this.setFontName = setFontName;


    /**
     * @return {!boolean}
     */
    this.toggleBold = toggle.bind(self, styleHelper.isBold, setBold);

    /**
     * @return {!boolean}
     */
    this.toggleItalic = toggle.bind(self, styleHelper.isItalic, setItalic);

    /**
     * @return {!boolean}
     */
    this.toggleUnderline = toggle.bind(self, styleHelper.hasUnderline, setHasUnderline);

    /**
     * @return {!boolean}
     */
    this.toggleStrikethrough = toggle.bind(self, styleHelper.hasStrikeThrough, setHasStrikethrough);

    /**
     * @return {!boolean}
     */
    this.isBold = function() {
        return isBoldValue;
    };

    /**
     * @return {!boolean}
     */
    this.isItalic = function() {
        return isItalicValue;
    };

    /**
     * @return {!boolean}
     */
    this.hasUnderline = function() {
        return hasUnderlineValue;
    };

    /**
     * @return {!boolean}
     */
    this.hasStrikeThrough = function() {
        return hasStrikeThroughValue;
    };

    /**
     * @return {!number}
     */
    this.fontSize = function() {
        return fontSizeValue;
    };

    /**
     * @return {!string}
     */
    this.fontName = function() {
        return fontNameValue;
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
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function(callback) {
        odtDocument.unsubscribe(ops.OdtDocument.signalCursorAdded, onCursorAdded);
        odtDocument.unsubscribe(ops.OdtDocument.signalCursorRemoved, onCursorRemoved);
        odtDocument.unsubscribe(ops.OdtDocument.signalCursorMoved, onCursorMoved);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        callback();
    };

    function init() {
        odtDocument.subscribe(ops.OdtDocument.signalCursorAdded, onCursorAdded);
        odtDocument.subscribe(ops.OdtDocument.signalCursorRemoved, onCursorRemoved);
        odtDocument.subscribe(ops.OdtDocument.signalCursorMoved, onCursorMoved);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        updatedCachedValues();
    }

    init();
};

/**@const*/gui.DirectTextStyler.textStylingChanged = "textStyling/changed";

(function () {
    "use strict";
    return gui.DirectTextStyler;
}());

