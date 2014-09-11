string(COMPARE EQUAL "${CMAKE_SOURCE_DIR}" "${CMAKE_CURRENT_SOURCE_DIR}"
    WRONGCMAKEDIR)
if(WRONGCMAKEDIR)
  message(FATAL_ERROR "You should point CMake to the parent directory.")
endif(WRONGCMAKEDIR)

# update the list of needed files
execute_process(
  COMMAND ${NODE} ${RUNTIMEJS} ${TOOLS_DIR}/updateJS.js ${CMAKE_BINARY_DIR}/jsfileslist.txt
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)
include(${CMAKE_BINARY_DIR}/jsfileslist.txt)

configure_file(webodfversion.js.in ${CMAKE_CURRENT_BINARY_DIR}/webodfversion.js)

set(TESTJSFILES tests/core/ZipTests.js
    tests/core/Base64Tests.js
    tests/core/CursorTests.js
    tests/core/DomUtilsTests.js
    tests/core/EventSubscriptionsTests.js
    tests/core/PositionIteratorTests.js
    tests/core/RuntimeTests.js
    tests/core/StepIteratorTests.js
    tests/gui/DirectFormattingControllerTests.js
    tests/gui/GuiStepUtilsTests.js
    tests/gui/MetadataControllerTests.js
    tests/gui/SelectionControllerTests.js
    tests/gui/StyleSummaryTests.js
    tests/gui/TextControllerTests.js
    tests/gui/TrivialUndoManagerTests.js
    tests/gui/UndoStateRulesTests.js
    tests/odf/StyleParseUtilsTests.js
    tests/odf/StyleCacheTests.js
    tests/odf/FormattingTests.js
    tests/odf/LayoutTests.js
    tests/odf/ListStyleToCssTests.js
    tests/odf/ObjectNameGeneratorTests.js
    tests/odf/MaliciousDocumentTests.js
    tests/odf/OdfContainerTests.js
    tests/odf/OdfContainerSafetyTests.js
    tests/odf/OdfUtilsTests.js
    tests/odf/StyleInfoTests.js
    tests/odf/TextStyleApplicatorTests.js
    tests/ops/OperationTestHelper.js
    tests/ops/OdtDocumentTests.js
    tests/ops/OperationTests.js
    tests/ops/SessionTests.js
    tests/ops/OdtStepsTranslatorTests.js
    tests/ops/TransformationTests.js
    tests/ops/TransformerTests.js
    tests/xmldom/LSSerializerTests.js
    tests/xmldom/XPathTests.js
    tests/tests.js
)

add_custom_target(manifest.json-target
    COMMAND ${NODE}
    ${RUNTIMEJS} ${TOOLS_DIR}/updateJS.js ${CMAKE_BINARY_DIR}/jsfileslist.txt
    DEPENDS ${TOOLS_DIR}/updateJS.js
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)

add_custom_command(
    OUTPUT webodf.css.js
    COMMAND ${NODE}
    ARGS ${RUNTIMEJS} ${TOOLS_DIR}/css2js.js webodf.css ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js
    DEPENDS ${TOOLS_DIR}/css2js.js webodf.css
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)
add_custom_target(webodf.css.js-target DEPENDS webodf.css.js)

# Windows has a command-line limit of around 8,000 chars, so files to be compiled are supplied to CC using the --flagfile
# option to help keep the length of the compilation command as small as possible.
file (WRITE ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt "--warning_level VERBOSE --jscomp_error accessControls --jscomp_error ambiguousFunctionDecl --jscomp_error checkEventfulObjectDisposal --jscomp_error checkRegExp --jscomp_error checkStructDictInheritance --jscomp_error checkTypes --jscomp_error checkVars --jscomp_error const --jscomp_error constantProperty --jscomp_error deprecated --jscomp_error duplicateMessage --jscomp_error es3 --jscomp_error es5Strict --jscomp_error externsValidation --jscomp_error fileoverviewTags --jscomp_error globalThis --jscomp_error invalidCasts --jscomp_error misplacedTypeAnnotation --jscomp_error missingProperties --jscomp_error missingProvide --jscomp_error missingRequire --jscomp_error missingReturn --jscomp_off nonStandardJsDocs --jscomp_error suspiciousCode --jscomp_error strictModuleDepCheck --jscomp_error typeInvalidation --jscomp_error undefinedNames --jscomp_error undefinedVars --jscomp_error unknownDefines --jscomp_error uselessCode --jscomp_error visibility --summary_detail_level 3")

