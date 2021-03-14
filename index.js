// Electron
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const util = require('util');

// Express
const express = require('express');
const bodyParser = require('body-parser');

// Electron Store
const Store = require('electron-store');
const store = new Store({ name: 'saves' });

// Merge json
const merge = require("merge-json");

// Filesystem
const fs = require('fs');

// Electron File Download
const electrondl = require('electron-dl');

// Process
const process = require('process');

// Extension location
const isDev = require('electron-is-dev');
const extension_dirname = !isDev ? `${process.resourcesPath}` : __dirname;

// Prepare Save File
if (store.get('version') == undefined) {
    store.set('version', 0);
}

if (store.get('theme') == undefined) {
    store.set('theme', 'light');
}

if (store.get('medialist') == undefined) {
    store.set('medialist', { uselist: false, userlist: {} });
}

if (store.get('version') == undefined) {
    store.set('version', 0);
}

if (store.get('saves') == undefined) {
    store.set('saves', {});
}

// Array to object (Updated how the Userlist is stored)
if (util.isArray(store.get('medialist.userlist'))) {
    var users = store.get('medialist.userlist');
    var object = {};
    for (user in users) {
        object[users[user]] = users[user];
    }
    store.delete('medialist.userlist');
    store.set('medialist.userlist', object);
}

// Directory Constants
const savesdir = store.path;
const mediadir = path.join(app.getPath('userData'), 'media');

// Create Mediadir if not exists
if (!fs.existsSync(mediadir)) fs.mkdirSync(mediadir);

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

        if (jsonparsed.tweets !== undefined && jsonstored.tweets !== undefined) {
            for (var this_stored_key in jsonstored.tweets) {
                if (jsonparsed.tweets[this_stored_key] !== undefined) delete jsonparsed.tweets[this_stored_key];
            }
        }

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

server.listen(port, host, () => { });

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

        var medialist = store.get('medialist');

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

            if (medialist.uselist) {
                if (medialist.userlist[this_tweet_author_username.toLowerCase()] === undefined) continue;
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

                    if (video_info.variants.length > 1) {

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
                var this_tweet_media_name = this_tweet_id + '-' + mediakey + '.' + this_tweet_media_url_pathname.split('.')[this_tweet_media_url_pathname.split('.').length - 1];

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

        show: false,

        webPreferences: {
            devTools: true,
            nodeIntegration: false,
            enableRemoteModule: false
        }
    });
    mainWindow.loadURL('https://twitter.com');

    mainWindow.webContents.session.loadExtension(path.join(extension_dirname, 'gatewayext')).then(({ id }) => {});

    const mainWindowDevTools = new BrowserWindow({
        show: false,
        title: 'Gateway extension loader'
    });
    mainWindowDevTools.setMenuBarVisibility(false);
    mainWindow.webContents.setDevToolsWebContents(mainWindowDevTools.webContents);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    });

    mainWindow.on('close', function () {
        app.quit();
    });

    // Controller Window ---------------------------------------------------------------------------------

    const controlWindow = new BrowserWindow({
        width: 400,
        height: 600,

        titleBarStyle: 'hidden',

        resizable: false,
        fullscreenable: false,
        maximizable: false,

        show: false,

        webPreferences: {
            devTools: false,
            nodeIntegration: true,
            enableRemoteModule: false
        }
    });
    controlWindow.setMenuBarVisibility(false);
    controlWindow.loadFile(path.join(__dirname, 'src/control.html'));

    var mainWindowStartingBounds = mainWindow.getBounds();
    var controlWindowStartingBounds = controlWindow.getBounds();
    controlWindow.setBounds({
        x: (mainWindowStartingBounds.x - controlWindowStartingBounds.width),
        y: mainWindowStartingBounds.y
    });

    controlWindow.once('ready-to-show', () => {
        controlWindow.show();
        controlWindow.webContents.send('update-theme', store.get('theme'));
    });

    controlWindow.on('close', function () {
        app.quit();
    });

    ipcMain.on('open-href', (event, msg) => {

        try {
            var urlobj = new URL(msg);

            if (urlobj.hostname == 'twitter.com' || urlobj.hostname.endsWith('.twitter.com') && urlobj.hostname !== '.twitter.com') {

                mainWindow.loadURL(msg);

            } else {
                dialog.showMessageBox({
                    type: "error",
                    message: "Refused to load this domain",
                    detail: msg,
                    buttons: ["Close"],
                    cancelId: 0
                }).then((response) => { });
            }
        } catch (e) { }
    });

    ipcMain.on('toggle-app-theme', (event, msg) => {
        if (store.get('theme') == 'light') {
            store.set('theme', 'dark');
            controlWindow.webContents.send('update-theme', store.get('theme'));
        } else if (store.get('theme') == 'dark') {
            store.set('theme', 'light');
            controlWindow.webContents.send('update-theme', store.get('theme'));
        }
    });

    var autoscroll = false;
    var autoscrollid = null;
    ipcMain.on('toggle-auto-scroll', (event, msg) => {
        if (!autoscroll) {
            mainWindow.webContents.session.loadExtension(path.join(extension_dirname, 'scrollext')).then(({ id }) => {
                autoscroll = true;
                autoscrollid = id;
                mainWindow.reload();
            });
        } else {
            mainWindow.webContents.session.removeExtension(autoscrollid);
            autoscroll = false;
            autoscrollid = null;
            mainWindow.reload();
        }
    });

    ipcMain.on('get-savesdir', (event) => {
        event.reply('reply-savesdir', savesdir);
    });

    ipcMain.on('get-mediadir', (event) => {
        event.reply('reply-mediadir', mediadir);
    });

    ipcMain.on('get-medialist', (event) => {
        event.reply('reply-medialist', store.get('medialist'));
    });

    ipcMain.on('toggle-uselist', (event) => {
        var now = store.get('medialist.uselist');

        if (now) {
            store.set('medialist.uselist', false);
        } else {
            store.set('medialist.uselist', true);
        }
    });

    ipcMain.on('add-userlist', (event, msg) => {
        if (msg.length <= 15) {
            var list = store.get('medialist.userlist');
            list[msg.toLowerCase()] = msg;
            store.set('medialist.userlist', list);
        }
    });

    ipcMain.on('remove-userlist', (event, msg) => {
        var list = store.get('medialist.userlist');
        delete list[msg.toLowerCase()];
        store.set('medialist.userlist', list);
    });
};

// Electron App Events -----------------------------------------------------------------------------------

app.on('ready', createWindow);
app.on('window-all-closed', () => { app.quit(); });
app.on('activate', () => { });
