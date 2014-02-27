define("webodf/plugins/bella/BellaControl", [
        "webodf/plugins/bella/Bella"
    ],
    function(Bella) {
    "use strict";

    function BellaControl(onInitialise) {
        var bella;

        this.setEditorSession = function(editorSession) {
            if (bella) {
                bella.destroy();
                bella = undefined;
            }
            if (editorSession) {
                bella = new Bella(Bella.parseConfig(window.location.search));
                bella.addToDocument(editorSession.sessionController);
                editorSession.sessionView.showCaretAvatars();
                editorSession.sessionView.showEditInfoMarkers();
            }
        };
    }

    return BellaControl;
});