file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt " --js ${HEADERCOMPILED_FILE}")

foreach(JSFILE ${LIBJSFILES})
    if (IS_ABSOLUTE ${JSFILE})
        file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt " --js ${JSFILE}")
    else (IS_ABSOLUTE ${JSFILE})
        file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt " --js ${CMAKE_CURRENT_SOURCE_DIR}/${JSFILE}")
    endif (IS_ABSOLUTE ${JSFILE})
endforeach(JSFILE ${LIBJSFILES})

file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt " --js ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js")

# copy the flagfile for some targets which require the test files to be passed into CC
# this requires a separate file as other targets don't want to compile the test files
execute_process(COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt ${CMAKE_CURRENT_BINARY_DIR}/cc-withTestFiles.txt)

foreach(JSFILE ${TESTJSFILES})
    file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-withTestFiles.txt " --js ${CMAKE_CURRENT_SOURCE_DIR}/${JSFILE}")
endforeach(JSFILE ${TESTJSFILES})

# nonStandardJsDocs is not used because we use @licstart @licend and @source
# ideally we would enable --jscomp_error reportUnknownTypes
# -XX:+TieredCompilation reduces compilation time by about 30%
set(SHARED_CLOSURE_ARGS -XX:+TieredCompilation -jar ${CLOSURE_JAR})

add_custom_command(
    OUTPUT simplecompiled.js
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS ${SHARED_CLOSURE_ARGS} --flagfile ${CMAKE_CURRENT_BINARY_DIR}/cc-withTestFiles.txt
        --compilation_level WHITESPACE_ONLY
        --formatting PRETTY_PRINT
        --js_output_file simplecompiled.js-
    # in WHITESPACE_ONLY mode, it is not possible to define IS_COMPILED_CODE
    # so the value for IS_COMPILED_CODE is set by find and replace in the code
    COMMAND ${CMAKE_COMMAND} -DFILENAME:STRING="${CMAKE_CURRENT_BINARY_DIR}/simplecompiled.js" -P ${CMAKE_CURRENT_SOURCE_DIR}/tools/set_IS_COMPILED_CODE.cmake
    DEPENDS ClosureCompiler ${LIBJSFILES} ${TESTJSFILES}
    ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js
)
add_custom_target(simplecompiled.js-target DEPENDS simplecompiled.js)

add_custom_command(
    OUTPUT compiled.js
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS ${SHARED_CLOSURE_ARGS} --flagfile ${CMAKE_CURRENT_BINARY_DIR}/cc-withTestFiles.txt
        --define IS_COMPILED_CODE=true
        --compilation_level ADVANCED_OPTIMIZATIONS
        --formatting PRETTY_PRINT
        --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js
        --js_output_file compiled.js-
    COMMAND ${CMAKE_COMMAND} ARGS -E rename compiled.js- compiled.js
    DEPENDS ClosureCompiler ${LIBJSFILES} ${TESTJSFILES} tools/externs.js
        webodf.css.js-target
)
add_custom_target(compiled.js-target DEPENDS compiled.js)

add_custom_command(
    OUTPUT webodf.js
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS ${SHARED_CLOSURE_ARGS} --flagfile ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt
        --jscomp_error reportUnknownTypes
        --define IS_COMPILED_CODE=true
        --compilation_level SIMPLE_OPTIMIZATIONS
        --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js
        --js_output_file webodf.js-
    COMMAND ${CMAKE_COMMAND} ARGS -E rename webodf.js- webodf.js
    DEPENDS ClosureCompiler ${LIBJSFILES} tools/externs.js
        webodf.css.js-target ${HEADERCOMPILED_FILE}
)
add_custom_target(webodf.js-target DEPENDS webodf.js)

