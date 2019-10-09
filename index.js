let getPackerByType = require("./packers/index").getPackerByType;
let getExporterByType = require("./exporters/index").getExporterByType;
let getFilterByType = require("./filters").getFilterByType;
let FilesProcessor = require("./FilesProcessor");
let appInfo = require('./package.json');
let Jimp = require("jimp");
let path = require('path');
let fs = require('fs');
let fse = require('fs-extra');
let chalk = require('chalk');

function copyFolderOrFile(src, dest) {
    fse.copy(src, dest, err => {
        if (err){
            console.log(chalk.redBright(err));
        }

        console.log(chalk.greenBright("copy: " + src + " to: " + dest + " success!"));
    });
}

function isExists(path) {
    return fs.existsSync(path);
}

function getErrorDescription(txt) {
    return appInfo.name + ": " + txt;
}

function fixPath(path) {
    return path.split("\\").join("/");
}

function loadImage(file, files, scale, maxWidth, maxHeight, oversizeList) {
	return Jimp.read(file.contents)
		.then(image => {
            if(image.bitmap.width > maxWidth || image.bitmap.height > maxHeight){
                oversizeList.push(file.dir);
            }else{
                image.scale(scale, Jimp.RESIZE_BEZIER);

                image.name = fixPath(file.path);
                image._base64 = file.contents.toString("base64");
                image.width = image.bitmap.width;
                image.height = image.bitmap.height;
                image.area = image.bitmap.width * image.bitmap.height;
                files[image.name] = image;
            }
		})
		.catch(e => {
			console.error(getErrorDescription("Error reading " + file.path));
		});
}

module.exports = function(images, options, cb) {
	options = options || {};
    options = Object.assign({}, options);
    
    options.textureName = options.textureName === undefined ? "pack-result" : options.textureName;
    options.width = options.width === undefined ? 2048 : options.width;
    options.height = options.height === undefined ? 2048 : options.height;
    options.powerOfTwo = !!options.powerOfTwo;
    options.fixedSize = options.fixedSize === undefined ? false : options.fixedSize;
    options.padding = options.padding === undefined ? 0 : options.padding;
    options.extrude = options.extrude === undefined ? 0 : options.extrude;
    options.allowRotation = options.allowRotation === undefined ? true : options.allowRotation;
    options.detectIdentical = options.detectIdentical === undefined ? true : options.detectIdentical;
    options.allowTrim = options.allowTrim === undefined ? true : options.allowTrim;
    options.trimMode = options.trimMode === undefined ? "trim" : options.trimMode;
    options.removeFileExtension = options.removeFileExtension === undefined ? false : options.removeFileExtension;
    options.prependFolderName = options.prependFolderName === undefined ? true : options.prependFolderName;
    options.textureFormat = options.textureFormat === undefined ? "png" : options.textureFormat;
    options.base64Export = options.base64Export === undefined ? false : options.base64Export;
    options.scale = options.scale === undefined ? 1 : options.scale;
    options.tinify = options.tinify === undefined ? false : options.tinify;
    options.tinifyKey = options.tinifyKey === undefined ? "" : options.tinifyKey;
    options.filter = options.filter === undefined ? "none" : options.filter;

    if(!options.packer) options.packer = "MaxRectsBin";
    if(!options.packerMethod) options.packerMethod = "BestShortSideFit";
    if(!options.exporter) options.exporter = "JsonHash";

    let packer = getPackerByType(options.packer);
    if(!packer) {
        throw new Error(getErrorDescription("Unknown packer " + options.packer));
    }

    let packerMethod = packer.getMethodByType(options.packerMethod);
    if(!packerMethod) {
        throw new Error(getErrorDescription("Unknown packer method " + options.packerMethod));
    }

    let exporter;
    if(typeof options.exporter == "string") {
        exporter = getExporterByType(options.exporter);
    }
    else {
        exporter = options.exporter;
    }
	
	if(!exporter.allowRotation) options.allowRotation = false;
    if(!exporter.allowTrim) options.allowTrim = false;
    
    if(!exporter) {
        throw new Error(getErrorDescription("Unknown exporter " + options.exporter));
    }
    
    let filter = getFilterByType(options.filter);
    if(!filter) {
        throw new Error(getErrorDescription("Unknown filter " + options.filter));
    }

    options.packer = packer;
    options.packerMethod = packerMethod;
    options.exporter = exporter;
    options.filter = filter;
	
	let files = {};
    let p = [];
    let oversizeList = [];
	
	for(let file of images) {
		p.push(loadImage(file, files, options.scale, options.maxSpriteWidth, options.maxSpriteHeight, oversizeList));
    }
    
	Promise.all(p).then(() => {
        //复制超出大小的图片到输出目录
        for(let file of oversizeList){
            console.log(chalk.yellowBright("oversize file:" + file));
            let out = path.resolve(options.outputPath, file.replace(options.inputPath + "\\", ""));
            let outDir = path.dirname(out);
            if(!isExists(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }
            copyFolderOrFile(file, out);
        }

		FilesProcessor.start(files, options, 
			(res) => {
				if(cb) cb(res);
			},
			(error) => {
				console.error(getErrorDescription(error.description));
			});
	});
};