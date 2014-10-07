/**
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global runtime, ops, odf*/

/**
 * An editing session and what belongs to it.
 * @constructor
 * @implements {core.Destroyable}
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
            var result = false;
            odtDocument.emit(ops.OdtDocument.signalOperationStart, op);
            odtDocument.pauseSignalEmitting();
            try {
                if (op.execute(odtDocument)) {
                    odtDocument.emit(ops.OdtDocument.signalOperationEnd, op);
                    result = true;
                }
            } catch(/**@type{!Error}*/e) {
                // Failure to resume will cause OdtDocument to never inform subscribers of emitted
                // signals, so it's important to always resume signal emitting, even if an exception is
                // thrown.
                odtDocument.resumeSignalEmitting();
                throw e;
            }
            odtDocument.resumeSignalEmitting();
            return result;
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
    this.close = function (callback) {
        operationRouter.close(function (err) {
            if (err) {
                callback(err);
            } else {
                odtDocument.close(callback);
            }
        });
    };

    /**
     * @param {!function(!Error=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
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