add_custom_command(
    OUTPUT webodf-debug.js
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS ${SHARED_CLOSURE_ARGS} --flagfile ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt
        --jscomp_error reportUnknownTypes
        --define IS_COMPILED_CODE=true
        --compilation_level WHITESPACE_ONLY
        --formatting PRETTY_PRINT
        --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js
        --js_output_file webodf-debug.js-
    # in WHITESPACE_ONLY mode, it is not possible to define IS_COMPILED_CODE
    # so the value for IS_COMPILED_CODE is set by find and replace in the code
    COMMAND ${CMAKE_COMMAND} -DFILENAME:STRING="${CMAKE_CURRENT_BINARY_DIR}/webodf-debug.js" -P ${CMAKE_CURRENT_SOURCE_DIR}/tools/set_IS_COMPILED_CODE.cmake
    DEPENDS ClosureCompiler ${LIBJSFILES} tools/externs.js
        webodf.css.js-target ${HEADERCOMPILED_FILE}
)
add_custom_target(webodf-debug.js-target DEPENDS webodf-debug.js)

add_custom_target(syntaxcheck ALL
    DEPENDS simplecompiled.js-target webodf.js-target
        compiled.js-target
)

# rhino tests are disabled for now: rhino runtime lacks (wrappers for)
# essential necessities such as Uint8Array, Node and NodeFilter
# RHINOTEST is only defined here and hence undefined to disable rhinotest
if (RHINOTEST)
add_custom_target(rhinotest
    COMMAND ${Java_JAVA_EXECUTABLE} -jar ${RHINO}
        -debug lib/runtime.js tests/tests.js
    DEPENDS Rhino
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    SOURCES ${LIBJSFILES}
)
add_custom_target(simplerhinotest
    COMMAND ${Java_JAVA_EXECUTABLE} -jar ${RHINO}
        ${CMAKE_CURRENT_BINARY_DIR}/simplecompiled.js
    DEPENDS Rhino simplecompiled.js-target
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/tests
)
endif (RHINOTEST)

add_custom_command(
    OUTPUT docs/index.html
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS -jar ${JSDOCDIR}/jsrun.jar
        ${JSDOCDIR}/app/run.js -d=${CMAKE_CURRENT_BINARY_DIR}/docs
            -t=${JSDOCDIR}/templates/jsdoc ${LIBJSFILES}
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    DEPENDS ${LIBJSFILES} JsDoc
)
add_custom_target(doc DEPENDS docs/index.html)

add_custom_command(
    OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/simplenodetest.timestamp
    COMMAND ${NODE} ${CMAKE_CURRENT_BINARY_DIR}/simplecompiled.js
    COMMAND ${TOUCHFILE} ${CMAKE_CURRENT_BINARY_DIR}/simplenodetest.timestamp
    DEPENDS ${NODE} simplecompiled.js copy_node_modules
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/tests
)
add_custom_target(simplenodetest ALL DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/simplenodetest.timestamp)

if (NOT APPLE)
    add_custom_command(
        OUTPUT instrumented/index.html
        COMMAND ${JSCOVERAGE}
        ARGS --exclude=node_modules
             ${CMAKE_CURRENT_SOURCE_DIR}
             ${CMAKE_CURRENT_BINARY_DIR}/instrumented
        DEPENDS ${LIBJSFILES} JSCoverage
    )
    add_custom_target(instrumented DEPENDS instrumented/index.html)
endif(NOT APPLE)

add_custom_target(webodf.js-tests DEPENDS syntaxcheck simplenodetest)

add_custom_command(
    OUTPUT ${WEBODFJS_ZIP}

    # clear working dir
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${WEBODFJS_DIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${WEBODFJS_DIR}

    # API docs
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_BINARY_DIR}/docs ${WEBODFJS_DIR}/docs
    # webodf.js
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/webodf.js ${WEBODFJS_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/webodf-debug.js ${WEBODFJS_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy ${LIBJSLICENSEFILE} ${WEBODFJS_DIR}

    # zip using javascript code running in Node.js
    COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
        ${WEBODFJS_DIR}
        ${CMAKE_BINARY_DIR}/${WEBODFJS_ZIP}

    DEPENDS
        ${TOOLS_DIR}/zipdir.js
        doc
        webodf.js-target
        webodf-debug.js-target
        ${LIBJSLICENSEFILE}
)
add_custom_target(build-library DEPENDS ${WEBODFJS_ZIP} )

add_custom_target(test-library DEPENDS webodf.js-tests)

add_custom_target(product-library DEPENDS build-library test-library)

add_subdirectory(tests)

# vim:expandtab
