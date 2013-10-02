string(COMPARE EQUAL "${CMAKE_SOURCE_DIR}" "${CMAKE_CURRENT_SOURCE_DIR}"
    WRONGCMAKEDIR)
if(WRONGCMAKEDIR)
  message(FATAL_ERROR "You should point CMake to the parent directory.")
endif(WRONGCMAKEDIR)

set(TESTJSFILES tests/core/ZipTests.js
    tests/core/Base64Tests.js
    tests/core/DomUtilsTests.js
    tests/core/CursorTests.js
    tests/core/PositionIteratorTests.js
    tests/core/RuntimeTests.js
    tests/gui/UndoStateRulesTests.js
    tests/gui/TrivialUndoManagerTests.js
    tests/gui/SelectionMoverTests.js
    tests/gui/XMLEditTests.js
    tests/gui/StyleHelperTests.js
    tests/odf/OdfUtilsTests.js
    tests/odf/ObjectNameGeneratorTests.js
    tests/odf/FormattingTests.js
    tests/odf/OdfContainerTests.js
    tests/odf/StyleInfoTests.js
    tests/odf/TextStyleApplicatorTests.js
    tests/ops/OdtCursorTests.js
    tests/ops/OdtDocumentTests.js
    tests/ops/OperationTests.js
    tests/ops/SessionTests.js
    tests/xmldom/LSSerializerTests.js
    tests/xmldom/XPathTests.js
    tests/tests.js
)

add_custom_target(jslintcheck ALL
    COMMAND ${NODE} lib/runtime.js tools/runjslint.js
        ${LIBJSFILES} ${TESTJSFILES}
        ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js
    DEPENDS NodeJS webodf.css.js
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    SOURCES ${LIBJSFILES} ${TESTJSFILES}
)

add_custom_command(
    OUTPUT webodf.css.js
    COMMAND "${NODE}"
    ARGS lib/runtime.js tools/css2js.js webodf.css ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js
    DEPENDS NodeJS lib/runtime.js tools/css2js.js webodf.css
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)
add_custom_target(webodf.css.js-target DEPENDS webodf.css.js)

