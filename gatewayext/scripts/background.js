
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

    var xhr = new XMLHttpRequest();
    var url = "http://localhost:3727/port";
    var params = `json=${escape(request.json)}`;

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            console.log("Finished request");
        }
    }
    xhr.send(params);

    sendResponse({ response: "OK" });
});