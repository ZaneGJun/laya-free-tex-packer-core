let Jimp = require("jimp");
let PackProcessor = require("./PackProcessor");
let TextureRenderer = require("./utils/TextureRenderer");
let tinify = require("tinify");
let startExporter = require("./exporters/index").startExporter;

class FilesProcessor {
    
    static start(images, options, callback, errorCallback) {
        //pack images first
        PackProcessor.pack(images, options,
            (res) => {
                let packResult = [];
                let resFiles = [];
                let readyParts = 0;

                //Traversing all packed images
                for(let data of res) {
                    //create the image
                    new TextureRenderer(data, options, (renderResult) => {
                        packResult.push({
                            data: renderResult.data,
                            buffer: renderResult.buffer
                        });

                        if(packResult.length >= res.length) {
                            let ix = 0;
                            for(let item of packResult) {
                                let fName = options.textureName + (packResult.length > 1 ? "_" + ix : "");

                                //pack success, create the resutl texture item
                                FilesProcessor.processPackResultItemTexture(fName, item, options, (files) => {
                                    resFiles = resFiles.concat(files);
                                    readyParts++;
                                    if(readyParts >= packResult.length) {
                                        //create the result conf item(atlas,plist...)
                                        let confFiles = FilesProcessor.processPackResultItemConf(options.textureName, packResult, options);
                                        resFiles = resFiles.concat(confFiles);

                                        callback(resFiles);
                                    }
                                });

                                ix++;
                            }
                        }
                    });
                }
            },
            (error) => {
                if(errorCallback) errorCallback(error);
            });
    }
    
    /**
     * pack the result
     * @param {*} fName 
     * @param {*} item 
     * @param {*} options 
     * @param {*} callback 
     */
    static processPackResultItem(fName, item, options, callback) {
        let files = [];

        let pixelFormat = options.textureFormat == "png" ? "RGBA8888" : "RGB888";
        let mime = options.textureFormat == "png" ? Jimp.MIME_PNG : Jimp.MIME_JPEG;
        let imagePrefix = fName.replace(options.inputPath + "\\", "") + "\\";
        imagePrefix = (imagePrefix.trim().split("\\").join("/"));

        item.buffer.getBuffer(mime, (err, srcBuffer) => {
            FilesProcessor.tinifyImage(srcBuffer, options, (buffer) => {
                let opts = {
                    imageName: fName + "." + options.textureFormat,
                    imageData: buffer.toString("base64"),
                    format: pixelFormat,
                    textureFormat: options.textureFormat,
                    imageWidth: item.buffer.bitmap.width,
                    imageHeight: item.buffer.bitmap.height,
                    removeFileExtension: options.removeFileExtension,
                    prependFolderName: options.prependFolderName,
                    base64Export: options.base64Export,
                    scale: options.scale,
                    appInfo: options.appInfo,
                    trimMode: options.trimMode,
                    imagePrefix: imagePrefix
                };

                if(options.exporter.type == "LayaBox"){
                    opts.imageName = opts.imageName.split('\\').pop();
                }
                
                //call startExporter, create the export file
                files.push({
                    name: fName + "." + options.exporter.fileExt,
                    buffer: new Buffer(startExporter(options.exporter, item.data, opts))
                });

                if(!options.base64Export) {
                    files.push({
                        name: fName + "." + options.textureFormat,
                        buffer: buffer
                    });
                }

                callback(files);
            });
        });
    }

    static processPackResultItemTexture(fName, item, options, callback) {
        let files = [];

        let pixelFormat = options.textureFormat == "png" ? "RGBA8888" : "RGB888";
        let mime = options.textureFormat == "png" ? Jimp.MIME_PNG : Jimp.MIME_JPEG;
        let imagePrefix = fName.replace(options.inputPath + "\\", "") + "\\";
        imagePrefix = (imagePrefix.trim().split("\\").join("/"));

        item.buffer.getBuffer(mime, (err, srcBuffer) => {
            FilesProcessor.tinifyImage(srcBuffer, options, (buffer) => {
                let opts = {
                    imageName: fName + "." + options.textureFormat,
                    imageData: buffer.toString("base64"),
                    format: pixelFormat,
                    textureFormat: options.textureFormat,
                    imageWidth: item.buffer.bitmap.width,
                    imageHeight: item.buffer.bitmap.height,
                    removeFileExtension: options.removeFileExtension,
                    prependFolderName: options.prependFolderName,
                    base64Export: options.base64Export,
                    scale: options.scale,
                    appInfo: options.appInfo,
                    trimMode: options.trimMode,
                    imagePrefix: imagePrefix
                };

                if(options.exporter.type == "LayaBox"){
                    opts.imageName = opts.imageName.split('\\').pop();
                }
                
                //call startExporter, create the export file
                // files.push({
                //     name: fName + "." + options.exporter.fileExt,
                //     buffer: new Buffer(startExporter(options.exporter, item.data, opts))
                // });

                if(!options.base64Export) {
                    files.push({
                        name: fName + "." + options.textureFormat,
                        buffer: buffer
                    });
                }

                callback(files);
            });
        });
    }

    static processPackResultItemConf(fName, packResult, options) {
        let files = [];

        let allDatas = [];
        let idx = 0;
        for(let packItem of packResult) {
            for(let item of packItem.data){
                item.frame.idx = idx;

                allDatas.push(item);
            }

            idx++;
        }

        let pixelFormat = options.textureFormat == "png" ? "RGBA8888" : "RGB888";
        let mime = options.textureFormat == "png" ? Jimp.MIME_PNG : Jimp.MIME_JPEG;
        let imagePrefix = fName.replace(options.inputPath + "\\", "") + "\\";
        imagePrefix = (imagePrefix.trim().split("\\").join("/"));

        let opts = {
            imageName: fName + "." + options.textureFormat,
            // imageData: buffer.toString("base64"),
            format: pixelFormat,
            textureFormat: options.textureFormat,
            // imageWidth: item.buffer.bitmap.width,
            // imageHeight: item.buffer.bitmap.height,
            removeFileExtension: options.removeFileExtension,
            prependFolderName: options.prependFolderName,
            base64Export: options.base64Export,
            scale: options.scale,
            appInfo: options.appInfo,
            trimMode: options.trimMode,
            imagePrefix: imagePrefix
        };

        if(options.exporter.type == "LayaBox"){
            opts.imageName = opts.imageName.split('\\').pop();
        }

        files.push({
            name: fName + "." + options.exporter.fileExt,
            buffer: new Buffer(startExporter(options.exporter, allDatas, opts))
        })

        return files;
    }
    
    static tinifyImage(buffer, options, callback) {
        if(!options.tinify) {
            callback(buffer);
            return;
        }

        tinify.key = options.tinifyKey;

        tinify.fromBuffer(buffer).toBuffer(function(err, result) {
            if (err) throw err;
            callback(result);
        });
    }
}

module.exports = FilesProcessor;