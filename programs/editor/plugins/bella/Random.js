define("webodf/plugins/bella/Random", ["./seedrandom"], function(seedrandom) {
    "use strict";

    function Random(seed) {
        var random = new seedrandom(seed);

        /**
         * Return a random number between min (included) & max (excluded)
         * @param {number=} min
         * @param {number=} max
         * @returns {!number}
         */
        function getInt(min, max) {
            min = min === undefined ? Number.MIN_VALUE : min;
            max = max === undefined ? Number.MAX_VALUE : max;
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
            // Also http://stackoverflow.com/questions/1527803/generating-random-numbers-in-javascript-in-a-specific-range
            return Math.floor(random() * (max - min) + min);
        }

        this.getInt = getInt;

        function getBool() {
            return random() < .5;
        }

        this.getBool = getBool;

        function getElement(list) {
            var index = getInt(0, list.length);
            return list[index];
        }

        this.getElement = getElement;

        function popListElement(list) {
            var index = getInt(0, list.length),
                item = list[index];
            list.splice(index, -1);
            return item;
        }

        this.popListElement = popListElement;

        function oneIn(chance) {
            return getInt(0, chance) === 0;
        }

        this.oneIn = oneIn;
    }

    return Random;
});