const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, "..", "resources", "200_001-removebg-preview.png"),
    });

    // Dev only: the default menu carried the DevTools shortcuts, so keep F12 / Ctrl+Shift+I working without it.
    if (!app.isPackaged) {
        win.webContents.on("before-input-event", (event, input) => {
            const isDevToolsKey =
                input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i");
            if (input.type === "keyDown" && isDevToolsKey) win.webContents.toggleDevTools();
        });
    }

    win.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
    // Drop the default File / Edit / View / Window / Help bar. macOS keeps its menu: it lives in the
    // system menu bar and is what makes copy/paste shortcuts work there.
    if (process.platform !== "darwin") Menu.setApplicationMenu(null);

    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
