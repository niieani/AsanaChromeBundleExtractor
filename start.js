function separateBundle(asanaBundle, unify)
{
    if (typeof unify !== 'undefined' && unify === true) asanaBundle = asanaBundle.replace(/__FILE__\s*?=\s*?/ig, "__FILE__ = ");
    var asanaBundleArray = [];
    var files = asanaBundle.split("__FILE__ = ");
    var regexp = /"([\(\)\w/_\-\.]*?)";/i;
    var index = 0;

    files.forEach(function(file)
    {
        // first part is the comment with MIT License
        if (index !== 0)
        {
            var result = regexp.exec(file);
            var filename = result[1];

            if (filename === "(none)")
                filename = "session-file-" + index + ".js";

            var content = "__FILE__ = " + file;

            asanaBundleArray.push({ name: filename, content: js_beautify(content) });
        }
        else
        {
            asanaBundleArray.push({ name: "LICENSE", content: file });
        }
        index++;
    });

    return asanaBundleArray;
}

Function.prototype.codeize = function()
{
    return /{\s*([^]*)}/i.exec(this.toString())[1];
};

function generateChromeExtension(asanaBundleArray, jQueryContent)
{
    var files = [];
    var background = function(){

chrome.webRequest.onBeforeRequest.addListener(function(details)
    {
        if (details.url.indexOf(".js?cb=") != -1 && details.url.indexOf("&extension=true") == -1)
        {
            console.log("blocking asana's source");
            return {cancel: true};
        }
    },
    {urls: ["*://*.cloudfront.net/*/apps/asana/*"]},
    ["blocking"]
);

    }.codeize();

    var manifest = {
        "manifest_version": 2,
        "name": "Asana Local Bundle",
        "description": "Runs a local copy of Asana's bundle (for hacking)",
        "version": (Math.round(new Date() / 1000 / 60 / 60 / 24) / 10000).toString(), // means: days from epoch / 10000

        "content_scripts": [
            {
                "matches": ["*://*.asana.com/*"],
                "js": [
                    "jquery.js",
                    "start.js"
                ],
                "run_at": "document_idle"
            }
        ],

        "background": {
            "scripts": ["background.js"]
        },

        "web_accessible_resources": [
        ],

        "permissions": [
            "webRequest",
            "webRequestBlocking",
            "*://*.asana.com/*",
            "*://*.cloudfront.net/*/apps/asana/*"
        ]
    };

    var start = function(){

var scripts = $('script');
var foundScript = false;
var followingScripts = "\n";
var lastScriptElement;

scripts.each(function(index)
{
    var jqueryObj = $(this);
    if (jqueryObj.is('[src][charset]'))
    {
        foundScript = true;
    }
    else if (foundScript)
    {
        followingScripts += this.text + "\n";
    }
    lastScriptElement = this;
});

var allScriptsNode = lastScriptElement.parentNode;
var scriptLoadedIndex = -1;

var loadNextScript = function()
{
    scriptLoadedIndex++;
    allScriptsNode.appendChild(scriptNodes[scriptLoadedIndex]);
};

var scriptNodes = [];

files.forEach(function(file){
    var script = document.createElement('script');
    script.src = chrome.extension.getURL(file);
    script.onload = loadNextScript;
    scriptNodes.push(script);
});

var script = document.createElement('script');
script.textContent = followingScripts + "loadClient();";
script.onload = function(){ console.log("Everything loaded, Asana started!") };
scriptNodes.push(script);

loadNextScript();

    }.codeize();

    var startPrefix = "var files = [";

    asanaBundleArray.forEach(function(file){
        startPrefix = startPrefix + "\"" + file.name + "\", ";
        manifest.web_accessible_resources.push(file.name);
    });

    start = startPrefix + "'custom.js'];\n" + start;
    manifest.web_accessible_resources.push('custom.js');

    files.push({ name: "start.js", content: start });
    files.push({ name: "custom.js", content: "\/\/ your custom code goes here" });
    files.push({ name: "background.js", content: background });
    files.push({ name: "manifest.json", content: JSON.stringify(manifest, undefined, 4) });
    files.push({ name: "jquery.js", content: jQueryContent });

    return files.concat(asanaBundleArray);
}

function zipBundle()
{
    var scripts = $('script');

    var foundScript = false;
    var followingScripts = "\n";
    var asanaBundleUrl = "";
    var lastScriptElement;

    scripts.each(function(index)
    {
        var jqueryObj = $(this);
        if (jqueryObj.is('[src][charset]'))
        {
            asanaBundleUrl = jqueryObj.attr("src");
            foundScript = true;
        }
        else if (foundScript)
        {
            followingScripts += this.text + "\n";
        }
        lastScriptElement = this;
    });

    //asanaBundleUrl += "&extension=true";
    //console.log(asanaBundleUrl);

    $.ajax({
        url: asanaBundleUrl,
        beforeSend: function( xhr ) {
            xhr.overrideMimeType( "text/plain; charset=utf-8" );
        }
    }).done(function(data)
    {
        var asanaBundle = data;
        //console.log("Sample of data: \n", data.slice( 0, 200 ) );

        asanaBundle = separateBundle(asanaBundle);
        var extension;
        //asanaBundle = separateBundle(asanaBundle + "\n" + followingScripts);

        $.ajax({
            url: "//code.jquery.com/jquery-2.1.1.min.js",
            beforeSend: function( xhr ) {
                xhr.overrideMimeType( "text/plain; charset=utf-8" );
            }
        }).done(function(jQueryJS)
        {
            extension = generateChromeExtension(asanaBundle, jQueryJS);

            zip.useWebWorkers = false;

            // 1A. create bundle package
            zipModel.addFiles(extension, function (){},
                function (file) { console.log("Zipping file: " + file.name) },
                function (){}).then(
                function(){
                    zipModel.getBlobURL().then(
                        function(url){
                            console.log("Asana Bundle Extension archive: " + url);
                            var script = document.createElement('script');
                            script.textContent = "window.location.href = " + url;
                            document.getElementsByTagName("head")[0].appendChild(script);
                        });
                }
            );
        });

    });
}

zipBundle();