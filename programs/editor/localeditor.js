/**
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

    runtime.currentDirectory = function () {
        return "../../webodf/lib";
    };
    runtime.libraryPaths = function () {
        return [ runtime.currentDirectory() ];
    };

    var editorInstance = null,
        booting = false,
        localMemberId = "localuser",
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
                editorInstance.openDocument(loadedFilename, localMemberId, startEditing);
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
        var editorOptions = {};
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
        editorOptions = editorOptions || {};
        editorOptions.loadCallback = load;
        editorOptions.saveCallback = save;

        if (args.docUrl === undefined) {
            args.docUrl = guessDocUrl();
        }
        runtime.assert(args.docUrl, "docUrl needs to be specified");
        runtime.assert(editorInstance === null, "cannot boot with instanciated editor");

        require({ }, [
            "webodf/editor/Translator",
            "webodf/editor/Editor"],
            function (Translator, Editor) {
                var locale = navigator.language || "en-US",
                    t = new Translator(locale, function (editorTranslator) {
                        runtime.setTranslator(editorTranslator.translate);
                        editorInstance = new Editor(editorOptions);
                        editorInstance.openDocument(args.docUrl, localMemberId, startEditing);
                    });
            }
        );
    }

    // exposed API
    return { boot: boot };
}());

