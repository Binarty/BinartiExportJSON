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
                holes: this.getHoles(panel),
                cuts: this.getCuts(panel)
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
        if (panel.TextureOrientation === 1) {
            if (type === 'bottom') {
                butt = this.getButtByElemIndex(panel.Butts, 2);
            } else if (type === 'top') {
                butt = this.getButtByElemIndex(panel.Butts, 3);
            } else if (type === 'left') {
                butt = this.getButtByElemIndex(panel.Butts, 0);
            } else if (type === 'right') {
                butt = this.getButtByElemIndex(panel.Butts, 1);
            }
        } else {
            if (type === 'bottom') {
                butt = this.getButtByElemIndex(panel.Butts, 0);
            } else if (type === 'top') {
                butt = this.getButtByElemIndex(panel.Butts, 1);
            } else if (type === 'left') {
                butt = this.getButtByElemIndex(panel.Butts, 3);
            } else if (type === 'right') {
                butt = this.getButtByElemIndex(panel.Butts, 2);
            }
        }
        if (!butt) return buttData;
        buttData.id = 0; //without id Binarty not load butt
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

    Reader.prototype.getHoles = function(panel){
        const holes = this.getHolesFromPanel(this.allHoles, panel);
        return this.getBinartyHolesFormat(holes, panel);
    };

    Reader.prototype.getBinartyHolesFormat = function(holes, panel){
        const result = [];
        for(let i = 0; i < holes.length; i += 1){
            const h = holes[i];
            const name = 'д' + h.d + 'х' + h.dp;

            const hole = {
                name: name,
                side: '',
                edge: GetEdge(h, panel),
                shortX: GetShortX(h, panel),
                shortY: GetShortY(h, panel),
                status: 'ok',
                specX: '',
                specY: '',
                standard: 'false',
                replacedOnName: '',
                original: '',
                x: Math.round(h.x),
                y: Math.round(h.y),
                params: {
                    name: name,
                    x: Math.round(h.x),
                    y: Math.round(h.y),
                    z: Math.round(h.z),
                    direction: '',
                    depth: h.dp,
                    d: h.d
                }
            }
            result.push(hole);
        }
        function GetEdge(hole, panel){
            let edge;
            if(hole.drillSide === 'left'){
                edge = 'x1';
            } else if(hole.drillSide === 'right'){
                edge = 'x2';
            } else if(hole.drillSide === 'top'){
                edge = 'y1';
            } else if(hole.drillSide === 'bottom'){
                edge = 'y2';
            } else if(hole.drillSide === 'front' || hole.drillSide === 'back'){
                edge = 'x1';
            }
                return edge;
        }
        function GetShortX(hole, panel){
            let shortX;
            if(panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                if (
                    hole.drillSide === 'left' ||
                    hole.drillSide === 'right' ||
                    hole.drillSide === 'front' ||
                    hole.drillSide === 'back'
                ) {
                    shortX = hole.x < panel.ContourWidth ? hole.x : hole.x - panel.ContourWidth;
                } else {
                    shortX = 0;
                }
            }
            return Math.round(shortX);
        }
        function GetShortY(hole, panel){
            let shortY;
            if(panel.TextureOrientation === 0 || panel.TextureOrientation === 2) {
                if (
                    hole.drillSide === 'top' ||
                    hole.drillSide === 'bottom' ||
                    hole.drillSide === 'front' ||
                    hole.drillSide === 'back'
                ) {
                    shortY = hole.y < panel.ContourHeight ? hole.y : hole.y - panel.ContourHeight;
                } else {
                    shortY = 0;
                }
            }
            return Math.round(shortY);
        }
        return result;
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
            console.log(hole.obj.Diameter);
            const holePos = panel.GlobalToObject(hole.position);
            const holeDir = panel.NToObject(hole.direction);

            /*            holeDir
                          T: y=1
                       -------------
               L: x=1  |  F: z=-1  | R: x=-1
                       |  B: z= 1  |
                       -------------
                          B: y=-1               */

            if (holePos.z < -(hole.obj.Depth + panel.Thickness) || holePos.z > (hole.obj.Depth + panel.Thickness)) {
                //если отверстие не касается панели
                continue;
            }
            //Find bores to face or back
            if (Math.round(Math.abs(holeDir.z)) === 1 && panel.Contour.IsPointInside(holePos)) {
                const hy = panel.TextureOrientation === 1 ? holePos.y + MM.minY : panel.ContourHeight - holePos.y + MM.minY;
                if (holeDir.z > 0.001) {
                    const depth = this.rnd2(holePos.z + hole.obj.Depth);
                    if (holePos.z <= 0.001 && depth > 0) {
                        const drillSide = (Math.round(panel.Thickness * 10) > Math.round(depth * 10)) ? 'back' : 'throught';
                        bores.push(new Bore(5, hole.obj.Diameter, holePos.x - MM.minX, hy, 0, depth, drillSide));
                        hole.used = this.isEqualFloat(holePos.z, 0) && (panel.Thickness >= hole.obj.Depth);
                    }
                    continue;
                } else {
                    const depth = hole.obj.Depth - (holePos.z - panel.Thickness);
                    if ((holePos.z - panel.Thickness) >= -0.001 && depth >= 0.001) {
                        const drillSide = (Math.round(panel.Thickness * 10) > Math.round(depth * 10)) ? 'front' : 'throught';
                        bores.push(new Bore(4, hole.obj.Diameter, holePos.x - MM.minX, hy, 0, depth, drillSide));

                        hole.used = this.isEqualFloat(holePos.z, panel.Thickness) && (panel.Thickness >= hole.obj.Depth);
                    }
                    continue;
                }
            }

            //ignore holes width direction to face or back or .. or ..
            if (this.rnd2(holeDir.z) !== 0 || holePos.z <= 0 || holePos.z >= panel.Thickness) continue;
            //??
            let holeEndPos = panel.GlobalToObject(hole.endPosition);

            if (panel.Contour.IsPointInside(holeEndPos)) {
                const hdx = this.rnd2(holeDir.x);
                const hdy = this.rnd2(holeDir.y);
                holeEndPos = panel.GlobalToObject(hole.endPosition);
                for (let j = 0; j < panel.Contour.Count; j++) {
                    const contour = panel.Contour[j];
                    const contourButt = contour.Data && contour.Data.Butt ? contour.Data.Butt : null;
                    const buttThickness = (contourButt && !contourButt.ClipPanel) ? contourButt.Thickness : 0;
                    //console.log(holeEndPos);
                    /*console.log(this.rnd2(contour.DistanceToPoint(holePos) + contour.DistanceToPoint(holeEndPos)),
                        this.rnd2(hole.obj.Depth),
                        this.rnd2(contour.DistanceToPoint(holeEndPos) + buttThickness) > 2);*/
                    if (
                        this.rnd2(contour.DistanceToPoint(holePos) + contour.DistanceToPoint(holeEndPos)) === this.rnd2(hole.obj.Depth) &&
                        this.rnd2(contour.DistanceToPoint(holeEndPos) + buttThickness) > 2
                    ) {
                        const depth = this.rnd2(contour.DistanceToPoint(holeEndPos) + buttThickness);
                        const hy = panel.TextureOrientation === 1 ? holePos.y + MM.minY : panel.ContourHeight - holePos.y + MM.minY;
                        if (hdx === 1) {
                            bores.push(new Bore(2, hole.obj.Diameter, 0, hy, panel.Thickness - holePos.z, depth, 'left'));
                            hole.used = this.isEqualFloat(depth, hole.obj.Depth);
                            break;
                        } else if (hdx === -1) {
                            bores.push(new Bore(3, hole.obj.Diameter, 0, hy, panel.Thickness - holePos.z, depth, 'right'));
                            hole.used = this.isEqualFloat(depth, hole.obj.Depth);
                            break;
                        } else if (hdx === 0) {
                            if (hdy === 1) {
                                bores.push(new Bore(1, hole.obj.Diameter, holePos.x - MM.minX, 0, panel.Thickness - holePos.z, depth, 'bottom'));
                            } else if (hdy === -1) {
                                bores.push(new Bore(0, hole.obj.Diameter, holePos.x - MM.minX, 0, panel.Thickness - holePos.z, depth), 'top');
                            }
                            hole.used = this.isEqualFloat(depth, hole.obj.Depth);
                            break;
                        }
                    }
                }
            }
        }

        /*
        //если спереди ничего нет
        if (part.bFront.length == 0 && part.cFront.length == 0 && (part.bBack.length > 0 || part.cBack.length > 0))
        {
            part.offsetX = part.dl - (part.cl + (MM.minX - panel.GMin.x));
            var te = part.el[2];
            part.el[2] = part.el[3];
            part.el[3] = te;
        */
        /* part.el
        0: OpEdge {name: "Кромка ПВХ, 19/2 мм, Белый, DC 438B, Dollken
        1770", t: 2, w: 19, …}
        allowance: 0
        clipPanel: false
        id: 1
        name: "Кромка ПВХ, 19/2 мм, Белый, DC 438B, Dollken 1770"
        parts: Array(1) [Object]
        sign: "Белый 2/19"
        t: 2
        w: 19*/
        /*           //
        for (let i = 0; i < bores.length; i+=1) {
            const bore = bores[i];
            if(bore.drillSide === 'back') continue;
            switch (bore.plane) {
                case 0:
                case 1:
                    bore.x = panel.ContourWidth - bore.x;
                    bore.z = panel.Thickness - bore.z;
                    break;
                case 2:
                    bore.plane = 3;
                    bore.z = panel.Thickness - bore.z;
                    break;
                case 3:
                    bore.plane = 2;
                    bore.z = panel.Thickness - bore.z;
                    break;
                case 4:
                case 5:
                    bore.x = panel.ContourWidth - bore.x;
                    break;
            }
        }

        for (let i = 0; i < panel.Contour.Count; i+=1) {
            const contour = panel.Contour[i];
            if (contour.path[0].Type !== 3)
                contour.clockOtherWise = !contour.clockOtherWise;
            for (let j = 0; j < contour.path.length; j+=1) {
                const contElement = contour.path[j];
                if (contElement.Type === 1) {
                    contElement.sx = panel.ContourWidth - contElement.sx;
                    contElement.ex = panel.ContourWidth - contElement.ex;
                } else if (contElement.Type === 2) {
                    contElement.sx = panel.ContourWidth - contElement.sx;
                    contElement.ex = panel.ContourWidth - contElement.ex;
                    contElement.cx = panel.ContourWidth - contElement.cx;
                    contElement.dir = !contElement.dir;
                } else if (contElement.Type === 3) {
                    contElement.cx = panel.ContourWidth - contElement.cx;
                }
            }
        }
    }
*/

        return bores;
    };

    Reader.prototype.getCuts = function (panel) {
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

            if (c.Trajectory[0].Pos1.x === c.Trajectory[0].Pos2.x) {
                cut.dir = 'v';
                cut.pos = c.Trajectory[0].Pos1.x;
            } else if (c.Trajectory[0].Pos1.y === c.Trajectory[0].Pos2.y) {
                cut.dir = 'h';
                if (panel.TextureOrientation === 2) {
                    cut.pos = panel.ContourHeight - c.Trajectory[0].Pos1.y;
                } else {
                    cut.pos = c.Trajectory[0].Pos1.y;
                }
            }

            cut.name = c.Name;
            cut.depth = c.Contour.Height;
            cut.width = c.Contour.Width;
            cut.sign = c.Sign;
            cut.side = this.getSideOfGroove(c, Math.round(panel.Thickness));

            result.push(cut);
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

        if (cut.Trajectory[0].Pos1.x !== cut.Trajectory[0].Pos2.x && cut.Trajectory[0].Pos1.y !== cut.Trajectory[0].Pos2.y) {
            result = 3;
        }
        return result;
    };

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
        FS.writeFileSync('./test.json', json);
    };

    Reader.prototype.isEqualFloat = function (v1, v2) {
        return Math.abs(v1 - v2) < 0.001;
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

    Reader.prototype.rnd2 = function (val) {
        let result = parseFloat(val.toFixed(2));
        if (result == -0) {
            result = 0;
        }
        return result;
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