if (Java_JAVA_EXECUTABLE)
  # nonStandardJsDocs is not used because we use @licstart @licend and @source
  set(SHARED_CLOSURE_ARGS --warning_level VERBOSE --jscomp_error accessControls --jscomp_error ambiguousFunctionDecl --jscomp_error checkRegExp --jscomp_error checkTypes --jscomp_error checkVars --jscomp_error constantProperty --jscomp_error deprecated --jscomp_error externsValidation --jscomp_error fileoverviewTags --jscomp_error globalThis --jscomp_error invalidCasts --jscomp_error missingProperties --jscomp_error strictModuleDepCheck --jscomp_error typeInvalidation --jscomp_error undefinedVars --jscomp_error unknownDefines --jscomp_error uselessCode --jscomp_error visibility --jscomp_off nonStandardJsDocs --summary_detail_level 3)

  foreach(JSFILE ${LIBJSFILES})
    if (IS_ABSOLUTE ${JSFILE})
      set(LIB_CLOSURE_ARGS ${LIB_CLOSURE_ARGS}
          --js ${JSFILE})
    else (IS_ABSOLUTE ${JSFILE})
      set(LIB_CLOSURE_ARGS ${LIB_CLOSURE_ARGS}
          --js ${CMAKE_CURRENT_SOURCE_DIR}/${JSFILE})
    endif (IS_ABSOLUTE ${JSFILE})
  endforeach(JSFILE ${LIBJSFILES})

  foreach(JSFILE ${TESTJSFILES})
    set(TEST_CLOSURE_ARGS ${TEST_CLOSURE_ARGS}
        --js ${CMAKE_CURRENT_SOURCE_DIR}/${JSFILE})
  endforeach(JSFILE ${TESTJSFILES})

  set(LIB_CLOSURE_ARGS ${LIB_CLOSURE_ARGS}
      --js ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js)

  add_custom_command(
      OUTPUT simplecompiled.js
      COMMAND ${Java_JAVA_EXECUTABLE}
      ARGS -jar ${CLOSURE_JAR}
         ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS} ${TEST_CLOSURE_ARGS}
         --compilation_level WHITESPACE_ONLY
         --formatting PRETTY_PRINT
         --js_output_file simplecompiled.js-
      COMMAND ${CMAKE_COMMAND} ARGS -E rename simplecompiled.js- simplecompiled.js
      DEPENDS ClosureCompiler ${LIBJSFILES} ${TESTJSFILES}
        ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js
  )
  add_custom_target(simplecompiled.js-target DEPENDS simplecompiled.js)

  add_custom_command(
      OUTPUT compiled.js
      COMMAND ${Java_JAVA_EXECUTABLE}
      ARGS -jar ${CLOSURE_JAR}
         --define IS_COMPILED_CODE=true
         ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS} ${TEST_CLOSURE_ARGS}
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
      ARGS -jar ${CLOSURE_JAR}
         --define IS_COMPILED_CODE=true
         ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS}
         --compilation_level SIMPLE_OPTIMIZATIONS
         --formatting PRINT_INPUT_DELIMITER
         --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js
         --js_output_file webodf.js-
      COMMAND ${CMAKE_COMMAND} ARGS -E rename webodf.js- webodf.js
      DEPENDS ClosureCompiler ${LIBJSFILES} tools/externs.js
         webodf.css.js-target tools/css2js.js
  )
  add_custom_target(webodf.js-target DEPENDS webodf.js)

  # too hardcore for now...
  # add_custom_command(
  #     OUTPUT webodf-experimental.js
  #     COMMAND ${Java_JAVA_EXECUTABLE}
  #     ARGS -jar ${CLOSURE_JAR}
  #        --define IS_COMPILED_CODE=true
  #        ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS}
  #        --js ${CMAKE_CURRENT_SOURCE_DIR}/lib/export.js
  #        --compilation_level ADVANCED_OPTIMIZATIONS
  #        --formatting PRINT_INPUT_DELIMITER
  #        --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js
  #        --js_output_file webodf-experimental.js
  #     DEPENDS ClosureCompiler ${LIBJSFILES} lib/export.js tools/externs.js webodf.css.js
  # )

  add_custom_command(
      OUTPUT webodf-debug.js
      COMMAND ${Java_JAVA_EXECUTABLE}
      ARGS -jar ${CLOSURE_JAR}
         --define IS_COMPILED_CODE=true
         ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS}
         --compilation_level WHITESPACE_ONLY
         --formatting PRETTY_PRINT
         --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js
         --js_output_file webodf-debug.js-
      COMMAND ${CMAKE_COMMAND} ARGS -E rename webodf-debug.js- webodf-debug.js
      DEPENDS ClosureCompiler ${LIBJSFILES} tools/externs.js
          webodf.css.js-target
  )
  add_custom_target(webodf-debug.js-target DEPENDS webodf-debug.js)

  add_custom_command(
      OUTPUT odfedit.js
      COMMAND ${Java_JAVA_EXECUTABLE}
      ARGS -jar ${CLOSURE_JAR}
         --define IS_COMPILED_CODE=true
         ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS}
         --js ${CMAKE_CURRENT_SOURCE_DIR}/odfedit.js
         --compilation_level ADVANCED_OPTIMIZATIONS
         --formatting PRETTY_PRINT
         --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js
         --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/extjsexterns.js
         --js_output_file odfedit.js-
      COMMAND ${CMAKE_COMMAND} ARGS -E rename odfedit.js- odfedit.js
      DEPENDS ClosureCompiler ${LIBJSFILES} ${APPJSFILES}
          tools/externs.js tools/extjsexterns.js odfedit.js webodf.css.js-target
  )
  add_custom_target(odfedit.js-target DEPENDS odfedit.js)

  add_custom_command(
      OUTPUT gui.js
      COMMAND ${Java_JAVA_EXECUTABLE}
      ARGS -jar ${CLOSURE_JAR}
         --define IS_COMPILED_CODE=true
         ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS}
         --js ${CMAKE_CURRENT_SOURCE_DIR}/filelister.js
         --js ${CMAKE_CURRENT_SOURCE_DIR}/gui.js
         --compilation_level ADVANCED_OPTIMIZATIONS
         --formatting PRETTY_PRINT
         --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js
         --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/extjsexterns.js
         --js_output_file gui.js-
      COMMAND ${CMAKE_COMMAND} ARGS -E gui.js- gui.js
      DEPENDS ClosureCompiler ${LIBJSFILES} ${APPJSFILES}
        tools/externs.js tools/extjsexterns.js webodf.css.js-target
        filelister.js gui.js
  )
  add_custom_target(gui.js-target DEPENDS gui.js)

  add_custom_target(syntaxcheck ALL
      DEPENDS simplecompiled.js-target webodf.js-target webodf-debug.js-target
          compiled.js-target
  )

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
  add_custom_target(simplenodetest ALL
      COMMAND ${NODE} ${CMAKE_CURRENT_BINARY_DIR}/simplecompiled.js
      DEPENDS NodeJS simplecompiled.js-target
      WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/tests
  )

endif (Java_JAVA_EXECUTABLE)

add_custom_command(
    OUTPUT instrumented/index.html
    COMMAND ${JSCOVERAGE}
    ARGS --exclude=node_modules
         ${CMAKE_CURRENT_SOURCE_DIR}
         ${CMAKE_CURRENT_BINARY_DIR}/instrumented
    DEPENDS ${LIBJSFILES} jslintcheck JSCoverage
)
add_custom_target(instrumented ALL DEPENDS instrumented/index.html)

add_subdirectory(tests)

# vim:expandtab
