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

/*global runtime, process, require, console*/

var exitCode = 0;

function Main(cmakeListPath) {
    "use strict";
    var pathModule = require("path"),
        fs = require("fs"),
        buildDir = pathModule.dirname(cmakeListPath),
        // these files are not compiled into webodf.js
        ignoredFiles = [
            "externs/JSZip.js",
            "odf/CommandLineTools.js",
            "xmldom/RelaxNG.js",
            "xmldom/RelaxNG2.js",
            "xmldom/RelaxNGParser.js"
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

    function getStyle(path, content, colors) {
        var constructor = content.indexOf("@constructor") !== -1,
            iface = content.indexOf("@interface") !== -1,
            style = (iface && !constructor) ? "\"\"" : "filled",
            group = path.split("/"),
            color;
        group = group.length > 1 ? group[0] : "";
        color = colors.indexOf(group);
        if (color === -1) {
            color = colors.length;
            colors.push(group);
        }
        return " [color=" + (color + 1) + ", style=" + style + "];\n";
    }

    /**
     * Create a dot file.
     * This function returns a string that can be saved to a .dot file.
     */
    function createDotFile(occs, files) {
        var i, j, m, n, done = {}, out, content, colors = [];
        out = "# This is a graphviz file.\n";
        out += "# dot -Tsvg dependencies.dot > dependencies.svg\n";
        out += "# dot -Tpng dependencies.dot > dependencies.png\n";
        out += "digraph webodf {\n";
        out += "node [colorscheme=pastel19]\n"; // pastel19, set312 or accent8
        for (i in occs) {
            if (occs.hasOwnProperty(i)) {
                m = occs[i];
                for (j = 0; j < m.length; j += 1) {
                    content = files[pathModule.join("lib", i)];
                    i = isOperation(content) ? "{Operation}" : i;
                    if (!done[i]) {
                        done[i] = {};
                        out += '"' + i + '"' + getStyle(i, content, colors);
                    }
                    n = m[j];
                    content = files[pathModule.join("lib", n)];
                    // omit leaf nodes unless they are interfaces
                    if (occs[n].length || content.indexOf("@interface") !== -1) {
                        n = isOperation(content) ? "{Operation}" : n;
                        if (!done[i].hasOwnProperty(n)) {
                            if (!done[n]) {
                                done[n] = {};
                                out += '"' + n + '"' + getStyle(n, content, colors);
                            }
                            out += '"' + i + '" -> "' + n + '";\n';
                            done[i][n] = 1;
                        }
                    }
                }
            }
        }
        out += "}\n";
        return out;
    }

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
        var sorted = [],
            stack = {};
        /**
         * @param {string} n
         * @param {string} parent
         */
        function visit(n, parent) {
            if (defined[n]) {
                return;
            }
            if (stack[n]) {
                throw "Circular dependency caused by " + n + " and " + parent;
            }
            stack[n] = true;
            var d = deps[n], i, l = d.length;
            for (i = 0; i < l; i += 1) {
                visit(d[i], n);
            }
            stack[n] = false;
            defined[n] = true;
            sorted.push(n);
        }
        list.forEach(visit);
        return sorted;
    }

    function createCMakeLists(typed) {
        var path = cmakeListPath, content;
        content = "set(LIBJSFILES\n" +
                // include webodfversion.js before runtime.js, latter uses var from the first
                "    ${CMAKE_BINARY_DIR}/webodf/webodfversion.js\n" +
                "    lib/runtime.js\n    lib/" +
                typed.join("\n    lib/") + "\n)\n";
        saveIfDifferent(path, content, function () {
            console.log("JS file dependencies were updated.");
            exitCode = 1;
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

    /**
     * Returns true if the supplied path is compiled into webodf.js
     * @param {!string} path
     * @return {!boolean}
     */
    function isCompiledJs(path) {
        return ignoredFiles.indexOf(deNormalizePath(path)) === -1;
    }

    function updateCMakeLists(deps) {
        var lib = deps.lib,
            sortedTyped,
            compiledFiles;
        compiledFiles = Object.keys(lib).sort();
        sortedTyped = createOrderedList(compiledFiles, lib, {});
        createCMakeLists(sortedTyped.filter(isCompiledJs).map(deNormalizePath));
    }

    function updateKarmaConfig(deps) {
        var path = "tools/karma.conf.js",
            lib = deps.lib,
            modules = createOrderedList(Object.keys(deps.lib).sort(), lib, {});
        fs.readFile(path, "utf8", function (err, content) {
            if (err) {
                throw err;
            }
            var re = new RegExp("// MODULES\r?\n[^!]+!");
            content = content.replace(re,
                "// MODULES\n            'lib/" +
                modules.map(deNormalizePath)
                        .join("',\n            'lib/") + "', // !");
            saveIfDifferent(path, content, function () {
                console.log("karma.conf.js was updated. Rerun the build.");
            });
        });
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
            out += '    "' + className(list[j]) + '": [\n';
            for (i = 0; i < a.length; i += 1) {
                out += '        "' + className(a[i]);
                out += i === a.length - 1 ? '"\n' : '",\n';
            }
            out += j === list.length - 1 ? '    ]\n' : '    ],\n';
        }
        out += "}";
        return out;
    }

    /**
     * Remove dependencies that depend on other dependencies.
     * @param {!Object.<string,!Array.<string>>} deps
     */
    function reduce(deps) {
        // return true if a depends on b
        function dependsOn(a, b) {
            return a === b || deps[b].some(function (c) {
                return dependsOn(a, c);
            });
        }
        Object.keys(deps).forEach(function (key) {
            var d = deps[key],
                i = 0,
                dep,
                redundant;
            function f(a) {
                return dep !== a && dependsOn(dep, a);
            }
            while (i < d.length) {
                dep = d[i];
                redundant = d.some(f);
                if (redundant) {
                    d.splice(i, 1);
                } else {
                    i += 1;
                }
            }
        });
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
        saveIfDifferent(pathModule.join(buildDir, "dependencies-full.dot"),
                createDotFile(deps.lib, files));
        reduce(deps.lib);
        saveIfDifferent(pathModule.join(buildDir, "dependencies.dot"),
                createDotFile(deps.lib, files));
        for (i = 0; i < dirs.length; i += 1) {
            d = dirs[i];
            j = deps[d.split(pathModule.sep)[0]];
            saveIfDifferent(d + "manifest.json", serializeManifest(j));
        }
        updateCMakeLists(deps);
        updateKarmaConfig(deps);
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
        // checking jslint is quite slow, so only do it if the file content is
        // different from the file content at the previous successful run.
        fs.readFile(lpath, "utf8", function (err, data) {
            if (data === contents) {
                return;
            }
            var result, i, errors;
            result = jslint(contents, jslintconfig);
            if (result) {
                // The file has no errors, save it so it will be skipped at the
                // next run.
                mkdir(pathModule.dirname(lpath));
                fs.writeFile(lpath, contents);
            } else {
                errors = jslint.errors;
                for (i = 0; i < errors.length && errors[i]; i += 1) {
                    err = errors[i];
                    console.log(path + ":" + err.line + ":" + err.character +
                          ": error: " + err.reason);
                }
                exitCode = 1;
            }
        });
    }

    /**
     * @param {!string} path
     * @param {!string} content
     * @return {!string}
     */
    function getLicense(path, content) {
        var re = new RegExp("^(/[^]*?)(Copyright.*?>)+([^]*?) \\*/", "m"),
            lic,
            match;
        match = re.exec(content);
        if (match === null) {
            console.log("No license was found for " + path);
            process.exit(1);
        }
        lic = match[1] + match[3];
        return lic;
    }

    /**
     * @param {!Object.<!string,!string>} contents
     * @return {undefined}
     */
    this.checkJSFiles = function (contents) {
        var core = {},
            jslint,
            path,
            license,
            licenses = {},
            // files for which jslint is not run
            jslintExceptions = [
                "lib/externs/JSZip.js",
                "../programs/editor/plugins/bella/seedrandom.js"].map(pathModule.normalize),
            // files for which the license is not checked
            licenseExceptions = [
                "lib/HeaderCompiled.js",
                "lib/core/JSLint.js",
                "lib/externs/JSZip.js",
                "../programs/editor/plugins/bella/seedrandom.js"].map(pathModule.normalize),
            commonLicense;
        // load JSLint
        /*jslint evil: true*/
        eval(contents[pathModule.normalize("lib/core/JSLint.js")]);
        /*jslint evil: false*/
        jslint = new core.JSLint().JSLINT;
        for (path in contents) {
            if (contents.hasOwnProperty(path)
                    && typeof contents[path] === "string") {
                // run jslint of the content of a file
                if (jslintExceptions.indexOf(path) === -1) {
                    runJSLint(jslint, path, contents[path]);
                }
                // collect the license from the file
                if (licenseExceptions.indexOf(path) === -1) {
                    license = getLicense(path, contents[path]);
                    if (licenses.hasOwnProperty(license)) {
                        licenses[license].push(path);
                    } else {
                        licenses[license] = [path];
                    }
                }
            }
        }

        // determine which license is used most often
        commonLicense = Object.keys(licenses).reduce(function (prev, current) {
            var value = licenses[current];
            if (value.length > prev.count) {
                prev = {license: current, count: value.length, path: value};
            }
            return prev;
        }, {license: "", count: 0});
        // report any license that is different from the most common license
        for (license in licenses) {
            if (licenses.hasOwnProperty(license) && license !== commonLicense.license) {
                console.log(licenses[license] + " has an uncommon license.");
                process.exit(1);
            }
        }
    };
}

function main(f) {
    "use strict";
    var pathModule = require("path");
    // recursively read all the files in the lib and tests directories
    f.readFiles(["lib", "tests", "../programs/editor", "../programs/docnosis", "../programs/benchmark"], function (name, isfile) {
        if (name.indexOf("/dojo-deps/") !== -1) {
            return false;
        }
        if (name.indexOf("programs/editor/FileSaver.js") !== -1) {
            return false;
        }
        if (name.indexOf("programs/benchmark/require.js") !== -1) {
            return false;
        }
        // only read directories and js files
        return !isfile || name.indexOf(".js") === name.length - 3;
    }, function (contents) {
        var files = {};
        f.checkJSFiles(contents);
        // remove files that should not go in the manifest.json files
        delete contents[pathModule.normalize("lib/HeaderCompiled.js")];
        delete contents[pathModule.normalize("lib/runtime.js")];
        delete contents[pathModule.normalize("lib/core/JSLint.js")];
        delete contents[pathModule.normalize("tests/tests.js")];
        delete contents[pathModule.normalize("tests/testruntimeadaption.js")];
        Object.keys(contents).forEach(function (name) {
            if (typeof contents[name] === "string") {
                files[name] = contents[name];
            }
        });
        f.createManifestsAndCMakeLists(files, ["lib" + pathModule.sep, "tests" + pathModule.sep]);
    });
    process.on("uncaughtException", function (err) {
        console.log(err);
        throw err;
    });
    process.on('exit', function () {
        process.exit(exitCode);
    });
}

main(new Main(process.argv[3]));
