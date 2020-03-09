let MaxRectsBinPack = require('./packers/MaxRectsBin');
let Trimmer = require('./utils/Trimmer');

class PackProcessor {

    static detectIdentical(rects) {

        let identical = [];
        
        for(let i=0; i<rects.length; i++) {
            let rect1 = rects[i];
            for(let n=i+1; n<rects.length; n++) {
                let rect2 = rects[n];
                if(rect1.image._base64 == rect2.image._base64 && identical.indexOf(rect2) < 0) {
                    rect2.identical = rect1;
                    identical.push(rect2);
                }
            }
        }
        
        for(let rect of identical) {
            rects.splice(rects.indexOf(rect), 1);
        }
        
        return {
            rects: rects,
            identical: identical
        }
    }
    
    static applyIdentical(rects, identical) {
        let clones = [];
        let removeIdentical = [];
        
        for(let item of identical) {
            let ix = rects.indexOf(item.identical);
            if(ix >= 0) {
                let rect = rects[ix];
                
                let clone = Object.assign({}, rect);
                
                clone.name = item.name;
                clone.image = item.image;
                clone.skipRender = true;

                removeIdentical.push(item);
                clones.push(clone);
            }
        }

        for(let item of removeIdentical) {
            identical.splice(identical.indexOf(item), 1);
        }
        
        for(let item of clones) {
            item.cloned = true;
            rects.push(item);
        }
        
        return rects;
    }
    
    /**
     * pack the input images
     * @param {*} images 
     * @param {*} options 
     * @param {*} onComplete 
     * @param {*} onError 
     */
    static pack(images={}, options={}, onComplete=null, onError=null) {

        // let rectsArr = [[]];
        let rects = [];

        let padding = options.padding || 0;
        let extrude = options.extrude || 0;

        let maxWidth = 0, maxHeight = 0;
        let minWidth = 0, minHeight = 0;

        // try{
        //     let a = {};
        //     console.log(a.b.c);
        // }catch(e){
        //     console.error(e.stack);
        // }
    
        let names = Object.keys(images);

        //sort by image area
        names.sort((a, b) => {
            if(images[a].area != images[b].area){
                return images[a].area - images[b].area;
            }else{
                return (images[a].name.length + images[a].nameValue) - (images[b].nameValue + images[b].name.length);
            }
        });

        let width = options.width || 0;
        let height = options.height || 0;

        if(!width) width = maxWidth;
        if(!height) height = maxHeight;

        if (options.powerOfTwo) {
            let sw = Math.round(Math.log(width)/Math.log(2));
            let sh = Math.round(Math.log(height)/Math.log(2));
			
			let pw = Math.pow(2, sw);
            let ph = Math.pow(2, sh);
			
			if(pw < width) pw = Math.pow(2, sw + 1);
			if(ph < height) ph = Math.pow(2, sh + 1);
			
			width = pw;
			height = ph;
        }

        let ic = 0;
        for(let k in images){
            ic += 1;
        }
        // console.error("images: " + ic);
        // console.error("names: " + names.length);
        // console.error("images count:" + names.length);
        
        for(let key of names) {
            let img = images[key];

            maxWidth += img.width;
            maxHeight += img.height;

            if(img.width > minWidth) minWidth = img.width + padding*2 + extrude*2;
            if(img.height > minHeight) minHeight = img.height + padding*2 + extrude*2;

            //check is reach max
            if(width < minWidth || height < minHeight) {
                console.error("cause error image:" + key);
                if(onError) onError({
                    description: "Invalid size. Min: " + minWidth + "x" + minHeight
                });
                return;

                // //add new rect to rectsArr
                // rectsArr.push([]);

                // maxWidth = 0;
                // maxHeight = 0;
                // minWidth = 0;
                // minHeight = 0;
            }

            rects.push({
                frame: {x: 0, y: 0, w: img.width, h: img.height},
                rotated: false,
                trimmed: false,
                spriteSourceSize: {x: 0, y: 0, w: img.width, h: img.height},
                sourceSize: {w: img.width, h: img.height},
                name: key,
                image: img
            });
        }

        // console.log("rects len:" + rects.length);

        if(options.allowTrim) {
            console.log("allowTrim, do trim");
            Trimmer.trim(rects);
        }

        for(let item of rects) {
            item.frame.w += padding*2 + extrude*2;
            item.frame.h += padding*2 + extrude*2;
        }
        
        let identical = [];
        
        if(options.detectIdentical) {
            let res = PackProcessor.detectIdentical(rects);

            rects = res.rects;
            identical = res.identical;
        }

        let packerClass = options.packer || MaxRectsBinPack;
        let packerMethod = options.packerMethod || MaxRectsBinPack.methods.BestShortSideFit;

        console.log(`pack:${options.textureName} packerType: ${packerClass.type} packerMethod: ${packerMethod}`);

        let res = [];

        // console.error("rects length:" + rects.length);

        while(rects.length) {
            //console.log("max w:" + width + " max h:" + height);
            let packer = new packerClass(width, height, options.allowRotation);
            let result = packer.pack(rects, packerMethod);

            for(let item of result) {
                item.frame.x += padding + extrude;
                item.frame.y += padding + extrude;
                item.frame.w -= padding*2 + extrude*2;
                item.frame.h -= padding*2 + extrude*2;
            }

            if(options.detectIdentical) {
                result = PackProcessor.applyIdentical(result, identical);
            }

            // console.log("result length:" + result.length);

            res.push(result);

            for(let item of result) {
                this.removeRect(rects, item.name);
            }
        }

        if(onComplete) {
            onComplete(res);
        }
    }

    static removeRect(rects, name) {
        for(let i=0; i<rects.length; i++) {
            if(rects[i].name == name) {
                rects.splice(i, 1);
                return;
            }
        }
    }
}

module.exports = PackProcessor;