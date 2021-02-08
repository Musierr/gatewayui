// Electron
const { app, BrowserWindow, session, dialog, ipcMain, shell } = require('electron');
const path = require('path');

// Express
const express = require('express');
const bodyParser = require('body-parser');
const { url } = require('inspector');

// Electron Store
const Store = require('electron-store');
const store = new Store({ name: 'saves' });

// Merge json
const merge = require("merge-json");

// Filesystem
const fs = require('fs');

// Electron File Download
const electrondl = require('electron-dl');

// First run
const firstRun = require('electron-first-run');
const devtoolsExtensionNotice = firstRun({name: 'devtools-extension-notice'});

// Process
const process = require('process');

// Prepare Save File
if (store.get('version') == undefined || store.get('saves') == undefined) {
    store.set('version', 0);
    store.set('saves', {});
}

// Directory Constants
const savesdir = store.path;
const mediadir = path.join(app.getPath('userData'), 'media');

// Create Mediadir if not exists
if (!fs.existsSync(mediadir)) fs.mkdirSync(mediadir);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

// Loop count
Object.size = function (obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

// Server ------------------------------------------------------------------------------------------------

const server = express();
const router = express.Router();

server.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
server.use(bodyParser.json());

server.get('/', (request, response) => {
    response.send("This response was issued by gatewayui, please don't mess up with this port.");
});

server.post('/port', (request, response) => {

    try {
        var jsonparsed = JSON.parse(request.body.json).globalObjects;
        var jsonstored = store.get('saves');

        store.set('saves', merge.merge(jsonparsed, jsonstored));

        var vcount = store.get('version');
        vcount++;
        store.set('version', vcount);

        response.sendStatus(200);

    } catch (e) {

        console.log(request.body.json, e);

        response.sendStatus(400);
    }
});

server.use("/", router);

const host = 'localhost';
const port = 3727;

server.listen(port, host, () => {});

const createWindow = () => {

    // Media Download ------------------------------------------------------------------------------------

    ipcMain.on('media', async (event) => {

        dialog.showMessageBox({
            type: "info",
            message: "The download will start",
            detail: "You will see the downloaded files at " + mediadir,
            buttons: ["Open Directory", "Close"],
            cancelId: 1
        }).then((response) => {
            if (response.response == 0) {
                shell.openPath(mediadir);
            }
        });

        var saves = store.get('saves');
        var tweets = saves.tweets;
        var users = saves.users;

        if (tweets === undefined || users === undefined) return;

        for (var tweetkey in tweets) {

            if (!tweets.hasOwnProperty(tweetkey)) continue;
            var this_tweet = tweets[tweetkey];

            if (this_tweet.withheld_scope !== undefined || this_tweet.withheld_copyright !== undefined) continue;

            var this_tweet_id = this_tweet.id_str;
            var this_tweet_author_id = this_tweet.user_id_str;
            var this_tweet_author_username = users[this_tweet_author_id].screen_name;
            if (this_tweet_author_username === undefined) { this_tweet_author_username = 'unknown'; };

            if (this_tweet.retweeted_status_id_str !== undefined) {
                this_tweet_id = this_tweet.retweeted_status_id_str;
                this_tweet_author_username = /RT @([a-zA-Z0-9_]{1,15}):[\s\S]*/gi.exec(this_tweet.full_text)[1];
            }

            if (this_tweet.entities.media === undefined) continue;
            var this_tweet_media = this_tweet.entities.media;

            var this_tweet_isvideo_skip = false;

            for (var mediakey in this_tweet_media) {

                if (this_tweet_isvideo_skip) continue;

                var this_tweet_author_dir = path.join(mediadir, this_tweet_author_username);

                if (!fs.existsSync(mediadir)) fs.mkdirSync(mediadir);
                if (!fs.existsSync(this_tweet_author_dir)) fs.mkdirSync(this_tweet_author_dir);

                var this_tweet_media_url = this_tweet_media[mediakey].media_url_https;
                if (this_tweet_media_url === undefined) {
                    this_tweet_media_url = this_tweet_media[mediakey].media_url;
                }

                if (this_tweet.extended_entities.media[0].video_info !== undefined) {

                    var video_info = this_tweet.extended_entities.media[0].video_info;
                    var variant = 0;

                    if (Object.size(video_info.variants) > 1) {

                        var biggest_res_variant = { key: 0, res: 0 };

                        for (var variantkey in video_info.variants) {

                            var this_variant = video_info.variants[variantkey];

                            if (this_variant.content_type !== 'video/mp4') continue;

                            var this_variant_res = /\/([0-9]{1,4})x([0-9]{1,4})\//g.exec(this_variant.url)[1];
                            if (this_variant_res === undefined) continue;

                            if (Number(this_variant_res) > biggest_res_variant.res) {
                                biggest_res_variant.key = Number(variantkey);
                                biggest_res_variant.res = Number(this_variant_res);
                            }
                        }
                        variant = biggest_res_variant.key;
                    }

                    this_tweet_media_url = video_info.variants[variant].url;

                    this_tweet_isvideo_skip = true;
                }

                if (this_tweet_media_url === undefined) continue;

                var this_tweet_media_url_pathname = new URL(this_tweet_media_url).pathname;
                var this_tweet_media_name = this_tweet_id + '-' + mediakey + '.' + this_tweet_media_url_pathname.split('.')[Object.size(this_tweet_media_url_pathname.split('.')) - 1];

                if (fs.existsSync(path.join(this_tweet_author_dir, this_tweet_media_name))) continue;

                try {
                    await electrondl.download(
                        controlWindow,
                        this_tweet_media_url, {
                        directory: this_tweet_author_dir,
                        filename: this_tweet_media_name
                    }
                    );
                } catch (e) {
                    dialog.showMessageBox({
                        type: "error",
                        message: "Download failed!",
                        detail: `The download for the file with id ${this_tweet_id} has failed.`,
                        buttons: ["Close"],
                        cancelId: 0
                    }).then((response) => { });
                }
            }
        }
    });

    // Main Window ---------------------------------------------------------------------------------------

    const mainWindow = new BrowserWindow({
        width: 1100,
        height: 700,

        fullscreenable: false,
        maximizable: false,

        webPreferences: {
            devTools: true,
            nodeIntegration: false,
            enableRemoteModule: false
        }
    });
    mainWindow.loadURL('https://twitter.com');

    mainWindow.webContents.on('devtools-closed', () => {
        dialog.showMessageBox({
            type: "warning",
            message: "Do not close DevTools!",
            detail: "DevTools must be open in order to work. To reopen devTools press 'Ctrl+Shift+I' or 'F12' on Windows or 'Cmd+Alt+I' on Mac OS",
            buttons: ["Close"],
            cancelId: 0
        }).then((response) => { });
    });

    mainWindow.on('close', function () {
        app.quit();
    });

    var extension_dirname = process.env.ELECTRON_ENV !== 'development' ? `${process.resourcesPath}` : __dirname;
    session.defaultSession.loadExtension(path.join(extension_dirname, 'gatewayext')).then(({ id }) => {
        mainWindow.webContents.openDevTools();
    })

    // Controller Window ---------------------------------------------------------------------------------

    const controlWindow = new BrowserWindow({
        width: 400,
        height: 600,

        titleBarStyle: 'hidden',

        resizable: false,
        fullscreenable: false,
        maximizable: false,

        webPreferences: {
            devTools: false,
            nodeIntegration: true,
            enableRemoteModule: false
        }
    });
    controlWindow.setMenuBarVisibility(false);
    controlWindow.loadFile(path.join(__dirname, 'src/control.html'));

    controlWindow.on('close', function () {
        app.quit();
    });

    ipcMain.on('open-href', (event, arg) => {

        try {
            var urlobj = new URL(arg);

            if (urlobj.hostname == 'twitter.com' || urlobj.hostname.endsWith('.twitter.com') && urlobj.hostname !== '.twitter.com') {

                mainWindow.loadURL(arg);

            } else {
                dialog.showMessageBox({
                    type: "error",
                    message: "Refused to load this domain",
                    detail: arg,
                    buttons: ["Close"],
                    cancelId: 0
                }).then((response) => { });
            }
        } catch (e) { }
    });

    ipcMain.on('get-savesdir', (event) => {
        event.reply('reply-savesdir', savesdir);
    });

    ipcMain.on('get-mediadir', (event) => {
        event.reply('reply-mediadir', mediadir);
    });

    // Devtools Extension Notice -------------------------------------------------------------------------

    if (devtoolsExtensionNotice) {
        dialog.showMessageBox({
            type: "info",
            message: "Welcome!",
            detail: `Thank you for installing ${app.getName()}. If a message saying 'Gateway Extension Loaded' does not appear on the devTools Console you may have to restart the app or close and reopen devTools.`,
            buttons: ["Close"],
            cancelId: 0
        }).then((response) => {});
    }
};

// Electron App Events -----------------------------------------------------------------------------------

app.on('ready', createWindow);
app.on('window-all-closed', () => { app.quit(); });
app.on('activate', () => { });