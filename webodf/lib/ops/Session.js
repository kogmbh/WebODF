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

/*global runtime, ops, odf*/

runtime.loadClass("ops.TrivialOperationRouter");
runtime.loadClass("ops.OperationFactory");
runtime.loadClass("ops.OdtDocument");

/**
 * An editing session and what belongs to it.
 * @constructor
 * @param {!odf.OdfCanvas} odfCanvas
 */
ops.Session = function Session(odfCanvas) {
    "use strict";
    var self = this,
        /**@type{!ops.OperationFactory}*/
        operationFactory = new ops.OperationFactory(),
        /**@type{!ops.OdtDocument}*/
        odtDocument = new ops.OdtDocument(odfCanvas),
        /**@type{?ops.OperationRouter}*/
        operationRouter = null;

    /**
     * Forward the router's batch start signal on to the document
     * @param {*} args
     * @return {undefined}
     */
    function forwardBatchStart(args) {
        odtDocument.emit(ops.OdtDocument.signalProcessingBatchStart, args);
    }

    /**
     * Forward the router's batch end signal on to the document
     * @param {*} args
     * @return {undefined}
     */
    function forwardBatchEnd(args) {
        odtDocument.emit(ops.OdtDocument.signalProcessingBatchEnd, args);
    }

    /**
     * @param {!ops.OperationFactory} opFactory
     */
    this.setOperationFactory = function (opFactory) {
        operationFactory = opFactory;
        if (operationRouter) {
            operationRouter.setOperationFactory(operationFactory);
        }
    };

    /**
     * @param {!ops.OperationRouter} opRouter
     * @return {undefined}
     */
    this.setOperationRouter = function (opRouter) {
        if (operationRouter) {
            operationRouter.unsubscribe(ops.OperationRouter.signalProcessingBatchStart, forwardBatchStart);
            operationRouter.unsubscribe(ops.OperationRouter.signalProcessingBatchEnd, forwardBatchEnd);
        }
        operationRouter = opRouter;
        operationRouter.subscribe(ops.OperationRouter.signalProcessingBatchStart, forwardBatchStart);
        operationRouter.subscribe(ops.OperationRouter.signalProcessingBatchEnd, forwardBatchEnd);
        opRouter.setPlaybackFunction(function (op) {
            odtDocument.emit(ops.OdtDocument.signalOperationStart, op);
            if (op.execute(odtDocument)) {
                odtDocument.emit(ops.OdtDocument.signalOperationEnd, op);
                return true;
            }
            return false;
        });
        opRouter.setOperationFactory(operationFactory);
    };

    /**
     * @return {!ops.OperationFactory}
     */
    this.getOperationFactory = function () {
        return operationFactory;
    };

    /**
     * @return {!ops.OdtDocument}
     */
    this.getOdtDocument = function () {
        return odtDocument;
    };

    /**
     * Controller sends operations to this method.
     *
     * @param {!Array.<!ops.Operation>} ops
     * @return {undefined}
     */
    this.enqueue = function (ops) {
        operationRouter.push(ops);
    };

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.close = function(callback) {
        operationRouter.close(function(err) {
            if (err) {
                callback(err);
            } else {
                odtDocument.close(callback);
            }
        });
    };

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function(callback) {
        /*
        operationRouter.destroy(function(err) {
            if (err) {
                callback(err);
            } else {
                memberModel.destroy(function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        */
                        odtDocument.destroy(callback);
                        /*
                    }
                });
            }
        });
        */
    };

    /**
     * @return {undefined}
     */
    function init() {
        self.setOperationRouter(new ops.TrivialOperationRouter());
    }
    init();
};

// vim:expandtab
