const { shell, ipcRenderer } = require('electron');
const os = require('os');
const $ = require('jquery');

// Only Windows
if (os.platform() === "win32") {
    $("head").append('<link rel="stylesheet" href="css/win.css"></link>');
}

// Tab switch
$('.tab').click(function () {

    $('.tab').attr('data-active', 'false');
    $(this).attr('data-active', 'true');

    $('.tab-content').hide();
    $('.' + $(this).attr('data-show-class')).show();
});


// Shortcuts
$('.send-href').click(function () {
    ipcRenderer.send('open-href', $(this).attr('data-href'));
});

$('#direct').keyup(function(e){
    if (e.keyCode == 13){
        ipcRenderer.send('open-href', $(this).val());
    }
});


// Get the save file directory
var savesdir, mediadir;

ipcRenderer.on('reply-savesdir', (event, arg) => {
    savesdir = arg;

    // Show directory path
    $('#savesdir').html(savesdir).attr('title', savesdir);

    // Open directory on click
    $('#open-savesdir').click(function () {
        shell.openPath(savesdir);
    });
})
ipcRenderer.send('get-savesdir');

// Get the media directory
ipcRenderer.on('reply-mediadir', (event, arg) => {
    mediadir = arg;

    // Show directory path
    $('#mediadir').html(mediadir).attr('title', mediadir);

    // Open directory on click
    $('#open-mediadir').click(function () {
        shell.openPath(mediadir);
    });
})
ipcRenderer.send('get-mediadir');


// Download

$('#download-media').click(function() {
    ipcRenderer.send('media');
})