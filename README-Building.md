## Building WebODF on Linux

For creating the file "webodf.js" out of the sources CMake and Java needs to be installed.

Another optional, but recommended requirement are the Qt5 libs, which are used to create and run tests.

Further requirements, like the [Closure Compiler][], will be conveniently downloaded automatically during the build, as usually the latest version will be used,
which might not yet be available as a package. So during (first) build also a connection to the internet will be needed.
Downloaded requirements will be cached in the build directory.
[Closure Compiler]: https://developers.google.com/closure/compiler/

With the requirements installed, either download the zip file from https://github.com/kogmbh/WebODF/archive/master.zip and unzip it

    wget https://github.com/kogmbh/WebODF/archive/master.zip
    unzip master.zip
    mv WebODF-master webodf

or get the complete repo with git:

    git clone https://github.com/kogmbh/WebODF.git webodf

For building now in the same directory where either of above commands were done the following commands should be entered:

    mkdir build
    cd build
    cmake ../webodf
    make webodf.js-target

A successful run will yield the file "webodf.js" in the subfolder "build/webodf/" (among other things), from where you can then copy it and use for your website.


## Building WebODF on Windows

The following steps have been tested with the Microsoft C\C++ compilers that are installed with Visual Studio 2010. It may be possible to use MinGW but it has not been verified.

* Visual Studio 2010 (or [Visual Studio 2010 Express][] works as well)
* [Visual Studio 2010 Service Pack 1][]
* [Qt 5.2.1 x86 installer](http://download.qt-project.org/official_releases/qt/5.2/5.2.1/qt-opensource-windows-x86-msvc2010-5.2.1.exe) for Visual Studio 2010
* [CMake 2.8.12.2 x86](http://www.cmake.org/files/v2.8/cmake-2.8.12.2-win32-x86.exe)
* [Java Runtime 1.7](http://java.com/en/download/index.jsp) (or more recent)
* [Git for Windows][]

[Visual Studio 2010 Express]: http://www.visualstudio.com/en-us/downloads#d-2010-express
[Visual Studio 2010 Service Pack 1]: http://www.microsoft.com/en-us/download/details.aspx?id=23691
[Git for Windows]: http://msysgit.github.io/

### Visual Studio 2010

We only need the C\C++ compilers but it is easier to get this by installing Visual Studio 2010. It can also be obtained from the Windows 7 SDK but I would
recommend the above. To avoid issues with CMake, [Visual Studio 2010 Service Pack 1][] also needs to be downloaded and installed.

### Git for Windows

[Git][Git for Windows] itself isn't strictly necessary, but some Unix programs like cat are used during the build.
As you will generally need git to download the source, this is easiest way to get the msys utilities.

### Setup PATH variable

Add the following directories to the PATH variable

* CMake path e.g `C:\Program Files (x86)\CMake 2.8\bin`
* QMake path e.g `C:\QtSDK\bin`
* Unix tools path e.g `C:\Program Files (x86)\Git\bin` (Git installer will add this automatically if you select the add Unix tools to PATH option during install)

### Building webodf.js
These commands should be entered from the Visual Studio 2010 command prompt so that msbuild will be added to the PATH

    git clone https://github.com/kogmbh/WebODF.git webodf
    md build
    cd build
    cmake -G "Visual Studio 10" ..\webodf
    msbuild WebODF.sln


## Building WebODF on OSX 10.7.5 (Lion) or OSX 10.9.5 (Mavericks)

Qt5 can be installed via homebrew, but will not be linked by default. CMake must be instructed where to find this package by
specifying the Qt5 location in CMAKE_PATH_PREFIX environment variable:

    cmake -DCMAKE_PREFIX_PATH=/usr/local/Cellar/qt5/5.4.1 ../webodf
    
If the build process returns an error `(libuv) Failed to create kqueue (24)`, 
this can be resolved by increasing the limit on the number of open file descriptors:

    ulimit -n 8192
