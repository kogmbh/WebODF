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

/*global runtime, ops */

/*
 * create specific operation instances.
 */

runtime.loadClass("ops.OpAddCursor");
runtime.loadClass("ops.OpApplyDirectStyling");
runtime.loadClass("ops.OpRemoveCursor");
runtime.loadClass("ops.OpMoveCursor");
runtime.loadClass("ops.OpSetBlob");
runtime.loadClass("ops.OpRemoveBlob");
runtime.loadClass("ops.OpInsertImage");
runtime.loadClass("ops.OpInsertTable");
runtime.loadClass("ops.OpInsertText");
runtime.loadClass("ops.OpRemoveText");
runtime.loadClass("ops.OpSplitParagraph");
runtime.loadClass("ops.OpSetParagraphStyle");
runtime.loadClass("ops.OpUpdateParagraphStyle");
runtime.loadClass("ops.OpAddStyle");
runtime.loadClass("ops.OpRemoveStyle");
runtime.loadClass("ops.OpAddAnnotation");
runtime.loadClass("ops.OpRemoveAnnotation");

/**
 * @constructor
 */
ops.OperationFactory = function OperationFactory() {
    "use strict";
    var specs;

    /**
     * Registers an operation constructor with this operation factory
     * @param {!string} specName
     * @param {!function(Object) : !ops.Operation} specConstructor
     */
    this.register = function(specName, specConstructor) {
        specs[specName] = specConstructor;
    };

    /**
     * Create an instance of an operation based on the provided spec
     * @param {Object} spec
     * @returns {ops.Operation|null}
     */
    this.create = function (spec) {
        var op = null,
            specConstructor = specs[spec.optype];
        if (specConstructor) {
            op = specConstructor(spec);
            op.init(spec);
        }
        return op;
    };

    /**
     * Returns a constructor function for the provided type
     * @param OperationType Operation type
     * @returns {Function}
     */
    function constructor(OperationType) {
        return function() {
            return new OperationType();
        };
    }

    function init() {
        specs = {
            AddCursor : constructor(ops.OpAddCursor),
            ApplyDirectStyling : constructor(ops.OpApplyDirectStyling),
            SetBlob : constructor(ops.OpSetBlob),
            RemoveBlob : constructor(ops.OpRemoveBlob),
            InsertImage : constructor(ops.OpInsertImage),
            InsertTable : constructor(ops.OpInsertTable),
            InsertText : constructor(ops.OpInsertText),
            RemoveText : constructor(ops.OpRemoveText),
            SplitParagraph : constructor(ops.OpSplitParagraph),
            SetParagraphStyle : constructor(ops.OpSetParagraphStyle),
            UpdateParagraphStyle : constructor(ops.OpUpdateParagraphStyle),
            AddStyle : constructor(ops.OpAddStyle),
            RemoveStyle : constructor(ops.OpRemoveStyle),
            MoveCursor : constructor(ops.OpMoveCursor),
            RemoveCursor : constructor(ops.OpRemoveCursor),
            AddAnnotation : constructor(ops.OpAddAnnotation),
            RemoveAnnotation : constructor(ops.OpRemoveAnnotation)
        };
    }

    init();
};
