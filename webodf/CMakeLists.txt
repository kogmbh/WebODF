string(COMPARE EQUAL "${CMAKE_SOURCE_DIR}" "${CMAKE_CURRENT_SOURCE_DIR}"
    WRONGCMAKEDIR)
if(WRONGCMAKEDIR)
  message(FATAL_ERROR "You should point CMake to the parent directory.")
endif(WRONGCMAKEDIR)

configure_file(webodfversion.js.in ${CMAKE_CURRENT_BINARY_DIR}/webodfversion.js)

set(TESTJSFILES tests/core/ZipTests.js
    tests/core/Base64Tests.js
    tests/core/DomUtilsTests.js
    tests/core/CursorTests.js
    tests/core/StepIteratorTests.js
    tests/core/PositionIteratorTests.js
    tests/core/RuntimeTests.js
    tests/gui/UndoStateRulesTests.js
    tests/gui/TrivialUndoManagerTests.js
    tests/gui/SelectionControllerTests.js
    tests/gui/StyleSummaryTests.js
    tests/odf/OdfUtilsTests.js
    tests/odf/ObjectNameGeneratorTests.js
    tests/odf/FormattingTests.js
    tests/odf/OdfContainerTests.js
    tests/odf/StyleInfoTests.js
    tests/odf/TextStyleApplicatorTests.js
    tests/ops/OdtDocumentTests.js
    tests/ops/OperationTests.js
    tests/ops/TransformerTests.js
    tests/ops/TransformationTests.js
    tests/ops/SessionTests.js
    tests/ops/StepsTranslatorTests.js
    tests/xmldom/LSSerializerTests.js
    tests/xmldom/XPathTests.js
    tests/tests.js
)

add_custom_target(manifest.json-target
    COMMAND ${NODE}
    lib/runtime.js tools/updateJS.js ${CMAKE_BINARY_DIR}/jsfileslist.txt
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
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
  # ideally we would enable --jscomp_error reportUnknownTypes
  # -XX:+TieredCompilation reduces compilation time by about 30%
  set(SHARED_CLOSURE_ARGS -XX:+TieredCompilation -jar ${CLOSURE_JAR} --warning_level VERBOSE --jscomp_error accessControls --jscomp_error ambiguousFunctionDecl --jscomp_error checkEventfulObjectDisposal --jscomp_error checkRegExp --jscomp_error checkStructDictInheritance --jscomp_error checkTypes --jscomp_error checkVars --jscomp_error const --jscomp_error constantProperty --jscomp_error deprecated --jscomp_error duplicateMessage --jscomp_error es3 --jscomp_error es5Strict --jscomp_error externsValidation --jscomp_error fileoverviewTags --jscomp_error globalThis --jscomp_error invalidCasts --jscomp_error misplacedTypeAnnotation --jscomp_error missingProperties --jscomp_error missingProvide --jscomp_error missingRequire --jscomp_error missingReturn --jscomp_off nonStandardJsDocs --jscomp_error suspiciousCode --jscomp_error strictModuleDepCheck --jscomp_error typeInvalidation --jscomp_error undefinedNames --jscomp_error undefinedVars --jscomp_error unknownDefines --jscomp_error uselessCode --jscomp_error visibility --summary_detail_level 3)

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
      ARGS ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS} ${TEST_CLOSURE_ARGS}
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
      ARGS ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS} ${TEST_CLOSURE_ARGS}
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
      ARGS ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS}
         --jscomp_error reportUnknownTypes
         --define IS_COMPILED_CODE=true
         --compilation_level SIMPLE_OPTIMIZATIONS
         --formatting PRINT_INPUT_DELIMITER
         --externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js
         --js_output_file webodf.js-
      COMMAND ${CMAKE_COMMAND} ARGS -E rename webodf.js- webodf.js
      DEPENDS ClosureCompiler ${LIBJSFILES} tools/externs.js
         webodf.css.js-target
  )
  add_custom_target(webodf.js-target DEPENDS webodf.js)

  add_custom_command(
      OUTPUT webodf-debug.js
      COMMAND ${Java_JAVA_EXECUTABLE}
      ARGS ${SHARED_CLOSURE_ARGS} ${LIB_CLOSURE_ARGS}
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
          webodf.css.js-target
  )
  add_custom_target(webodf-debug.js-target DEPENDS webodf-debug.js)

  add_custom_target(syntaxcheck ALL
      DEPENDS simplecompiled.js-target webodf.js-target
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

add_subdirectory(tests)

# vim:expandtab
