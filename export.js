const FS = require('fs'),
    PATH = require('path');

const VERSION = "1.0";

const Reader = (function () {
    function Reader() {
    }

    Reader.prototype.run = function () {
        Helper.loadSettings();
        this.buildInterface();
    };

    return new Reader();

})();