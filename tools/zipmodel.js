//zip.workerScriptsPath = chrome.extension.getURL("vendor/");

var zipModel = (function ()
{
    var zipFileEntry, zipWriter, writer, creationMethod, URL = webkitURL || mozURL || URL;

    return {
        addFiles: function addFiles(files, oninit, onadd, onprogress)
        {
            return new Promise(function(resolve, reject)
            {
                var addIndex = 0;

                function nextFile()
                {
                    var file = files[addIndex];
                    onadd(file);

                    var filename = file.name;
                    zipWriter.add(filename, new zip.TextReader(file.content), function ()
                    {
                        addIndex++;
                        if (addIndex < files.length)
                        {
                            nextFile();
                        }
                        else
                        {
                            resolve();
                        }
                    }, onprogress);
                }

                function createZipWriter()
                {
                    zip.createWriter(writer, function (writer)
                    {
                        zipWriter = writer;
                        oninit();
                        nextFile();
                    }, onerror);
                }

                if (zipWriter)
                {
                    nextFile();
                }
                else
                {
                    writer = new zip.BlobWriter();
                    createZipWriter();
                }
            });
        },
        getBlobURL: function ()
        {
            return new Promise(function(resolve, reject)
            {
                zipWriter.close(function (blob)
                {
                    var zipBlob = blob.slice(0, blob.size, 'application/zip');
                    var blobURL = URL.createObjectURL(zipBlob);
                    resolve(blobURL);
                    zipWriter = null;
                });
            });
        },
        getBlob: function ()
        {
            return new Promise(function(resolve, reject)
            {
                zipWriter.close(function(blob){
                    resolve(blob);
                    zipWriter = null;
                });
            });
        }
    };
})();
