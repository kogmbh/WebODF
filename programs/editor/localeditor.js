/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*
 * bootstrap the editor
 * this file is meant to be included from HTML and used
 * by users who do not want to know much about the inner
 * complexity.
 * so we need to make it really easy.
 *
 * including this file will result in the namespace/object
 * "webodfEditor" to be available from the HTML side.
 * calling webodfEditor.boot() will start the editor.
 * the method can also take some parameters to specify
 * behaviour. see documentation of that method.
 */

/*global runtime, require, document, alert, window, FileReader, Uint8Array */

// define the namespace/object we want to provide
// this is the first line of API, the user gets.
var webodfEditor = (function () {
    "use strict";

    var editorInstance = null,
        booting = false,
        loadedFilename;

    /**
     * @return {undefined}
     */
     function startEditing() {
         editorInstance.startEditing();
     }

    /**
     * extract document url from the url-fragment
     *
     * @return {?string}
     */
    function guessDocUrl() {
        var pos, docUrl = String(document.location);
        // If the URL has a fragment (#...), try to load the file it represents
        pos = docUrl.indexOf('#');
        if (pos !== -1) {
            docUrl = docUrl.substr(pos + 1);
        } else {
            docUrl = "welcome.odt";
        }
        return docUrl || null;
    }

    function fileSelectHandler(evt) {
        var file, files, reader;
        files = (evt.target && evt.target.files) ||
            (evt.dataTransfer && evt.dataTransfer.files);
        function onLoadEnd() {
            if (reader.readyState === 2) {
                runtime.registerFile(file.name, reader.result);
                loadedFilename = file.name;
                editorInstance.openDocument(loadedFilename, startEditing);
            }
        }
        if (files && files.length === 1) {
            editorInstance.endEditing();
            editorInstance.closeDocument(function() {
                file = files[0];
                reader = new FileReader();
                reader.onloadend = onLoadEnd;
                reader.readAsArrayBuffer(file);
            });
        } else {
            alert("File could not be opened in this browser.");
        }
    }

    function enhanceRuntime() {
        var openedFiles = {},
            read = runtime.read,
            getFileSize = runtime.getFileSize;
        runtime.read = function (path, offset, length, callback) {
            var array;
            if (openedFiles.hasOwnProperty(path)) {
                array = new Uint8Array(openedFiles[path], offset, length);
                callback(undefined, array);
            } else {
                return read(path, offset, length, callback);
            }
        };
        runtime.getFileSize = function (path, callback) {
            if (openedFiles.hasOwnProperty(path)) {
                return callback(openedFiles[path].byteLength);
            } else {
                return getFileSize(path, callback);
            }
        };
        runtime.registerFile = function (path, data) {
            openedFiles[path] = data;
        };
    }

    function createFileLoadForm() {
        var form = document.createElement("form"),
            input = document.createElement("input");

        function internalHandler(evt) {
            if (input.value !== "") {
                fileSelectHandler(evt);
            }
            // reset to "", so selecting the same file next time still trigger the change handler
            input.value = "";
        }
        form.appendChild(input);
        form.style.display = "none";
        input.id = "fileloader";
        input.setAttribute("type", "file");
        input.addEventListener("change", internalHandler, false);
        document.body.appendChild(form);
    }

    function load() {
        var form = document.getElementById("fileloader");
        if (!form) {
            enhanceRuntime();
            createFileLoadForm();
            form = document.getElementById("fileloader");
        }
        form.click();
    }

    function save() {
        editorInstance.saveDocument(loadedFilename);
    }

    /**
     * make a guess about the document (# in URL)
     *
     * @param {?Object} args
     *
     * args:
     *
     * docUrl:        if given it is used as the url to the document to load
     *
     */
    function boot(args) {
        var editorOptions = {
            loadCallback: load,
            saveCallback: save,
            allFeaturesEnabled: true
        };
        runtime.assert(!booting, "editor creation already in progress");

        args = args || {};

        if (args.saveCallback) {
            editorOptions.saveCallback = args.saveCallback;
        }
        // TODO:
//             editorOptions.registerCallbackForShutdown = function (callback) {
//                 window.onunload = callback;
//             };

        // start the editor
        booting = true;

        if (args.docUrl === undefined) {
            args.docUrl = guessDocUrl();
        }
        if (args.reviewModeEnabled === true) {
            editorOptions.reviewModeEnabled = true;
            editorOptions.directParagraphStylingEnabled = false;
            editorOptions.imageEditingEnabled = false;
            editorOptions.paragraphStyleSelectingEnabled = false;
            editorOptions.paragraphStyleEditingEnabled = false;
        } else {
            editorOptions.reviewModeEnabled = false;
        }
        runtime.assert(args.docUrl, "docUrl needs to be specified");
        runtime.assert(editorInstance === null, "cannot boot with instanciated editor");

        require({ }, [
            "webodf/editor/Translator",
            "webodf/editor/Editor"],
            function (Translator, Editor) {
                var locale = navigator.language || "en-US",
                    editorBase = dojo.config && dojo.config.paths && dojo.config.paths["webodf/editor"],
                    translationsDir = '/translations',
                    t;

                    runtime.assert(editorBase, "webodf/editor path not defined in dojoConfig");

                    t = new Translator(editorBase + translationsDir, locale, function (editorTranslator) {
                        runtime.setTranslator(editorTranslator.translate);
                        editorInstance = new Editor("mainContainer", editorOptions);
                        editorInstance.openDocument(args.docUrl, startEditing);
                    });
            }
        );
    }

    // exposed API
    return { boot: boot };
}());

