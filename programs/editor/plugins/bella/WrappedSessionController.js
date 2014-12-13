define("webodf/plugins/bella/WrappedSessionController", function() {
    "use strict";
    var webodf = window;

    function WrappedSessionController(session, inputMemberId, sessionController, args) {
        var odtDocument = session.getOdtDocument(),
            constraints = sessionController.getSessionConstraints(),
            sessionContext = new webodf.gui.SessionContext(session, inputMemberId),
            objectNameGenerator = new webodf.odf.ObjectNameGenerator(odtDocument.getOdfCanvas().odfContainer(), inputMemberId),
            directFormattingController = new webodf.gui.DirectFormattingController(session, constraints, sessionContext, inputMemberId, objectNameGenerator, args.directTextStylingEnabled,  args.directParagraphStylingEnabled),
            createCursorStyleOp = /**@type {function (!number, !number, !boolean):ops.Operation}*/ (directFormattingController.createCursorStyleOp),
            createParagraphStyleOps = /**@type {function (!number):!Array.<!ops.Operation>}*/ (directFormattingController.createParagraphStyleOps),
            textController = new webodf.gui.TextController(session, constraints, sessionContext, inputMemberId, createCursorStyleOp, createParagraphStyleOps),
            selectionController = new webodf.gui.SelectionController(session, inputMemberId),
            mimeDataExporter = new webodf.gui.MimeDataExporter(),
            pasteHandler = new webodf.gui.PasteController(session, constraints, sessionContext , inputMemberId);

        this.undo = sessionController.undo;
        this.redo = sessionController.redo;
        this.getSession = function() { return session; };
        this.getInputMemberId = function() { return inputMemberId; };
        this.getTextController = function() { return textController; };
        this.getSelectionController = function() { return selectionController; };
        this.getDirectFormattingController = function() { return directFormattingController; };
        this.getEventManager = sessionController.getEventManager;

        this.simulateCopy = function(range) {
            var selectedData = "",
                dataTransfer = { setData: function(ignored, text) { selectedData = text; } };

            mimeDataExporter.exportRangeToDataTransfer(dataTransfer, range);
            return selectedData;
        };

        this.simulatePaste = function(plainText) {
            pasteHandler.paste(plainText);
        };
    }

    return WrappedSessionController;
});
