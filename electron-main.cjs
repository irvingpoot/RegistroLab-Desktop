// electron-main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow;
let astroServer;

const getFreePort = () => {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
        });
        srv.on('error', (err) => reject(err));
    });
};

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        title: "Lab-Somno Local",
        icon: path.join(__dirname, 'public/logo.svg'),
        webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.setMenu(null);

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:4321');
    } else {
        try {
            const port = await getFreePort(); 
            console.log(`Puerto libre asignado: ${port}`);

            const serverPath = path.join(
                process.resourcesPath, 
                'app.asar.unpacked', 
                'dist', 
                'server', 
                'entry.mjs'
            );
            
            astroServer = spawn('node', [serverPath], {
                env: { 
                    ...process.env, 
                    PORT: port,
                    HOST: '127.0.0.1' 
                }
            });

            setTimeout(() => {
                mainWindow.loadURL(`http://localhost:${port}`);
            }, 1000);
        } catch (e) {
            console.error("Error al iniciar servidor:", e);
        }
        
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