// electron-main.cjs
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let astroServer;
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            
            // La URL viene dentro de 'commandLine' en Windows
            // const url = commandLine.find(arg => arg.startsWith('labsomno://'));
            // console.log("Abierto desde URL:", url);
        }
    });

    app.whenReady().then(() => {
        createWindow();

        if (process.defaultApp) {
            if (process.argv.length >= 2) {
                app.setAsDefaultProtocolClient('labsomno', process.execPath, [path.resolve(process.argv[1])]);
            }
        } else {
            app.setAsDefaultProtocolClient('labsomno');
        }
    });
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        title: "Lab-Somno App",
        icon: path.join(__dirname, 'public/logo.svg'),
        webPreferences: {
            partition: 'persist:labsomno',
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.setMenu(null);

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:4321');
    } else {
        const PROD_PORT = 36900;

        const serverPath = path.join(
            process.resourcesPath, 
            'app.asar.unpacked', 
            'dist', 
            'server', 
            'entry.mjs'
        );
        
        console.log("Iniciando servidor en puerto:", PROD_PORT);

        astroServer = fork(serverPath, [], {
            env: { ...process.env, PORT: PROD_PORT, HOST: '127.0.0.1' },
            stdio: 'ignore'
        });

        setTimeout(() => {
            mainWindow.loadURL(`http://localhost:${PROD_PORT}`);
        }, 1000);
        
        astroServer.stdout.on('data', (data) => console.log(`Astro: ${data}`));
        astroServer.stderr.on('data', (data) => console.error(`Error: ${data}`));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (astroServer) astroServer.kill();
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
    if (astroServer) astroServer.kill();
});