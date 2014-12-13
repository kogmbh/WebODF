define("webodf/plugins/bella/Bella", [
        "webodf/plugins/bella/Actions",
        "webodf/plugins/bella/CatHerder",
        "webodf/plugins/bella/DocumentValidator",
        "webodf/plugins/bella/Random",
        "webodf/plugins/bella/SimpleStatusReporter",
        "webodf/plugins/bella/WrappedSessionController"
    ],
    function(Actions, CatHerder, DocumentValidator, Random, SimpleStatusReporter, WrappedSessionController) {
    "use strict";
    var instanceCount = 0,
        webodf = window; // WebODF doesn't support AMD yet...

    /**
     * @constructor
     * @implements {core.Destroyable}
     * @param {!Object=} config Configuration options to pass to fuzzer
     * @param {!string=} inputMemberId Member id to re-use when fuzzing. If undefined, a unique id will be
     *      automatically generated
     */
    function Bella(config, inputMemberId) {
        var self = this,
            MAX_UNDO_STATES = 1000,
            seed,
            random,
            memberId,
            currentSessionController,
            actionSources = [],
            scheduledTask,
            documentValidator,
            undoStateCount = 0,
            reporter,
            errorHandler,
            state = {
                startedAt: undefined,
                actions: 0,
                executedOperations: 0,
                seed: undefined
            };

        function countOperations() {
            undoStateCount += 1; // TODO count states NOT operations
            state.executedOperations += 1;
        }

        /**
         * Workaround a TrivialUndoManager bug with cursor positions not being correctly restored
         */
        function saveCurrentCursorPositions() {
            var odtDocument = currentSessionController.getSession().getOdtDocument(),
                members = odtDocument.getMemberIds(),
                ops = [];

            members.forEach(function (memberId) {
                var selection = odtDocument.getCursorSelection(memberId),
                    selectionType = odtDocument.getCursor(memberId).getSelectionType(),
                    op = new webodf.ops.OpMoveCursor();
                op.init({
                    memberid: memberId,
                    position: selection.position,
                    length: selection.length,
                    selectionType: selectionType
                });
                ops.push(op);
            });
            currentSessionController.getSession().enqueue(ops);
        }

        function maintainUndoStackSize() {
            var undoManager;
            if (undoStateCount > MAX_UNDO_STATES) {
                undoManager = currentSessionController.getUndoManager();
                saveCurrentCursorPositions();
                undoManager.setInitialState();
                documentValidator.check();
                undoStateCount = 0;
            }
        }

        function pounceOnComputer() {
            var actionSource = random.getElement(actionSources),
                actionName = random.getElement(Object.keys(actionSource)),
                action = actionSource[actionName];

            state.actions += 1;
            errorHandler.onStartAction(actionName);
            if (config.debug) {
                // Catching & rethrowing tends to make the Chrome debugger useless as the debugger breaks at
                // the rethrow rather than the original exception
                action({random: random});
            } else {
                try {
                    action({random: random});
                } catch (e) {
                    errorHandler.onUnhandledException(e);
                    throw e;
                }
            }

            errorHandler.onEndAction(actionName);

            try {
                maintainUndoStackSize();
            } catch (e) {
                errorHandler.onUnhandledException(e);
                throw e;
            }
            scheduledTask.trigger();
        }

        function stop(callback) {
            if (scheduledTask) {
                webodf.core.Async.destroyAll([scheduledTask.destroy], callback || function () {
                });
                if (reporter) {
                    reporter.destroy();
                    reporter = undefined;
                }
                scheduledTask = undefined;
            }
        }

        /**
         * @param {!Object.<!string, !function():undefined>} newActions
         */
        this.addActionSource = function (newActions) {
            actionSources.push(newActions);
        };

        /**
         * @param {!number} newInterval Time (in milliseconds) between actions
         */
        this.play = function (newInterval) {
            stop();
            state.startedAt = new Date();
            reporter = new SimpleStatusReporter(self);
            scheduledTask = webodf.core.Task.createTimeoutTask(pounceOnComputer, newInterval);
            scheduledTask.triggerImmediate();
        };

        this.stop = stop;
        this.destroy = stop;

        /**
         * @return {undefined}
         */
        function removeFromDocument() {
            var odtDocument;
            stop();
            actionSources.length = 0;
            if (currentSessionController) {
                odtDocument = currentSessionController.getSession().getOdtDocument();
                odtDocument.unsubscribe(webodf.ops.OdtDocument.signalOperationEnd, countOperations);
                odtDocument.unsubscribe(webodf.ops.OdtDocument.signalOperationEnd, documentValidator.check);
                odtDocument.unsubscribe(webodf.ops.OdtDocument.signalOperationStart, errorHandler.onOperationExecuted);
            }
        }

        this.removeFromDocument = removeFromDocument;

        this.getState = function () {
            return state;
        };

        /**
         * @param {!gui.SessionController} newSessionController
         * @return {undefined}
         */
        this.addToDocument = function (newSessionController) {
            if (!config.enabled) {
                return;
            }

            var session,
                wrappedSession,
                addMember = new webodf.ops.OpAddMember(),
                addCursor = new webodf.ops.OpAddCursor();

            removeFromDocument();
            currentSessionController = newSessionController;
            session = newSessionController.getSession();
            wrappedSession = new WrappedSessionController(session, memberId, newSessionController, newSessionController.getConfiguration());
            documentValidator = new DocumentValidator(wrappedSession, config.lengthCheck);
            actionSources.push(new Actions(wrappedSession, random));
            session.getOdtDocument().subscribe(webodf.ops.OdtDocument.signalOperationEnd, countOperations);
            session.getOdtDocument().subscribe(webodf.ops.OdtDocument.signalOperationEnd, documentValidator.check);
            session.getOdtDocument().subscribe(webodf.ops.OdtDocument.signalOperationStart, errorHandler.onOperationExecuted);

            if (!session.getOdtDocument().getCursor(memberId)) {
                // Avatar is from http://pixabay.com/en/cat-animal-feline-kitty-orange-161284/
                addMember.init({
                    memberid: memberId,
                    setProperties: {
                        fullName: runtime.tr("Bella, the playful cat"),
                        color: "BlueViolet",
                        imageUrl: "avatar-bella.png"
                    }
                });
                addCursor.init({memberid: memberId});
                session.enqueue([addMember, addCursor]);
            }

            self.play(config.actionTime);
        };

        function init() {
            config = config || {};
            instanceCount += 1;
            seed = config.seed || Math.floor(Math.random() * 1e10 + (1e10 * instanceCount)).toString();
            state.seed = seed;
            random = new Random(seed);
            memberId = inputMemberId || "bellaTheCat" + random.getInt(0, 1e10);
            errorHandler = new CatHerder(self, config.autoDrive);
            webodf.runtime.enableAlerts = false;
        }

        init();
    }

    function parseQueryString(str) {
        var objURL = {};
        str.replace(
            new RegExp("([^?=&]+)(=([^&]*))?", "g"),
            function ($0, $1, $2, $3) {
                objURL[ $1 ] = $3;
            }
        );
        return objURL;
    }

    Bella.parseConfig = function (search) {
        var queryParams = parseQueryString(search);
        return {
            seed: queryParams["bella.seed"] || undefined,
            autoDrive: queryParams["bella.mode"] === "exploration",
            debug: queryParams["bella.debug"] === "true",
            enabled: queryParams["bella.enabled"] !== "false",
            actionTime: parseInt(queryParams["bella.actionTime"], 10) || 50, // Sleep time between actions in ms
            lengthCheck: (queryParams["bella.lengthCheck"] && parseInt(queryParams["bella.lengthCheck"], 10)) || 10
        };
    };

    return Bella;
});