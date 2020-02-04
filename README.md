## WebODF

WebODF is a ODF JavaScript library originally created by KO GmbH.

It makes it easy to add Open Document Format (ODF) support to your website and to your mobile or desktop application. It uses HTML and CSS to display ODF documents.

* Visit the project homepage at: [WebODF](https://webodf.org)
* Want some live demos? Visit: [WebODF Demos](https://webodf.org/demos/)
* Get in contact:
  * Slack: webodf.slack.com, use the [self-invite](https://join.slack.com/t/webodf/shared_invite/enQtNTQ1NDAyNDU1NjY2LWFlZDg1NzBjY2IzY2RmMzhhMTcwZjM1YjJjOTRmMjM4Yzg1MzhjODY5N2MwOWQwMWNiNzhlZTVlYjI3MDY5YTc)
  * [mailing list](https://lists.opendocsociety.org/mailman/listinfo/webodf) or
  * IRC (#webodf auf freenode, [Web access](http://webchat.freenode.net/?nick=webodfcurious_gh&channels=webodf))

### License

WebODF is a Free Software project. All code is available under the AGPL.

If you are interested in using WebODF in your commercial product
(and do not want to disclose your sources / obey AGPL),
get in touch at [the license page](https://webodf.org/about/license.html) for a license suited to your needs.


### Creating webodf.js...

webodf.js is compiled by using the Closure Compiler. This compiler concatenates and compacts all JavaScript files, so that they are smaller and execute faster. CMake is used to setup the buildsystem, so webodf.js can be created:

    git clone https://github.com/kogmbh/WebODF.git webodf
    mkdir build
    cd build
    cmake ../webodf
    make webodf.js-target

A successful run will yield the file "webodf.js" in the subfolder "build/webodf/" (among other things), from where you can then copy it and use for your website.

For more details about preparing the build of webodf.js , e.g. on Windows or OSX, please study ["README-Building.md"](README-Building.md).

### ... and more

This repository not only contains code for the library webodf.js, but also a few products based on it. Here is the complete list:

build target                 | output location (in build/)           | description                        | download/packages
-----------------------------|---------------------------------------|------------------------------------|-----
webodf.js-target             | webodf/webodf.js                      | the library                        | (see product-library)
product-library              | webodf.js-x.y.z.zip                   | zip file with library and API docs | [WebODF homepage](http://webodf.org/download)
product-wodotexteditor       | wodotexteditor-x.y.z.zip              | simple to use editor component     | [WebODF homepage](http://webodf.org/download)
product-wodocollabtexteditor | wodocollabtexteditor-x.y.z.zip        | collaborative editor component     | [WebODF homepage](http://webodf.org/download)
product-firefoxextension     | firefox-extension-odfviewer-x.y.z.xpi | ODF viewer Firefox add-on          | [Mozilla's Add-on website](https://addons.mozilla.org/firefox/addon/webodf/)

("x.y.z" is a placeholder for the actual version number)

For more details about the different products, please study ["README-Products.md"](README-Products.md).
