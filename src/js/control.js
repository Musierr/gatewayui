const { shell, ipcRenderer, remote } = require('electron');
const os = require('os');
const $ = require('jquery');

// Only Windows
if (os.platform() === "win32") {
    $("head").append('<link rel="stylesheet" href="css/win.css">');
}

// Themes
ipcRenderer.on('update-theme', function (e, theme) {
  if (theme == 'light') {
    $('html').attr('class', 'light');
  } else if (theme == 'dark') {
    $('html').attr('class', 'dark');
  }
});

$('.send-toggle-app-theme').click(function () {
    ipcRenderer.send('toggle-app-theme', '');
});

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

$('.send-toggle-auto-scroll').click(function () {
    ipcRenderer.send('toggle-auto-scroll', '');
});

$('#direct').keyup(function (e) {
    if (e.keyCode == 13) {
        ipcRenderer.send('open-href', $(this).val());
    }
});


// Directory
var savesdir, mediadir;

ipcRenderer.on('reply-savesdir', (event, reply) => {
    savesdir = reply;

    $('#savesdir').html(savesdir).attr('title', savesdir);

    $('#open-savesdir').click(function () {
        shell.openPath(savesdir);
    });
})
ipcRenderer.send('get-savesdir');

ipcRenderer.on('reply-mediadir', (event, reply) => {
    mediadir = reply;

    $('#mediadir').html(mediadir).attr('title', mediadir);

    $('#open-mediadir').click(function () {
        shell.openPath(mediadir);
    });
})
ipcRenderer.send('get-mediadir');


// Media
$('#download-media').click(function () {
    ipcRenderer.send('media');
})

ipcRenderer.on('reply-medialist', (event, reply) => {

    $('#uselist').prop('checked', reply.uselist);

    var html = "";
    $.each(reply.userlist, function (index, value) {
        html = html.concat(`<button class="user" data-username="${value}">${value}</button>`);
    });
    $("#userlist").html(html);
    $("#userlist .user").click(function(){
        ipcRenderer.send('remove-userlist', $(this).attr('data-username'));
        ipcRenderer.send('get-medialist');
    })
})
ipcRenderer.send('get-medialist');

$('#uselist').change(function(){
    ipcRenderer.send('toggle-uselist');
});

$('#add-userlist').keyup(function (e) {
    if (e.keyCode == 13) {
        ipcRenderer.send('add-userlist', $(this).val());
        $(this).val("");
        ipcRenderer.send('get-medialist');
    }
});
