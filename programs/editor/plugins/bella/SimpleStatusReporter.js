define("webodf/plugins/bella/SimpleStatusReporter", function() {
    "use strict";
    var webodf = window; // WebODF doesn't support AMD yet...

    function SimpleStatusReporter(bellaInstance) {
        var container;

        function updateState() {
            var state = bellaInstance.getState();
            container.textContent = JSON.stringify(state, null, "\t");
        }

        this.destroy = function () {
            if (container) {
                container.parentNode.removeChild(container);
                container = null;
            }
        };

        function init() {
            var doc = webodf.runtime.getWindow().document;
            container = doc.createElement("pre");
            container.style.position = "fixed";
            container.style.bottom = "0";
            container.style.right = "0";
            doc.body.appendChild(container);
            setInterval(updateState, 100);
        }

        init();
    }

    return SimpleStatusReporter;
});