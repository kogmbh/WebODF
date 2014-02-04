/**
 * Copyright (C) 2013 KO GmbH <jos.van.den.oever@kogmbh.com>
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
/*global runtime, process, require, console*/

function Main(cmakeListPath) {
    "use strict";
    var pathModule = require("path"),
        fs = require("fs"),
        buildDir = pathModule.dirname(cmakeListPath),
        /**
         * List of files that are 100% typed. When working on making WebODF more
         * typed, choose a file from CMakeLists.txt that is listed as only
         * depending on typed files and add it to this list. The run the
         * typecheck-target to find where type annotations are needed.
         */
        typedFiles = [
            "core/Async.js",
            "core/Base64.js",
            "core/ByteArray.js",
            "core/ByteArrayWriter.js",
            "core/CSSUnits.js",
            "core/Cursor.js",
            "core/DomUtils.js",
            "core/EventNotifier.js",
            "core/LoopWatchDog.js",
            "core/PositionFilter.js",
            "core/PositionFilterChain.js",
            "core/PositionIterator.js",
            "core/RawInflate.js",
            "core/ScheduledTask.js",
            "core/StepIterator.js",
            "core/UnitTester.js",
            "core/Utils.js",
            "core/Zip.js",
            "gui/AnnotationViewManager.js",
            "gui/Avatar.js",
            "gui/MimeDataExporter.js",
            "gui/Clipboard.js",
            "gui/EditInfoHandle.js",
            "gui/HyperlinkClickHandler.js",
            "gui/KeyboardHandler.js",
            "gui/SelectionMover.js",
            "gui/StyleSummary.js",
            "odf/FontLoader.js",
            "odf/Formatting.js",
            "odf/Namespaces.js",
            "odf/ObjectNameGenerator.js",
            "odf/OdfCanvas.js",
            "odf/OdfContainer.js",
            "odf/OdfNodeFilter.js",
            "odf/OdfUtils.js",
            "odf/Style2CSS.js",
            "odf/StyleInfo.js",
            "odf/TextSerializer.js",
            "odf/TextStyleApplicator.js",
            "ops/Server.js",
            "ops/TextPositionFilter.js",
            "xmldom/LSSerializer.js",
            "xmldom/LSSerializerFilter.js",
            "xmldom/XPath.js"
        ],
        jslintconfig;


    function className(path) {
        return path.substr(0, path.length - 3).replace(pathModule.sep, '.');
    }

    function add(occs, key, value) {
        var a = occs[key] || [];
        occs[key] = a;
        if (a.indexOf(value) === -1) {
            a.push(value);
        }
    }

    function addLoop(list, circs, l) {
        var i;
        for (i = 1; i < l; i += 1) {
            add(circs, list[i - 1], list[i]);
        }
        add(circs, list[l - 1], list[0]);
    }

    /**
     * Function to help find loops/circles in the dependency graph.
     */
    function findLoops(v, occs, list, circs, pos) {
        var i, name, j, l = v.length;
        for (i = 0; i < l; i += 1) {
            name = v[i];
            j = list.lastIndexOf(name, pos);
            if (j === 0) {
                addLoop(list, circs, pos);
            } else if (j === -1 && occs.hasOwnProperty(name)) {
                list[pos] = name;
                findLoops(occs[name], occs, list, circs, pos + 1);
            }
        }
    }

    /**
     * Find loops/circles in the dependency graph.
     */
    function findCircles(occs) {
        var name,
            list = [],
            circs = {};
        for (name in occs) {
            if (occs.hasOwnProperty(name)) {
                list[0] = name;
                findLoops(occs[name], occs, list, circs, 1);
            }
        }
        return circs;
    }

    /**
     * Scan javascript source for the given symbols.
     * @param {string} source
     * @param {!Array.<string>} symbols
     * @param {!Object.<string,string> files
     * @param {!Object.<string,!Array.<string,>>
     */
    function findOccurances(source, symbols, files, occs) {
        symbols = symbols.join("|").split(".").join("\\.");
        var classname,
            content,
            regex = new RegExp("\\b(" + symbols + ")\\b");
        for (classname in files) {
            if (files.hasOwnProperty(classname)) {
                content = files[classname];
                if (source !== classname && regex.test(content)) {
                    add(occs, classname, source);
                }
            }
        }
    }

    /**
     * Determine if the javascript source defines an ops.Operation.
     */
    function isOperation(fileContent) {
        return (/ \* @implements ops\.Operation\b/).test(fileContent);
    }

    /**
     * Retrieve all the classes deriving from ops.Operation..
     */
    function getOperations(files) {
        return Object.keys(files).filter(function (key) {
            return isOperation(files[key]);
        });
    }

    /**
     * Print a .dot dependency graph.
     */
    function print(occs, out, files) {
        var i, j, m, n, done = {}, d;
        out.write("digraph webodf {\n");
        for (i in occs) {
            if (occs.hasOwnProperty(i)) {
                m = occs[i];
                for (j = 0; j < m.length; j += 1) {
                    i = isOperation(files[i]) ? "{Operation}" : i;
                    n = m[j];
                    if (occs[n].length) {
                        n = isOperation(files[n]) ? "{Operation}" : n;
                        if (!done.hasOwnProperty(i) || !done[i].hasOwnProperty(n)) {
                            out.write('"' + i + '" -> "' + n + '";\n');
                            d = done[i] = done[i] || {};
                            d[n] = 1;
                        }
                    }
                }
            }
        }
        out.write("}\n");
    }

    function mergeOperations(files, occs) {
        var ops = getOperations(files), i, j, v;
        for (i = 0; i < ops.length; i += 1) {
            v = occs[i];
            for (j = 0; j < v.length; j += 1) {
                add(occs, "{Operations}", v[j]);
            }
            delete occs[i];
        }
    }

    /**
     * Analyze the given files and create a graphviz dependency graph.
     */
    this.analyze = function (files) {
        var list = Object.keys(files),
            occs = {},
            classname,
            i;
        for (i = 0; i < list.length; i += 1) {
            occs[list[i]] = [];
        }
        for (i = 0; i < list.length; i += 1) {
            classname = list[i];
            findOccurances(classname, [classname], files, occs);
        }
        mergeOperations(files, occs);
        occs = findCircles(occs);
        print(occs, process.stdout, files);
    };

    /**
     * @param {string} path 
     * @param {string} content
     * @return {!Array.<string>}
     */
    function getTopLevelDefines(path, content) {
        var names = path.split(pathModule.sep),
            re,
            defines = {},
            match,
            m;
        re = new RegExp("^\\s*(" + names[1] + "\\.[\\w.]+) = ", "gm");
        if (names.length !== 3) {
            throw path + " Only two levels are supported.";
        }
        match = re.exec(content);
        while (match !== null) {
            m = match[1];
            defines[m] = 1;
            match = re.exec(content);
        }
        if (Object.keys(defines).length === 0) {
            throw "No defines found in " + path;
        }
        return Object.keys(defines);
    }

    /**
     * Save data to a file if the contents is different then it currently is.
     * If the file is written anew, saveCallback is called.
     */
    function saveIfDifferent(path, content, saveCallback) {
        fs.readFile(path, "utf8", function (err, data) {
            if (err || data !== content) {
                if (!err && data.length !== content.length) {
                    console.log("Different file length for " + path
                        + ": " + data.length + " " + content.length);
                }
                fs.writeFile(path, content, function (err2) {
                    if (err2) {
                        throw err2;
                    }
                    if (saveCallback) {
                        saveCallback();
                    }
                });
            }
        });
    }

    /**
     * @param {!Array.<string>} list
     * @param {!Object.<string,!Array.<string>>} deps
     * @param {!Object.<string,boolean>} defined
     * @return {!Array.<string>} list
     */
    function createOrderedList(list, deps, defined) {
        var sorted = [], i, p, l = list.length, depsPresent, missing,
            lastLength = -1;
        function isUndefined(dep) {
            return !defined.hasOwnProperty(dep);
        }
        while (sorted.length < l && sorted.length !== lastLength) {
            lastLength = sorted.length;
            for (i = 0; i < l; i += 1) {
                p = pathModule.normalize(list[i]);
                if (!defined.hasOwnProperty(p)) {
                    missing = deps[p].filter(isUndefined);
                    depsPresent = missing.length === 0;
                    if (depsPresent) {
                        sorted.push(p);
                        defined[p] = true;
                    } else if (missing.length === 1 && deps[missing[0]].indexOf(p) !== -1) {
                        // resolve simple circular problem
                        sorted.push(p);
                        defined[p] = true;
                        sorted.push(missing[0]);
                        defined[missing[0]] = true;
                        console.log("Circular dependency: "
                            + missing + " <> " + p);
                    }
                }
            }
        }
        if (sorted.length === lastLength) {
            console.log("Unresolvable circular dependency. Check relations between ");
            for (i = 0; i < l; i += 1) {
                p = pathModule.normalize(list[i]);
                if (!defined.hasOwnProperty(p)) {
                    console.log(p);
                }
            }
            process.exit(1);
        }
        return sorted;
    }

    function createCMakeLists(typed, almostTyped, remaining) {
        var path = cmakeListPath, content;
        content = "set(TYPEDLIBJSFILES\n" +
                "    ${CMAKE_CURRENT_BINARY_DIR}/webodf/webodfversion.js\n" +
                "    lib/runtime.js\n    lib/" +
                typed.join("\n    lib/") + "\n)\n" +
                "set(UNTYPEDLIBJSFILES" +
                "\n# These files depend only on files that are 100% typed." +
                "\n    lib/" +
                almostTyped.join("\n    lib/") +
                "\n# These files depend on files that are not 100% typed." +
                "\n    lib/" +
                remaining.join("\n    lib/") + "\n)";
        saveIfDifferent(path, content, function () {
            console.log("JS file dependencies were updated.");
            process.exit(1);
        });
    }

    /**
     * Replace the platform-specific file separator with forward slash '/'
     * @param {!string} path
     * @return {!string}
     */
    function deNormalizePath(path) {
        return path.replace(pathModule.sep, "/");
    }

    function updateCMakeLists(deps) {
        var lib = deps.lib,
            defined = {},
            sortedTyped = createOrderedList(typedFiles, lib, defined),
            almostTyped,
            definedCopy,
            remaining;
        definedCopy = {};
        Object.keys(defined).forEach(function (key) {
            definedCopy[key] = true;
        });
        almostTyped = Object.keys(lib).filter(function (key) {
            return !defined.hasOwnProperty(key) &&
                lib[key].every(function (dep) {
                    return defined.hasOwnProperty(dep);
                });
        }).sort();
        almostTyped.forEach(function (key) {
            defined[key] = true;
        });
        remaining = Object.keys(lib).filter(function (key) {
            return !defined.hasOwnProperty(key);
        });
        remaining = createOrderedList(remaining, lib, defined);
        createCMakeLists(
            sortedTyped.map(deNormalizePath),
            almostTyped.map(deNormalizePath),
            remaining.map(deNormalizePath)
        );
    }

    /**
     * Deterministic serialization of manifest.
     * JSON.stringify does not order objects by key.
     */
    function serializeManifest(manifest) {
        var out = "{\n",
            list = Object.keys(manifest).sort(),
            a,
            i,
            j;
        for (j = 0; j < list.length; j += 1) {
            a = manifest[list[j]];
            out += '    "' + deNormalizePath(list[j]) + '": [\n';
            for (i = 0; i < a.length; i += 1) {
                out += '        "' + deNormalizePath(a[i]);
                out += i === a.length - 1 ? '"\n' : '",\n';
            }
            out += j === list.length - 1 ? '    ]\n' : '    ],\n';
        }
        out += "}";
        return out;
    }

    /**
     * @param {!Object.<string,string>}
     * @param {!Array.<string>}
     * @return {!Object.<string,!Array.<string>>}
     */
    this.createManifestsAndCMakeLists = function (files, dirs) {
        var list = Object.keys(files),
            classes = {},
            paths = {},
            defines = {},
            occs = {},
            deps = {},
            classname,
            d,
            i,
            j;
        list.sort();
        // make map with classname as key and file content as value
        list.forEach(function (path) {
            var k, dir, name;
            for (k = 0; k < dirs.length; k += 1) {
                dir = dirs[k];
                if (path.indexOf(dir) === 0) {
                    name = className(path.substr(dir.length));
                    if (classes.hasOwnProperty(name)) {
                        throw name + " occurs more than once.";
                    }
                    classes[name] = files[path];
                    defines[name] = getTopLevelDefines(path, files[path]);
                    paths[name] = path;
                }
            }
        });
        list = Object.keys(classes);
        for (i = 0; i < list.length; i += 1) {
            occs[list[i]] = [];
        }
        for (i = 0; i < list.length; i += 1) {
            classname = list[i];
            d = defines[classname];
            findOccurances(classname, d, classes, occs);
        }
        function prefixDir(cn) {
            var p = paths[cn],
                n = p.indexOf(pathModule.sep);
            return p.substr(n + 1);
        }
        for (classname in occs) {
            if (occs.hasOwnProperty(classname)) {
                d = paths[classname];
                i = d.indexOf(pathModule.sep);
                j = d.substr(i + 1);
                i = d.substr(0, i);
                d = deps[i] = deps[i] || {};
                d[j] = occs[classname].map(prefixDir).sort();
            }
        }
        for (i = 0; i < dirs.length; i += 1) {
            d = dirs[i];
            j = deps[d.split(pathModule.sep)[0]];
            saveIfDifferent(d + "manifest.json", serializeManifest(j));
        }
        updateCMakeLists(deps);
    };

    /**
     * Load content of a directory recursively.
     * Directories are listed as Objects and files are read as text and stored
     * as strings.
     * The filter allows loading only a subset of files based on file or
     * directory name.
     * @param {!Array.<string>} dirs
     * @param {function(string,boolean):boolean} filter
     * @param {function(!Object}:undefined} callback
     * @return {undefined}
     */
    this.readFiles = function (dirs, filter, callback) {
        var contents = {},
            read;
        function readMore() {
            var done = true,
                p,
                content;
            for (p in contents) {
                if (contents.hasOwnProperty(p)) {
                    content = contents[p];
                    if (content === undefined) {
                        contents[p] = null; // null means it's loading
                        read(p);
                    }
                    if (content === null || content === undefined) {
                        done = false;
                    }
                }
            }
            if (done) {
                callback(contents);
            }
        }
        function readFile(filepath) {
            fs.readFile(filepath, "utf8", function (err, data) {
                if (err) {
                    throw err;
                }
                contents[filepath] = data;
                readMore();
            });
        }
        function readDirectory(dirpath) {
            fs.readdir(dirpath, function (err, files) {
                if (err) {
                    throw err;
                }
                var i;
                files.sort();
                for (i = 0; i < files.length; i += 1) {
                    contents[pathModule.join(dirpath, files[i])] = undefined;
                }
                contents[dirpath] = files;
                readMore();
            });
        }
        read = function (p) {
            fs.stat(p, function (err, stats) {
                if (err) {
                    throw err;
                }
                var ok = filter(p, stats.isFile());
                if (ok && stats.isFile()) {
                    readFile(p);
                } else if (ok && stats.isDirectory()) {
                    readDirectory(p);
                } else {
                    contents[p] = -1;
                    readMore();
                }
            });
        };
        dirs.forEach(function (dir) {
            contents[dir] = undefined;
        });
        readMore();
    };

    jslintconfig = {
        ass:        false, // if assignment expressions should be allowed
        bitwise:    false, // if bitwise operators should be allowed
        browser:    false, // if the standard browser globals should be predefined
        closure:    true,  // if Google Closure idioms should be tolerated
        'continue': false, // if the continuation statement should be tolerated
        debug:      false, // if debugger statements should be allowed
        defined:    false, // if already defined variables are allowed
        devel:      false, // if logging should be allowed (console, alert, etc.)
        emptyblock: false, // if empty blocks should be allowed
        eqeq:       false, // if == should be allowed
        evil:       false, // if eval should be allowed
        forin:      false, // if for in statements need not filter
        indent:     4, //the indentation factor
        maxerr:     20, //the maximum number of errors to allow
        //maxlen:   300  the maximum length of a source line
        newcap:     false, // if constructor names capitalization is ignored
        node:       false, // if Node.js globals should be predefined
        nomen:      false, // if names may have dangling _
        passfail:   false, // if the scan should stop on first error
        plusplus:   false, // if increment/decrement should be allowed
        properties: false, // if all property names must be declared with /*properties*/
        regexp:     false, // if the . should be allowed in regexp literals
        rhino:      false, // if the Rhino environment globals should be predefined
        unparam:    false, // if unused parameters should be tolerated
        sloppy:     false, // if the 'use strict'; pragma is optional
        stupid:     true,  // if really stupid practices are tolerated
        sub:        false, // if all forms of subscript notation are tolerated
        todo:       true,  // if TODO comments are tolerated
        unvar:      false, // if unused variables should be tolerated
        vars:       false, // if multiple var statements per function should be allowed
        white:      true   // if sloppy whitespace is tolerated
    };

    function mkdir(path) {
        if (fs.existsSync(path)) {
            return;
        }
        var parent = pathModule.dirname(path);
        mkdir(parent);
        fs.mkdirSync(path);
    }

    function runJSLint(jslint, path, contents) {
        var lpath = pathModule.join(buildDir, "jslint", path);
        fs.readFile(lpath, "utf8", function (err, data) {
            if (data === contents) {
                return;
            }
            var result, i, errors;
            result = jslint(contents, jslintconfig);
            if (result) {
                mkdir(pathModule.dirname(lpath));
                fs.writeFile(lpath, contents);
            } else {
                errors = jslint.errors;
                for (i = 0; i < errors.length && errors[i]; i += 1) {
                    err = errors[i];
                    console.log(path + ":" + err.line + ":" + err.character +
                          ": error: " + err.reason);
                }
                process.exit(1);
            }
        });
    }

    this.runJSLint = function (contents) {
        var core = {},
            jslint,
            path;
        // load JSLint
        /*jslint evil: true*/
        eval(contents[pathModule.normalize("lib/core/JSLint.js")]);
        /*jslint evil: false*/
        jslint = new core.JSLint().JSLINT;
        for (path in contents) {
            if (contents.hasOwnProperty(path)
                    && typeof contents[path] === "string") {
                runJSLint(jslint, path, contents[path]);
            }
        }
    };
}

function main(f) {
    "use strict";
    var pathModule = require("path");
    // recursively read all the files in the lib and tests directories
    f.readFiles(["lib", "tests"], function (name, isfile) {
        // only read directories and js files
        return !isfile || name.indexOf(".js") === name.length - 3;
    }, function (contents) {
        var files = {};
        f.runJSLint(contents);
        // remove files that should not go in the manifest.json files
        delete contents[pathModule.normalize("lib/runtime.js")];
        delete contents[pathModule.normalize("lib/core/JSLint.js")];
        delete contents[pathModule.normalize("tests/tests.js")];
        Object.keys(contents).forEach(function (name) {
            if (typeof contents[name] === "string") {
                files[name] = contents[name];
            }
        });
        f.createManifestsAndCMakeLists(files, ["lib" + pathModule.sep, "tests" + pathModule.sep]);
    });
}

main(new Main(process.argv[3]));
