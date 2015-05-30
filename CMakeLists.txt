# This makefile 'compiles' WebODF using various tools, instruments the code and
# builds and packages programs that use WebODF.

# WebODF is mostly a JavaScript project. CMake needs to know about the C++ parts
project (WebODF C CXX)

cmake_minimum_required(VERSION 2.8.11)

# Require separate build dir
if (CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)
  message(FATAL_ERROR "Compiling in the source directory is not supported.")
endif (CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)

# Tools must be obtained to work with:
include (ExternalProject)

include(ProcessorCount OPTIONAL RESULT_VARIABLE ProcessorCountFound)
if (ProcessorCountFound)
  ProcessorCount(NProcessors)
else (ProcessorCountFound)
  set(NProcessors 1)
endif (ProcessorCountFound)

# At this point, the version number that is used throughout is defined
# The version number is gotten from either the git repository or the name of the
# folder. If the current folder has a name that matches "webodf-\d+.\d+.\d+"
# then that version number is used. If not, the folder should be a git folder
# and have ability to get a tag.
# The third option is to accept the version as cmake-parameter from the
# outside, which overwrites the other two alternatives.

SET(OVERRULED_WEBODF_VERSION "" CACHE STRING "WebODF Version to overrule what WebODF would calclulate")
if (OVERRULED_WEBODF_VERSION)
  set(WEBODF_VERSION ${OVERRULED_WEBODF_VERSION})
else (OVERRULED_WEBODF_VERSION)
  string(REGEX MATCH "^.*/[Ww]eb[Oo][Dd][Ff]-([0-9]+.[0-9]+.[0-9]+)$" WEBODF_VERSION "${CMAKE_CURRENT_SOURCE_DIR}")
  if (CMAKE_MATCH_1)
    set(WEBODF_VERSION ${CMAKE_MATCH_1})
  else (CMAKE_MATCH_1)
    # get version number from git
    exec_program(git ${CMAKE_CURRENT_SOURCE_DIR}
      ARGS describe --tags --dirty --match "v[0-9]*"
      OUTPUT_VARIABLE GIT_WEBODF_VERSION)
    # check version number from git
    string(REGEX MATCH "^v([0-9]+.[0-9]+.[0-9]+((-[0-9]+-[0-9a-z]+)?(-dirty)?)?)$" CHECKED_WEBODF_VERSION "${GIT_WEBODF_VERSION}")
    if (CMAKE_MATCH_1)
      set(WEBODF_VERSION ${CMAKE_MATCH_1})
    else (CMAKE_MATCH_1)
      message(FATAL_ERROR "No valid version number found via git: ${GIT_WEBODF_VERSION}")
    endif (CMAKE_MATCH_1)
  endif (CMAKE_MATCH_1)
endif (OVERRULED_WEBODF_VERSION)
message(STATUS "WebODF version " ${WEBODF_VERSION})


#########################################################
## Find installed dependencies
#########################################################

set(QT_MIN_VERSION "5.1.1")
find_package(Qt5Network)
find_package(Qt5Xml)
find_package(Qt5PrintSupport)
find_package(Qt5WebKitWidgets)

if (Qt5Network_FOUND AND Qt5Xml_FOUND AND Qt5PrintSupport_FOUND AND Qt5WebKitWidgets_FOUND)
  set(BUILD_QTJSRUNTIME TRUE)
else ()
  message(WARNING "Qt5 with modules Qt5Network Qt5Xmle Qt5PrintSupport Qt5WebKitWidgets was not found. qtjsruntime will no be built.")
  set(BUILD_QTJSRUNTIME FALSE)
endif ()

# java runtime is needed for Closure Compiler
find_package(Java COMPONENTS Runtime REQUIRED)

# Node.js will be downloaded on Windows systems, so check for installed version is below
SET(REQUIRED_NODEJS_VERSION 0.10.5)


#########################################################
## Download stuff that is not commonly installed/packaged
#########################################################

# allow specification of a directory with pre-downloaded
# requirements by evaluating environment variable
# $WEBODF_DOWNLOAD_DIR
# defaults to "./downloads" in the build directory.
if ( IS_DIRECTORY $ENV{WEBODF_DOWNLOAD_DIR} )
    SET ( EXTERNALS_DOWNLOAD_DIR $ENV{WEBODF_DOWNLOAD_DIR} )
