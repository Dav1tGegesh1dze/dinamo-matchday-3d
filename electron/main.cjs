// Desktop wrapper: one fullscreen window showing the built game from dist/. The game loads its
// models, sounds and skies with fetch, which a page opened straight from disk may not do, so dist/ is
// served from the app's own app://game address instead. Everything else (offline play, results in
// localStorage, the admin export) works exactly as in the browser.
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const DIST = path.join(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const file = path.join(DIST, decodeURIComponent(new URL(request.url).pathname));
    if (!file.startsWith(DIST + path.sep)) return new Response(null, { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL('app://game/index.html');
});

app.on('window-all-closed', () => app.quit());
