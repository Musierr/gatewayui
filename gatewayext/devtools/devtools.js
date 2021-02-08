Object.size = function (obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

chrome.devtools.inspectedWindow.eval('console.log("Gateway Extension Loaded")');

chrome.devtools.network.onRequestFinished.addListener(function (request) {

    request.getContent(function (content, encoding) {

        try {
            var jsoncontent = JSON.parse(content);

            if (jsoncontent.globalObjects !== undefined && Object.size(jsoncontent.globalObjects) > 0) {

                chrome.devtools.inspectedWindow.eval('console.log(JSON.parse(unescape("' + escape(content) + '")))');

                chrome.runtime.sendMessage({json: content}, function(response) {});
            }

        } catch (e) {}
    })
});