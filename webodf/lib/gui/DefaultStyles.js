/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global gui */

/**
 * This file contains the default styles for numbered and bulleted lists created by WebODF
 * It is used by the list controller to create the corresponding text:list-style nodes in
 * the document. The list controller decides which of these default styles to use based on user input.
 * Both of these default styles are based off the default numbered and bulleted list styles provided
 * by LibreOffice
 */

/**
 * This is the default style for numbered lists created by WebODF.
 * This has been modified from the LibreOffice style by enabling multi-level list numbering
 * by adding the text:display-level attribute to each styleProperties object.
 * @const
 * @type {!ops.OpAddListStyle.ListStyle}
 */
gui.DefaultNumberedListStyle = [
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "1",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "1.27cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "2",
            "text:display-levels": "2",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "1.905cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "3",
            "text:display-levels": "3",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "2.54cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "4",
            "text:display-levels": "4",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "3.175cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "5",
            "text:display-levels": "5",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "3.81cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "6",
            "text:display-levels": "6",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "4.445cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "7",
            "text:display-levels": "7",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "5.08cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "8",
            "text:display-levels": "8",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "5.715cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "9",
            "text:display-levels": "9",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "6.35cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-number",
        styleProperties: {
            "text:level": "10",
            "text:display-levels": "10",
            "style:num-format": "1",
            "style:num-suffix": ".",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "6.985cm"
                }
            }
        }
    }
];

/**
 * This is the default style for bulleted lists created by WebODF.
 * @const
 * @type {!ops.OpAddListStyle.ListStyle}
 */
gui.DefaultBulletedListStyle = [
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "1",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "1.27cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "2",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "1.905cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "3",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "2.54cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "4",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "3.175cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "5",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "3.81cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "6",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "4.445cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "7",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "5.08cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "8",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "5.715cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "9",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "6.35cm"
                }
            }
        }
    },
    {
        styleType: "text:list-level-style-bullet",
        styleProperties: {
            "text:level": "10",
            "text:bullet-char": "•",
            "style:list-level-properties": {
                "text:list-level-position-and-space-mode": "label-alignment",
                "style:list-level-label-alignment": {
                    "text:label-followed-by": "space",
                    "fo:text-indent": "-0.635cm",
                    "fo:margin-left": "6.985cm"
                }
            }
        }
    }
];