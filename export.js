const FS = require('fs'),
    PATH = require('path');
const { CLIENT_RENEG_WINDOW } = require('tls');

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
    function Reader() {
        this.allHoles;
        this.msg = {
            onlyRectGrooves: true,
            only4mmGrooves: true
        };
    }

    Reader.prototype.run = function () {
        const data = {
            'creator': 'BinartiBazisExporter',
            'user': null,
            'version': '1.0',
            'date': this.getDate(),
            'company': null,
            'list': []
        };
        this.allHoles = this.gatherAllHoles(Model, []);
        data.list = this.iterateModel(Model, []);


        this.saveJSON(data);
    };

    Reader.prototype.gatherAllHoles = function (node, result) {
        for (let i = 0; i < node.Count; i++) {
            let isFurniture = false;
            //по завершению скрипта заменить проверку ниже на более изящное TFastener и проверить как будет работать
            for (let key in node[i]) {
                if (key === 'Holes') {
                    isFurniture = true;
                    break;
                }
            }
            if (!isFurniture) {
                if (node[i].List) {
                    result = this.gatherAllHoles(node[i], result);
                }
                continue;
            }
            for (let j = 0; j < node[i].Holes.Count; j += 1) {
                const hole = node[i].Holes[j];
                result.push(
                    {
                        position: node[i].ToGlobal(hole.Position),
                        endPosition: node[i].ToGlobal(hole.EndPosition()),
                        direction: node[i].NToGlobal(hole.Direction),
                        obj: hole
                    }
                );
            }
        }

        return result;
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
            const width = Math.round(panel.TextureOrientation === 1 ? panel.ContourHeight : panel.ContourWidth);
            const height = Math.round(panel.TextureOrientation === 1 ? panel.ContourWidth : panel.ContourHeight);

            const panelContourOffset = this.getPanelContourOffset(panel.Contour);

            let panelData = {
                product: 'rect',
                type: 'element',
                glued: false,
                quantity: 1,
                name: panel.Name,
                width: width,
                height: height,
                thickness: Math.round(panel.Thickness),
                material: {
                    id: '',
                    name: panel.MaterialName
                },
                edgeLeft: this.getEdge('left', panel),
                edgeRight: this.getEdge('right', panel),
                edgeTop: this.getEdge('top', panel),
                edgeBottom: this.getEdge('bottom', panel),
                cuts: this.getCuts(panel, panelContourOffset, width, height),
                holes: this.getHoles(panel),
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                isRemainder: false,
                getWithOrder: false
            };

            panelData = this.clipPanel(panelData);

            result.push(panelData);
        }

        return result;
    };

    Reader.prototype.getPanelContourOffset = function (contour) {
        const min = contour.Min;
        const max = contour.Max;

        return { x: min.x, y: min.y };
    }

    Reader.prototype.clipPanel = function (data) {

        if (data.edgeLeft.clipPanel) {
            const edgeThickness = data.edgeLeft.thickness;
            if (data.edgeLeft.thickness) data.width = data.width - edgeThickness;

            for (let i = 0; i < data.holes.length; i += 1) {
                const h = data.holes[i];

                if (h.shortY !== 0 && h.shortY !== '') {
                    h.shortY = h.shortY > 0 ? h.shortY - edgeThickness : h.shortY;
                }
                if (h.specY !== 0 && h.specY !== '') {
                    h.specY = h.specY > 0 ? h.specY - edgeThickness : h.specY;
                }
                h.y -= edgeThickness;
                h.params.y -= edgeThickness;
            }
            for (let i = 0; i < data.cuts.length; i += 1) {
                const c = data.cuts[i];
                if (c.y !== 0) c.y -= edgeThickness;
            }
        }

        if (data.edgeRight.clipPanel) {
            const edgeThickness = data.edgeRight.thickness;
            if (data.edgeRight.thickness) data.width = data.width - edgeThickness;

            for (let i = 0; i < data.holes.length; i += 1) {
                const h = data.holes[i];
                if (h.shortY !== 0 && h.shortY !== '') {
                    h.shortY = h.shortY > 0 ? h.shortY : h.shortY + edgeThickness;
                }
                if (h.specY !== 0 && h.specY !== '') {
                    h.specY = h.specY > 0 ? h.specY : h.specY + edgeThickness;
                }
            }
        }

        if (data.edgeTop.clipPanel) {
            const edgeThickness = data.edgeTop.thickness;
            if (data.edgeTop.thickness) data.height = data.height - edgeThickness;

            for (let i = 0; i < data.holes.length; i += 1) {
                const h = data.holes[i];
                if (h.shortX !== 0 && h.shortX !== '') {
                    h.shortX = h.shortX > 0 ? h.shortX - edgeThickness : h.shortX;
                }
                if (h.specX !== 0 && h.specX !== '') {
                    h.specX = h.specX > 0 ? h.specX - edgeThickness : h.specX;
                }
                h.x -= edgeThickness;
                h.params.x -= edgeThickness;
            }
            for (let i = 0; i < data.cuts.length; i += 1) {
                const c = data.cuts[i];
                if (c.x !== 0) c.x -= edgeThickness;
            }
        }

        if (data.edgeBottom.clipPanel) {
            const edgeThickness = data.edgeBottom.thickness;
            if (data.edgeBottom.thickness) data.height = data.height - edgeThickness;

            for (let i = 0; i < data.holes.length; i += 1) {
                const h = data.holes[i];
                if (h.shortX !== 0 && h.shortX !== '') {
                    h.shortX = h.shortX > 0 ? h.shortX : h.shortX + edgeThickness;
                }
                if (h.specX !== 0 && h.specX !== '') {
                    h.specX = h.specX > 0 ? h.specX : h.specX + edgeThickness;
                }
            }
        }

        //round values after clip
        for (let i = 0; i < data.holes.length; i += 1) {
            const h = data.holes[i];
            if (h.shortX !== '') {
                h.shortX = Math.round(h.shortX);
            }
            if (h.shortY !== '') {
                h.shortY = Math.round(h.shortY);
            }
            if (h.specX !== '') {
                h.specX = Math.round(h.specX);
            }
            if (h.specY !== '') {
                h.specY = Math.round(h.specY);
            }
            h.x = Math.round(h.x);
            h.y = Math.round(h.y);
            h.params.x = Math.round(h.params.x);
            h.params.y = Math.round(h.params.y);
        }
        data.width = Math.round(data.width);
        data.height = Math.round(data.height);

        return data;
    };

    Reader.prototype.getEdge = function (type, panel) {
        let butt = null;
        const buttData = {
            id: null,
            name: null,
            thickness: null,
            width: null,
            clipPanel: null
        };

        if (panel.TextureOrientation === 1) {
            if (type === 'bottom') {
                butt = this.getButtByElemIndex(panel.Butts, 1);
            } else if (type === 'top') {
                butt = this.getButtByElemIndex(panel.Butts, 3);
            } else if (type === 'left') {
                butt = this.getButtByElemIndex(panel.Butts, 0);
            } else if (type === 'right') {
                butt = this.getButtByElemIndex(panel.Butts, 2);
            }
        } else {
            if (type === 'bottom') {
                butt = this.getButtByElemIndex(panel.Butts, 0);
            } else if (type === 'top') {
                butt = this.getButtByElemIndex(panel.Butts, 2);
            } else if (type === 'left') {
                butt = this.getButtByElemIndex(panel.Butts, 3);
            } else if (type === 'right') {
                butt = this.getButtByElemIndex(panel.Butts, 1);
            }
        }
        if (!butt) return buttData;
        buttData.id = 0; //without id Binarty not load butt
        buttData.name = butt.Sign;
        buttData.thickness = butt.Thickness;
        buttData.width = butt.Width;
        buttData.clipPanel = butt.ClipPanel;

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

    Reader.prototype.getHoles = function (panel) {
        const holes = this.getHolesFromPanel(this.allHoles, panel);
        return this.getBinartyHolesFormat(holes, panel);
    };

    Reader.prototype.getHolesFromPanel = function (holes, panel) {
        const MM = this.getMinMax(panel);
        const bores = [];

        function Bore(plane, d, x, y, z, dp, drillSide) {
            this.plane = plane;
            this.d = d;
            this.x = x;
            this.y = y;
            this.z = z;
            this.dp = dp;
            this.drillSide = drillSide;
        }

        for (let i = 0; i < holes.length; i += 1) {
            const hole = holes[i];

            const holeDir = panel.NToObject(hole.direction);

            const holePos = panel.GlobalToObject(hole.position);
            //holePos.x -= panel.Contour.Min.x;
            //holePos.y -= panel.Contour.Min.y;

            const holeEndPos = panel.GlobalToObject(hole.endPosition);
            //holeEndPos.x -= panel.Contour.Min.x;
            //holeEndPos.y -= panel.Contour.Min.y;

            if (holePos.z < -(hole.obj.Depth + panel.Thickness) || holePos.z > (hole.obj.Depth + panel.Thickness)) {
                //если отверстие не касается панели
                continue;
            }
            //Find bores to face or back
            if (Math.round(Math.abs(holeDir.z)) === 1 && this.isPointInsidePanel(hole.position, panel)) {
                if (holeDir.z > 0.001) {
                    const depth = this.rnd2(holePos.z + hole.obj.Depth);
                    if (holePos.z <= 0.001 && depth > 0) {
                        const drillSide = (Math.round(panel.Thickness * 10) > Math.round(depth * 10)) ? 'back' : 'throught';
                        bores.push(new Bore(5, hole.obj.Diameter, holePos.x - MM.minX, holePos.y - MM.minY, 0, depth, drillSide));
                        hole.used = this.isEqualFloat(holePos.z, 0) && (panel.Thickness >= hole.obj.Depth);
                    }
                    continue;
                } else {
                    const depth = hole.obj.Depth - (holePos.z - panel.Thickness);
                    if ((holePos.z - panel.Thickness) >= -0.001 && depth >= 0.001) {
                        const drillSide = (Math.round(panel.Thickness * 10) > Math.round(depth * 10)) ? 'front' : 'throught';
                        bores.push(new Bore(4, hole.obj.Diameter, holePos.x - MM.minX, holePos.y - MM.minY, 0, depth, drillSide));
                        hole.used = this.isEqualFloat(holePos.z, panel.Thickness) && (panel.Thickness >= hole.obj.Depth);
                    }
                    continue;
                }
            }

            //ignore holes width direction to face or back or .. or ..
            if (this.rnd2(holeDir.z) !== 0 || holePos.z <= 0 || holePos.z >= panel.Thickness) continue;


            if (this.isPointInsidePanel(hole.endPosition, panel)) {

                const hdx = this.rnd2(holeDir.x);
                const hdy = this.rnd2(holeDir.y);

                for (let j = 0; j < panel.Contour.Count; j++) {
                    const contour = panel.Contour[j];
                    const contourButt = contour.Data && contour.Data.Butt ? contour.Data.Butt : null;
                    const buttThickness = (contourButt && !contourButt.ClipPanel) ? contourButt.Thickness : 0;
                    if (
                        this.rnd2(contour.DistanceToPoint(holePos) + contour.DistanceToPoint(holeEndPos)) === this.rnd2(hole.obj.Depth) &&
                        this.rnd2(contour.DistanceToPoint(holeEndPos) + buttThickness) > 2
                    ) {

                        const depth = this.rnd2(contour.DistanceToPoint(holeEndPos) + buttThickness);
                        if (hdx === 1) {
                            bores.push(new Bore(2, hole.obj.Diameter, 0, holePos.y - MM.minY, panel.Thickness - holePos.z, depth, 'left'));
                            hole.used = this.isEqualFloat(depth, hole.obj.Depth);
                            break;
                        } else if (hdx === -1) {
                            const width = panel.TextureOrientation === 1 ? panel.ContourWidth : panel.ContourWidth;
                            bores.push(new Bore(3, hole.obj.Diameter, width, holePos.y - MM.minY, panel.Thickness - holePos.z, depth, 'right'));
                            hole.used = this.isEqualFloat(depth, hole.obj.Depth);
                            break;
                        } else if (hdx === 0) {
                            if (hdy === 1) {
                                bores.push(new Bore(1, hole.obj.Diameter, holePos.x - MM.minX, 0, panel.Thickness - holePos.z, depth, 'bottom'));
                            } else if (hdy === -1) {
                                const height = panel.TextureOrientation === 1 ? panel.ContourHeight : panel.ContourHeight;
                                bores.push(new Bore(0, hole.obj.Diameter, holePos.x - MM.minX, height, panel.Thickness - holePos.z, depth, 'top'));
                            }
                            hole.used = this.isEqualFloat(depth, hole.obj.Depth);
                            break;
                        }
                    }
                }
            }
        }

        return bores;
    };

    Reader.prototype.getBinartyHolesFormat = function (holes, panel) {
        const result = [];
        for (let i = 0; i < holes.length; i += 1) {
            const h = holes[i];
            const code = 'д' + Math.round(h.d) + 'х' + Math.round(h.dp);

            const hole = {
                code: code,
                side: h.plane === 5 ? 'Т' : 'Л',
                edge: GetEdge(h, panel),
                shortX: GetShortX(h, panel),
                shortY: GetShortY(h, panel),
                status: 'ok',
                specX: GetShortX(h, panel),
                specY: GetShortY(h, panel),
                standard: 'false',
                x: GetX(h, panel),
                y: GetY(h, panel),
                old: h,
                params: {
                    name: code,
                    x: GetX(h, panel),
                    y: GetY(h, panel),
                    z: GetZ(h, panel),
                    direction: GetDirection(h, panel),
                    depth: Math.round(h.dp),
                    d: Math.round(h.d)
                }
            }
            result.push(hole);
        }
        function GetEdge(hole, panel) {
            let edge;
            if (panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                if (hole.drillSide === 'left') {
                    edge = 'x1';
                } else if (hole.drillSide === 'right') {
                    edge = 'x2';
                } else if (hole.drillSide === 'top') {
                    edge = 'y1';
                } else if (hole.drillSide === 'bottom') {
                    edge = 'y2';
                } else if (hole.drillSide === 'front' || hole.drillSide === 'back') {
                    const minX = hole.x,
                        maxX = Math.abs(panel.ContourWidth - hole.x),
                        minY = hole.y,
                        maxY = Math.abs(panel.ContourHeight - hole.y);
                    const min = Math.min(minX, maxX, minY, maxY);
                    if (min === minX) {
                        edge = 'x1';
                    } else if (min === maxX) {
                        edge = 'x2';
                    } else if (min === minY) {
                        edge = 'y2';
                    } else if (min === maxY) {
                        edge = 'y1';
                    }
                }
            } else {
                if (hole.drillSide === 'left') {
                    edge = 'y1';
                } else if (hole.drillSide === 'right') {
                    edge = 'y2';
                } else if (hole.drillSide === 'top') {
                    edge = 'x2';
                } else if (hole.drillSide === 'bottom') {
                    edge = 'x1';
                } else if (hole.drillSide === 'front' || hole.drillSide === 'back') {
                    const minX = hole.x,
                        maxX = Math.abs(panel.ContourWidth - hole.x),
                        minY = hole.y,
                        maxY = Math.abs(panel.ContourHeight - hole.y);
                    const min = Math.min(minX, maxX, minY, maxY);
                    if (min === minX) {
                        edge = 'y1';
                    } else if (min === maxX) {
                        edge = 'y2';
                    } else if (min === minY) {
                        edge = 'x1';
                    } else if (min === maxY) {
                        edge = 'x2';
                    }
                }
            }
            return edge;
        }
        function GetX(hole, panel) {
            let x;
            if (panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                x = panel.ContourHeight - hole.y;
            } else {
                x = hole.x;
                // if(x === 0){
                //     if(hole.plane === 3){
                //
                //     }
                // }
            }
            return Math.round(x);
        }
        function GetY(hole, panel) {
            let y;
            if (panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                y = hole.x;
            } else {
                y = hole.y;
            }
            return Math.round(y);
        }
        function GetZ(hole, panel) {
            let z = hole.z;
            if (hole.drillSide === 'front') {
                z = panel.Thickness;
            } else if (hole.drillSide === 'back') {
                z = 0;
            }
            return Math.round(z);
        }
        function GetShortX(hole, panel) {
            let shortX;
            if (panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                if (
                    hole.drillSide === 'left' ||
                    hole.drillSide === 'right' ||
                    hole.drillSide === 'front' ||
                    hole.drillSide === 'back' ||
                    hole.drillSide === 'throught'
                ) {
                    shortX = hole.y < panel.ContourHeight / 2 ? -hole.y : panel.ContourHeight - hole.y;
                } else {
                    shortX = 0;
                }
            } else {
                if (
                    hole.drillSide === 'top' ||
                    hole.drillSide === 'bottom' ||
                    hole.drillSide === 'front' ||
                    hole.drillSide === 'back' ||
                    hole.drillSide === 'throught'
                ) {
                    shortX = hole.x < panel.ContourWidth / 2 ? hole.x : -(panel.ContourWidth - hole.x);
                } else {
                    shortX = 0;
                }
            }
            shortX = Math.round(shortX);
            shortX = shortX === 0 ? '' : shortX;

            return shortX;
        }
        function GetShortY(hole, panel) {
            let shortY;
            if (panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                if (
                    hole.drillSide === 'top' ||
                    hole.drillSide === 'bottom' ||
                    hole.drillSide === 'front' ||
                    hole.drillSide === 'back' ||
                    hole.drillSide === 'throught'
                ) {
                    shortY = hole.x < panel.ContourWidth / 2 ? hole.x : hole.x - panel.ContourWidth;
                } else {
                    shortY = 0;
                }
            } else {
                if (
                    hole.drillSide === 'left' ||
                    hole.drillSide === 'right' ||
                    hole.drillSide === 'front' ||
                    hole.drillSide === 'back' ||
                    hole.drillSide === 'throught'
                ) {
                    shortY = hole.y < panel.ContourHeight / 2 ? hole.y : -(panel.ContourHeight - hole.y);
                } else {
                    shortY = 0;
                }
            }
            shortY = Math.round(shortY);
            shortY = shortY === 0 ? '' : shortY;
            return shortY;
        }
        function GetDirection(hole, panel) {
            let dir;
            if (panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                if (hole.drillSide === 'front') {
                    dir = '-z';
                } else if (hole.drillSide === 'back') {
                    dir = 'z';
                } else if (hole.drillSide === 'left') {
                    dir = 'y';
                } else if (hole.drillSide === 'right') {
                    dir = '-y';
                } else if (hole.drillSide === 'top') {
                    dir = '-x';
                } else if (hole.drillSide === 'bottom') {
                    dir = 'x';
                }
                return dir;
            } else {
                if (hole.drillSide === 'front') {
                    dir = '-z';
                } else if (hole.drillSide === 'back') {
                    dir = 'z';
                } else if (hole.drillSide === 'left') {
                    dir = 'x';
                } else if (hole.drillSide === 'right') {
                    dir = '-x';
                } else if (hole.drillSide === 'top') {
                    dir = '-y';
                } else if (hole.drillSide === 'bottom') {
                    dir = 'y';
                }
                return dir;
            }
        }

        return result;
    };

    Reader.prototype.getMinMax = function (node) {
        let minX = 1000000;
        let minY = 1000000;
        let maxX = -1000000;
        let maxY = -1000000;
        if (node.Contour.Count > 0) {
            for (let i = 0; i < node.Contour.Count; i += 1) {
                const contour = node.Contour[i];
                if (contour.ElType === 1) {
                    minX = Math.min(minX, contour.Pos1.x);
                    minY = Math.min(minY, contour.Pos1.y);
                    maxX = Math.max(maxX, contour.Pos1.x);
                    maxY = Math.max(maxY, contour.Pos1.y);
                    minX = Math.min(minX, contour.Pos2.x);
                    minY = Math.min(minY, contour.Pos2.y);
                    maxX = Math.max(maxX, contour.Pos2.x);
                    maxY = Math.max(maxY, contour.Pos2.y);
                } else if (contour.ElType === 2) {

                    if (contour.AngleOnArc(Math.PI)) {
                        minX = Math.min(minX, contour.Center.x - contour.ArcRadius());
                    } else {
                        minX = Math.min(minX, contour.Pos1.x);
                        minX = Math.min(minX, contour.Pos2.x);
                    }

                    if (contour.AngleOnArc(0) || contour.AngleOnArc(Math.PI * 2.0)) {
                        maxX = Math.max(maxX, contour.Center.x + contour.ArcRadius());
                    } else {
                        maxX = Math.max(maxX, contour.Pos1.x);
                        maxX = Math.max(maxX, contour.Pos2.x);
                    }
                    if (contour.AngleOnArc((Math.PI * 3.0) / 2.0)) {
                        minY = Math.min(minY, contour.Center.y - contour.ArcRadius());
                    } else {
                        minY = Math.min(minY, contour.Pos1.y);
                        minY = Math.min(minY, contour.Pos2.y);
                    }
                    if (contour.AngleOnArc(Math.PI / 2.0)) {
                        maxY = Math.max(maxY, contour.Center.y + contour.ArcRadius());
                    } else {
                        maxY = Math.max(maxY, contour.Pos1.y);
                        maxY = Math.max(maxY, contour.Pos2.y);
                    }
                } else if (elem.ElType === 3) {
                    minX = Math.min(minX, contour.Center.x - contour.CirRadius);
                    minY = Math.min(minY, contour.Center.y - contour.CirRadius);
                    maxX = Math.max(maxX, contour.Center.x + contour.CirRadius);
                    maxY = Math.max(maxY, contour.Center.y + contour.CirRadius);
                }
            }
        } else {
            minX = node.GMin.x;
            minY = node.GMin.y;
            maxX = node.GMax.x;
            maxY = node.GMax.y;
        }


        return {
            minX: minX,
            minY: minY,
            maxX: maxX,
            maxY: maxY
        };
    };

    Reader.prototype.getCuts = function (panel, panelContourOffset, panelWidth, panelHeight) {
        let cuts = this.getCutsFromPanel(panel, panelContourOffset, panelWidth, panelHeight);

        cuts = this.getBinartyCutsFormat(cuts, panel);

        return cuts;
    };

    Reader.prototype.getCutsFromPanel = function (panel, panelContourOffset, panelWidth, panelHeight) {
        const result = [];

        for (let i = 0; i < panel.Cuts.Count; i += 1) {
            const c = panel.Cuts[i],
                cut = {};
            if (!c.Trajectory || !c.Trajectory.Count) continue;

            const grooveRect = this.checkGrooveOnRect(c);

            if (grooveRect > 0) {
                if (this.msg.onlyRectGrooves) {
                    alert('Выгружены будут только прямолинейные пазы');
                    this.msg.onlyRectGrooves = false;
                }
                continue;
            }

            if (c.Contour.Width !== 4) {
                if (this.msg.only4mmGrooves) {
                    alert('Пазы, шириной больше или меньше 4мм выгружены не будут');
                    this.msg.only4mmGrooves = false;
                }
                continue;
            }

            const contourOffset = this.getContourOffset('x', c);

            if (this.roundTo2(c.Trajectory[0].Pos1.x) === this.roundTo2(c.Trajectory[0].Pos2.x)) {
                cut.dir = 'v';
                cut.pos = c.Trajectory[0].Pos1.x + contourOffset - panelContourOffset.x;
            } else if (this.roundTo2(c.Trajectory[0].Pos1.y) === this.roundTo2(c.Trajectory[0].Pos2.y)) {
                cut.dir = 'h';

                if (panel.TextureOrientation === 2) {
                    cut.pos = this.round(panel.ContourHeight - (c.Trajectory[0].Pos1.y + contourOffset - panelContourOffset.y));
                } else {
                    cut.pos = this.roundTo2(c.Trajectory[0].Pos1.y + contourOffset - panelContourOffset.y);
                }
            }

            // cut.pos = Math.abs(cut.pos);
            cut.name = c.Name;
            cut.depth = c.Contour.Height;
            cut.width = c.Contour.Width;
            cut.sign = c.Sign;
            cut.side = this.getSideOfGroove(c, Math.round(panel.Thickness));

            result.push(cut);
        }
        return result;
    };

    Reader.prototype.getBinartyCutsFormat = function (cuts, panel) {
        const result = [];
        for (let i = 0; i < cuts.length; i += 1) {
            const c = cuts[i];

            const cut = {
                name: 'Groove',
                x: GetX(c, panel),
                y: GetY(c, panel),
                direction: c.side === 'front' ? '-z' : 'z',
                depth: c.depth,
                width: c.width
            };
            result.push(cut);
        }
        function GetX(cut, panel) {
            let x;
            if (panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                if (cut.dir === 'v') {
                    x = 0;
                } else {
                    x = Math.round(cut.pos);
                }
            } else {
                if (cut.dir === 'v') {
                    x = Math.round(cut.pos);
                } else {
                    x = 0;
                }
            }
            return x;
        }
        function GetY(cut, panel) {
            let y;
            if (panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                if (cut.dir === 'v') {
                    y = Math.round(cut.pos);
                } else {
                    y = 0;
                }
            } else {
                if (cut.dir === 'v') {
                    y = 0;
                } else {
                    y = Math.round(cut.pos);
                }
            }
            return y;
        }
        return result;
    };

    Reader.prototype.checkGrooveOnRect = function (cut) {
        let result = 0;
        for (let i = 0; i < cut.Contour.Count; i += 1) {
            const contour = cut.Contour[i];
            if (contour.ElType !== 1) {
                result = 1;
                break;
            }
            if (
                contour.ElType === 1 &&
                !(this.isEqualFloat(contour.Pos1.x, contour.Pos2.x) || this.isEqualFloat(contour.Pos1.y, contour.Pos2.y))
            ) {
                result = 2;
                break;
            }
        }

        if (
            this.roundTo2(cut.Trajectory[0].Pos1.x) !== this.roundTo2(cut.Trajectory[0].Pos2.x) &&
            this.roundTo2(cut.Trajectory[0].Pos1.y) !== this.roundTo2(cut.Trajectory[0].Pos2.y)
        ) {
            result = 3;
        }
        return result;
    };

    Reader.prototype.getContourOffset = function (dimension, cut) {
        let result = 0;

        let max = -Infinity, min = Infinity;

        for (let i = 0; i < cut.Contour.Count; i += 1) {
            const contour = cut.Contour[i];
            if (dimension === 'x') {
                max = Math.max(contour.Pos1.x, contour.Pos2.x, max);
                min = Math.min(contour.Pos1.x, contour.Pos2.x, min);
            } else {
                max = Math.max(contour.Pos1.y, contour.Pos2.y, max);
                min = Math.min(contour.Pos1.y, contour.Pos2.y, min);
            }
        }
        result = min + (max - min) / 2;

        return result;
    }

    Reader.prototype.getSideOfGroove = function (cut, panelThickness) {
        let result;
        let cMinX = Infinity,
            cMaxX = -Infinity,
            cMinY = Infinity,
            cMaxY = -Infinity;

        if (cut.Contour.Max) {
            cMinX = cut.Contour.Min.x;
            cMaxX = cut.Contour.Max.x;
            cMinY = cut.Contour.Min.y;
            cMaxY = cut.Contour.Max.y;
        } else {
            for (let i = 0; i < cut.Contour.Count; i += 1) {
                const contour = cut.Contour[i];
                if (contour.ElType === 1 || contour.ElType === 2) {
                    if (cMinX > contour.Pos1.x)
                        cMinX = contour.Pos1.x;
                    else if (cMaxX < contour.Pos1.x)
                        cMaxX = contour.Pos1.x;
                    if (cMinY > contour.Pos1.y)
                        cMinY = contour.Pos1.y;
                    else if (cMaxY < contour.Pos1.y)
                        cMaxY = contour.Pos1.y;
                    if (cMinX > contour.Pos2.x)
                        cMinX = contour.Pos2.x;
                    else if (cMaxX < contour.Pos2.x)
                        cMaxX = contour.Pos2.x;
                    if (cMinY > contour.Pos2.y)
                        cMinY = contour.Pos2.y;
                    else if (cMaxY < contour.Pos2.y)
                        cMaxY = contour.Pos2.y;
                } else if (contour.ElType === 3) {
                    if (cMinX > (contour.Center.x - contour.CirRadius))
                        cMinX = contour.Center.x - contour.CirRadius;
                    else if (cMaxX < (contour.Center.x + contour.CirRadius))
                        cMaxX = contour.Center.x + contour.CirRadius;
                    if (cMinY > (contour.Center.y - contour.CirRadius))
                        cMinY = contour.Center.y - contour.CirRadius;
                    else if (cMaxY < (contour.Center.y + contour.CirRadius))
                        cMaxY = contour.Center.y + contour.CirRadius;
                } else {
                    alert('Неизвестный элемент траектории');
                }

            }
        }


        if (cMaxY >= (panelThickness - 0.001)) {
            result = 'front';
        } else if (cMinY <= 0.001) {
            result = 'back';
        }
        return result;
    };

    Reader.prototype.saveJSON = function (data) {
        //set all values to string
        let json = JSON.stringify(data);
        json = JSON.parse(json, (key, val) => {
            let res = val;
            if (typeof val !== 'object') {

                res = String(val)

            } else if (val === null) {
                res = 'null';
            }
            return res;
        });
        json = JSON.stringify(json);

        //save
        const path = system.askFileNameSave('json');
        if (path) {
            FS.writeFileSync(path, json);
        }
    };

    Reader.prototype.isEqualFloat = function (v1, v2) {
        return Math.abs(v1 - v2) < 0.001;
    };

    Reader.prototype.roundTo2 = function (number) {
        return Math.round(parseFloat(number) * 100) / 100;
    };

    Reader.prototype.rnd2 = function (val) {
        let result = parseFloat(val.toFixed(2));
        if (result == -0) {
            result = 0;
        }
        return result;
    };

    Reader.prototype.isPointInsidePanel = function (point, panel) {
        const cMin = panel.ToGlobal({ x: panel.Contour.Min.x, y: panel.Contour.Min.y });
        const cMax = panel.ToGlobal({ x: panel.Contour.Max.x, y: panel.Contour.Max.y });
        cMin.x = Math.round(cMin.x);
        cMin.y = Math.round(cMin.y);
        cMin.z = Math.round(cMin.z);
        cMax.x = Math.round(cMax.x);
        cMax.y = Math.round(cMax.y);
        cMax.z = Math.round(cMax.z);

        const x = Math.round(point.x);
        const y = Math.round(point.y);
        const z = Math.round(point.z);

        let res = false;
        if (cMin.x === cMax.x) {
            if (
                ((y >= cMin.y && y <= cMax.y) || (y <= cMin.y && y >= cMax.y)) &&
                ((z >= cMin.z && z <= cMax.z) || (z <= cMin.z && z >= cMax.z))
            ) {
                res = true;
            }
        } else if (cMin.y === cMax.y) {
            if (
                ((x >= cMin.x && x <= cMax.x) || (x <= cMin.x && x >= cMax.x)) &&
                ((z >= cMin.z && z <= cMax.z) || (z <= cMin.z && z >= cMax.z))
            ) {
                res = true;
            }
        } else if (cMin.z === cMax.z) {
            if (
                ((x >= cMin.x && x <= cMax.x) || (x <= cMin.x && x >= cMax.x)) &&
                ((y >= cMin.y && y <= cMax.y) || (y <= cMin.y && y >= cMax.y))
            ) {
                res = true;
            }
        } else {
            if (
                ((x >= cMin.x && x <= cMax.x) || (x <= cMin.x && x >= cMax.x)) &&
                ((y >= cMin.y && y <= cMax.y) || (y <= cMin.y && y >= cMax.y)) &&
                ((z >= cMin.z && z <= cMax.z) || (z <= cMin.z && z >= cMax.z))
            ) {
                res = true;
            }
        }

        return res;
    };

    Reader.prototype.getDate = function () {
        const date = new Date();
        let day = date.getDate();
        let month = date.getMonth();
        month = month + 1;
        if ((String(day)).length === 1)
            day = '0' + day;
        if ((String(month)).length === 1)
            month = '0' + month;

        return day + '.' + month + '.' + date.getFullYear();
    };

    return new Reader();

})();

Reader.run();