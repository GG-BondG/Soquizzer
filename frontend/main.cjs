const { app, BrowserWindow } = require("electron");

function createWindow() {
    const window = new BrowserWindow({
        width: 1200,
        height: 800
    });

    window.loadFile("index.html");
}

app.whenReady().then(() => {
    createWindow();
});