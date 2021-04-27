const FS = require('fs'),
    PATH = require('path');

const VERSION = "1.0";

/*
Bazis information:
TextureOrientation: 2-vertical, 1 - horizontal, 0 - no matter
indexes:
        1
   |---------|
 3 | F4  B5  | 2
   |---------|
        0
*/

const Reader = (function () {
    function Reader() { }

    Reader.prototype.run = function () {
        const data = {
            "creator": "BinartiBazisExporter",
            "user": "null",
            "version": "1.0",
            "date": Date.now(),
            "company": "null",
            "list": []
        };
        data.list = this.iterateModel(Model, []);
        return data;
    };

    Reader.prototype.iterateModel = function (obj, result) {

        for (let i = 0; i < obj.Count; i += 1) {

            if (!(obj[i] instanceof TFurnPanel)) {
                if (obj[i].List) {
                    result = this.iterateModel(obj[i], result);
                }
                continue;
            }
            const panel = obj[i];

            const panelData = {
                product: 'rect',
                type: 'element',
                glued: false,
                quantity: 1,
                isRemainder: false,
                getWithOrder: false,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },

                name: panel.Name,
                width: panel.TextureOrientation === 1 ? panel.ContourHeight : panel.ContourWidth,
                height: panel.TextureOrientation === 1 ? panel.ContourWidth : panel.ContourHeight,
                material: {
                    id: null,
                    name: panel.MaterialName
                },
                edgeLeft: this.getEdge('left', panel),
                edgeRight: this.getEdge('right', panel),
                edgeTop: this.getEdge('top', panel),
                edgeBottom: this.getEdge('bottom', panel),
                cuts: [],
                holes: []
            };

            result.push(panelData);
        }

        return result;
    };

    Reader.prototype.getEdge = function (type, panel) {
        let butt = null;
        const buttData = {
            id: null,
            name: null,
            thickness: null,
            width: null
        };
        if (type === 'bottom') {
            butt = this.getButtByElemIndex(panel.Butts, 0);
        } else if (type === 'top') {
            butt = this.getButtByElemIndex(panel.Butts, 1);
        } else if (type === 'left') {
            butt = this.getButtByElemIndex(panel.Butts, 3);
        } else if (type === 'right') {
            butt = this.getButtByElemIndex(panel.Butts, 2);
        }
        if (!butt) return buttData;
        buttData.name = butt.Sign;
        buttData.thickness = butt.Thickness;
        buttData.width = butt.Width;

        return buttData;
    };

    Reader.prototype.getButtByElemIndex = function (butts, elemIndex) {
        let butt = 0;
        for (let i = 0; i < butts.Count; i += 1) {
            if (butts[i].ElemIndex === elemIndex) {
                butt = butts[i];
                break;
            }
        }
        return butt;
    };

    Reader.prototype.saveJSON = function (data) {
        const json = JSON.stringify(data, null, 2);
        system.askWriteTextFile('json', json);
    };

    return new Reader();

})();

Reader.run();