else ( IS_DIRECTORY $ENV{WEBODF_DOWNLOAD_DIR} )
    SET ( EXTERNALS_DOWNLOAD_DIR ${CMAKE_BINARY_DIR}/downloads )
endif ( IS_DIRECTORY $ENV{WEBODF_DOWNLOAD_DIR} )
MESSAGE ( STATUS "external downloads will be stored/expected in: ${EXTERNALS_DOWNLOAD_DIR}" )

# Closure Compiler
ExternalProject_Add(
    ClosureCompiler
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "http://dl.google.com/closure-compiler/compiler-20150505.tar.gz"
    URL_MD5 dea8e282c316316daeb39fcd5708d369
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
set(CLOSURE_JAR ${CMAKE_BINARY_DIR}/ClosureCompiler-prefix/src/ClosureCompiler/compiler.jar)

# Rhino
ExternalProject_Add(
    Rhino
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "http://ftp.mozilla.org/pub/js/rhino1_7R3.zip"
    URL_MD5 99d94103662a8d0b571e247a77432ac5
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
set(RHINO ${CMAKE_BINARY_DIR}/Rhino-prefix/src/Rhino/js.jar)

# JSDoc
ExternalProject_Add(
    JsDoc
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "http://jsdoc-toolkit.googlecode.com/files/jsdoc_toolkit-2.4.0.zip"
    URL_MD5 a8f78f5ecd24b54501147b2af341a231
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
set(JSDOCDIR ${CMAKE_BINARY_DIR}/JsDoc-prefix/src/JsDoc/jsdoc-toolkit)

# Node.js
set(NODEVERSION 0.10.20)
if(WIN32)
    # On windows, it is significantly faster and more reliable to download
    # a pre-built 32-bit binary
    set(NODE_BIN_URL "http://nodejs.org/dist/v${NODEVERSION}/node.exe")
    set(NODE_BIN_MD5 "3bc43fbbfcddc376d5769e9757bd0bca")
    file(DOWNLOAD "${NODE_BIN_URL}" "${EXTERNALS_DOWNLOAD_DIR}/node-download.exe"
        SHOW_PROGRESS
        EXPECTED_MD5 ${NODE_BIN_MD5}
    )
    set(NODE ${CMAKE_BINARY_DIR}/NodeJS-prefix/bin/node.exe)
    set(NPM ${CMAKE_BINARY_DIR}/NodeJS-prefix/bin/npm.exe)
    execute_process(COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/NodeJS-prefix
      COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/NodeJS-prefix/bin
      COMMAND ${CMAKE_COMMAND} -E copy ${EXTERNALS_DOWNLOAD_DIR}/node-download.exe "${NODE}"
    )
    add_custom_target(NodeJS DEPENDS "${NODE}")
else(WIN32)
    SET(NODEJS_VERSION 0.0.0)
    # Debian uses nodejs as binary name, due to conflict with node package (Amateur Packet Radio Node Program)
    # https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager
    FIND_PROGRAM(NODEJS_EXECUTABLE
        NAMES nodejs node
        PATHS ""
        DOC "Path to Node.js executable"
    )
    IF(NODEJS_EXECUTABLE)
        EXEC_PROGRAM(${NODEJS_EXECUTABLE} ARGS --version OUTPUT_VARIABLE NODEJS_VERSION)
        string(SUBSTRING ${NODEJS_VERSION} 1 -1 NODEJS_VERSION)
        MESSAGE (STATUS "Installed Node.js found: ${NODEJS_EXECUTABLE} - ${NODEJS_VERSION}")
    ELSE(NODEJS_EXECUTABLE)
        MESSAGE (STATUS "No installed Node.js found. On platforms other than Windows, Node.js is not downloaded, but expected to be installed.")
    ENDIF(NODEJS_EXECUTABLE)

    # fail if NodeJS version requirement is not satisfied
    if (${NODEJS_VERSION} VERSION_LESS ${REQUIRED_NODEJS_VERSION})
        message(FATAL_ERROR "Node.js is required in version " ${REQUIRED_NODEJS_VERSION}  " or later")
    else()
        message(STATUS "good Node.js found: " ${NODEJS_VERSION} " (" ${REQUIRED_NODEJS_VERSION} " required.)")
    endif()
    set(NODE ${NODEJS_EXECUTABLE})
    FIND_PROGRAM(NPM
        NAMES npm
        PATHS ""
        DOC "Path to NPM executable"
    )
    MESSAGE (STATUS "npm found: " ${NPM})
    add_custom_target(NodeJS DEPENDS "${NODEJS_EXECUTABLE}")
endif(WIN32)

# copy node_modules directory from source to build
# (this is needed if a module is required in there)

# Node's search path for node_modules starts from the main package and works up towards the root.
# In order to see these node modules, they need to be somewhere in this path
# See http://nodejs.org/api/modules.html#modules_loading_from_node_modules_folders for more detail
add_custom_target(copy_node_modules ALL
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/node_modules ${CMAKE_BINARY_DIR}/node_modules
    COMMENT copying node_modules from source to build
)

# Android
# If android sdk is properly installed, cmake only needs to know where to find
# the executable 'android'.
# The variable ANDROID_SDK_DIR can be provided if a specific android sdk version
# is desired or if the android executable is not in the path.
if (ANDROID_SDK_DIR)
  set(ANDROID ${ANDROID_SDK_DIR}/tools/android)
else (ANDROID_SDK_DIR)
  find_program(ANDROID NAMES android DOC "Path to the Android executable.")
endif(ANDROID_SDK_DIR)
FIND_PROGRAM(ANT NAMES ant DOC "Path to the Ant executable.")
if(ANDROID AND ANT)
  set(BUILD_APK TRUE)
  message(STATUS "Found Android and Ant: building an APK for Android.")
  message(STATUS "android: ${ANDROID}")
  message(STATUS "ant: ${ANT}")
else()
  message(STATUS "Android was not found: APK will not be built.")
endif()

# JSCoverage
if(WIN32)
    # JSCoverage only builds with Cygwin/MiniGW
    # Rather than force a dependency on a specific compiler, download binaries
    ExternalProject_Add(
        JSCoverage
        DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
        URL "http://siliconforks.com/jscoverage/download/jscoverage-0.5.1-windows.zip"
        CONFIGURE_COMMAND ""
        BUILD_COMMAND ""
        INSTALL_COMMAND ""
        TEST_COMMAND ""
    )
    set(JSCOVERAGE ${CMAKE_BINARY_DIR}/JSCoverage-prefix/src/JSCoverage/jscoverage)
elseif(APPLE)
else()
    ExternalProject_Add(
        JSCoverage
        DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
        URL "http://siliconforks.com/jscoverage/download/jscoverage-0.5.1.tar.bz2"
        URL_MD5 a70d79a6759367fbcc0bcc18d6866ff3
        PATCH_COMMAND  cat ${CMAKE_CURRENT_SOURCE_DIR}/JSCoverage.patch | patch -p0
        CONFIGURE_COMMAND "./configure"
        BUILD_COMMAND make -j${NProcessors}
        BUILD_IN_SOURCE 1
        INSTALL_COMMAND ""
    )
    set(JSCOVERAGE ${CMAKE_BINARY_DIR}/JSCoverage-prefix/src/JSCoverage/jscoverage)
endif()

# Dojo
ExternalProject_Add(
    Dojo
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "http://download.dojotoolkit.org/release-1.8.1/dojo-release-1.8.1-src.tar.gz"
    URL_MD5 9b80b9a736b81c336accd832f3c3aea2
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
set(DOJO ${CMAKE_BINARY_DIR}/Dojo-prefix/src/Dojo)

# Dojo requires a patch on windows
if(WIN32)
    set(DOJOPATCH_URL "http://bugs.dojotoolkit.org/raw-attachment/ticket/15413/node-win-1.8.patch")
    set(DOJOPATCH_MD5 "51eae664ddbe919c28c4e3082748cd19")
    set(DOJOPATCH ${EXTERNALS_DOWNLOAD_DIR}/dojo-node.patch)

    file(DOWNLOAD "${DOJOPATCH_URL}" "${DOJOPATCH}"
        SHOW_PROGRESS
        EXPECTED_MD5 ${DOJOPATCH_MD5}
    )


    ExternalProject_Add_Step(Dojo applyPatch
        COMMAND cat ${DOJOPATCH} | patch -p0 -d ${CMAKE_BINARY_DIR}/Dojo-prefix/src/Dojo/util/
        DEPENDEES build
    )
endif(WIN32)

##############################
## Define custom macros
##############################

# COPY_FILES (varname srcdir tgtdir files)
# Creates a target that copies the listed files from the srcdir to the tgtdir,
# preserving their relative path.
# Absolute files will be copied into the root of tgtdir without any additional subdirs
macro(COPY_FILES _varname _srcdir _tgtdir)
  foreach(_file ${ARGN})
    if (IS_ABSOLUTE ${_file})
      SET(_subdir "")
      SET(_srcfile ${_file})
      GET_FILENAME_COMPONENT(_dstfile ${_file} NAME)
    else (IS_ABSOLUTE ${_file})
      GET_FILENAME_COMPONENT(_subdir ${_file} PATH)
      SET(_srcfile ${_srcdir}/${_file})
      SET(_dstfile ${_file})
    endif (IS_ABSOLUTE ${_file})
    FILE(MAKE_DIRECTORY ${_tgtdir}/${_subdir})
    add_custom_command(
      OUTPUT ${_tgtdir}/${_dstfile}
      COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different
        ${_srcfile}
        ${_tgtdir}/${_dstfile}
      DEPENDS
        ${_srcfile}
    )
    set(${_varname} ${${_varname}} ${_tgtdir}/${_dstfile})
  endforeach(_file)
endmacro(COPY_FILES _directory _files)

#############################
## Define some files and dirs
#############################

# HEADERCOMPILED_FILE defines the file to use as header for the compiled WebODF library file.
# Per default that is webodf/lib/HeaderCompiled.js
# For release builds it can be overwritten by passing -DHEADERCOMPILED_FILE=/path/to/file
# to cmake.
if(NOT HEADERCOMPILED_FILE)
  set(HEADERCOMPILED_FILE "${CMAKE_SOURCE_DIR}/webodf/lib/HeaderCompiled.js")
elseif(NOT IS_ABSOLUTE ${HEADERCOMPILED_FILE})
  set(HEADERCOMPILED_FILE ${CMAKE_BINARY_DIR}/${HEADERCOMPILED_FILE})
endif()

set(TOOLS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/webodf/tools)
set(RUNTIMEJS ${CMAKE_CURRENT_SOURCE_DIR}/webodf/lib/runtime.js)
set(LIBJSLICENSEFILE ${CMAKE_CURRENT_SOURCE_DIR}/AGPL-3.0.txt)

set(WEBODFJS_DIR ${CMAKE_CURRENT_BINARY_DIR}/webodf.js-${WEBODF_VERSION})
set(WEBODFJS_ZIP webodf.js-${WEBODF_VERSION}.zip)

set(WODOTEXTEDITORBUILDDIR ${CMAKE_CURRENT_BINARY_DIR}/wodotexteditor)

set(WODOCOLLABTEXTEDITORBUILDDIR ${CMAKE_BINARY_DIR}/wodocollabtexteditor)
set(WODOCOLLABTEXTEDITOR_ZIP ${CMAKE_CURRENT_BINARY_DIR}/wodocollabtexteditor-${WEBODF_VERSION}.zip)

set(FIREFOX_EXTENSION_ODFVIEWER_DIR ${CMAKE_CURRENT_BINARY_DIR}/firefox-extension-odfviewer-${WEBODF_VERSION})
set(FIREFOX_EXTENSION_ODFVIEWER ${FIREFOX_EXTENSION_ODFVIEWER_DIR}.xpi)


####################
## WORKAROUND HELPER
####################

# cmake -E touch truncates time to seconds in older versions
# see http://www.cmake.org/Bug/view.php?id=14020
if (CMAKE_VERSION VERSION_LESS 2.8.12)
  set(TOUCHFILE ${NODE} ${TOOLS_DIR}/touchfile.js)
else()
  set(TOUCHFILE ${CMAKE_COMMAND} -E touch)
endif()


#############################
## Build Library and programs
#############################

# the lib
add_subdirectory(webodf)

# the programs/components
add_subdirectory(programs)

# vim:expandtab
