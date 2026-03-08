// electron-main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let astroServer;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        title: "Lab-Somno Local",
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
        
        astroServer = spawn('node', [serverPath], {
            env: { ...process.env, PORT: PROD_PORT, HOST: '127.0.0.1' }
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

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.path !== 'darwin') app.quit();
    if (astroServer) astroServer.kill();
});