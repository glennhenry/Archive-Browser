const {
  app,
  BrowserWindow,
  Menu,
  MenuItem,
  session,
  dialog,
  net,
  ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");
const sanitize = require("sanitize-filename");

/** CORE BROWSER */

let windows = [];

function createWindow(startUrl, isMain = false) {
  const win = new BrowserWindow({
    icon: "resources/logo.ico",
    width: 1400,
    height: 800,
    title: "Archive Browser",
    parent: this,
    webPreferences: {
      devTools: true,
      nodeIntegration: false,
      contextIsolation: true,
      plugins: true,
    },
  });

  win.loadURL(startUrl);

  win.webContents.on("new-window", (event, url) => {
    event.preventDefault();
    createWindow(url, false);
  });

  win.on("close", (event) => {
    if (isMain) {
      event.preventDefault();
      dialog
        .showMessageBox(win, {
          type: "question",
          buttons: ["Cancel", "Exit"],
          defaultId: 0,
          cancelId: 0,
          title: "Confirm Exit",
          message: "Are you sure you want to exit the browser?",
          detail: "WARNING: All open windows will be closed.",
        })
        .then((result) => {
          if (result.response === 1) {
            windows.forEach((w) => {
              if (w !== win && !w.isDestroyed()) w.destroy();
            });
            windows = [];

            // stop capture when main window is closed
            stopCapture();

            win.removeAllListeners("close");
            win.close();
          }
        });
    } else {
      windows = windows.filter((w) => w !== win);

      // stop capture when there are no more windows
      if (windows.length === 0) {
        stopCapture();
      }

      win.destroy();
    }
  });

  windows.push(win);
  return win;
}

let mainWindow;

function createMainWindow() {
  mainWindow = createWindow("https://www.google.com", true);

  contextMenu = new Menu();
  contextMenu.append(new MenuItem({ label: "Copy", role: "copy" }));
  contextMenu.append(new MenuItem({ label: "Paste", role: "paste" }));

  mainWindow.webContents.on("context-menu", (_, params) => {
    contextMenu.popup({ window: mainWindow, x: params.x, y: params.y });
  });
}

const runBrowserApp = () => {
  createMainWindow();
  initializeBrowserMenu(mainWindow);

  mainWindow.webContents.on(
    "did-fail-load",
    (_a, errorCode, errorDescription, _b, _c) => {
      const errorHTML = `
            <html>
            <body style="background-color: #d4c8b8; color: #3b3732; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
                <div style="text-align:center; font-family: Arial, sans-serif;">
                    <h1>Sorry, it seems like the webpage failed to load.</h1>
                    <p>Details: (${errorCode}) ${errorDescription}.</p>
                </div>
            </body>
            </html>
        `;
      mainWindow.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(errorHTML),
      );
      mainWindow.show();
    },
  );
};

app.on("ready", () => {
  initializeCaptureList();
  initializeDownloadedCache();
  parseCaptureCfg();
  runBrowserApp();
  if (captureOnStart) {
    startCapture();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) runBrowserApp();
  });
});

app.on("window-all-closed", () => {
  stopCapture();
  if (process.platform !== "darwin") app.quit();
});

let appMenu;
let captureMenuItem = null;

function initializeBrowserMenu() {
  const template = [
    {
      label: "View",
      submenu: [
        {
          label: "Open URL",
          click: () => openUrlPrompt(),
        },
        {
          label: "Force Exit",
          click(_, focusedWindow) {
            if (focusedWindow) app.exit();
          },
        },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click(_, focusedWindow) {
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              const url = focusedWindow.webContents.getURL();

              focusedWindow.destroy();

              createWindow(url);
            }
          },
        },
        {
          label: "Toggle Developer Tools",
          accelerator: process.platform === "darwin" ? "Command+I" : "Ctrl+I",
          click(_, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: "Clean",
      submenu: [
        {
          label: "Clear HTTP Cache",
          click: () => clearHTTPCache(),
        },
        {
          label: "Clear Storage Data (THIS WILL REFRESH THE BROWSER!)",
          click: () => clearStorageData(),
        },
      ],
    },
    {
      label: "Audio",
      submenu: [
        {
          id: "muteWindow",
          label: "Mute",
          type: "checkbox",
          click: (menuItem, focusedWindow) => {
            if (!focusedWindow || focusedWindow.isDestroyed()) return;
            const newMuted = !focusedWindow.webContents.isAudioMuted();
            focusedWindow.webContents.setAudioMuted(newMuted);
            menuItem.checked = newMuted;
          },
        },
      ],
    },
    {
      label: "Capture",
      submenu: [
        {
          label: `Capture status: ${isCapturing ? "ON" : "OFF"}`,
        },
        {
          label: "Start capturing",
          click: () => startCapture(),
        },
        {
          label: "Stop capturing",
          click: () => stopCapture(),
        },
        {
          label: "Overwrite Mode",
          submenu: [
            {
              label: "Never overwrite",
              type: "radio",
              checked: overwriteMode === NEVER_OVERWRITE,
              click: () => setOverwrite(NEVER_OVERWRITE),
            },
            {
              label: "Overwrite if older than 1 week",
              type: "radio",
              checked: overwriteMode === ALWAYS_OVERWRITE_EVERY_1_WEEK,
              click: () => setOverwrite(ALWAYS_OVERWRITE_EVERY_1_WEEK),
            },
            {
              label: "Overwrite if older than 1 month",
              type: "radio",
              checked: overwriteMode === ALWAYS_OVERWRITE_EVERY_1_MONTH,
              click: () => setOverwrite(ALWAYS_OVERWRITE_EVERY_1_MONTH),
            },
            {
              label: "Always overwrite",
              type: "radio",
              checked: overwriteMode === ALWAYS_OVERWRITE,
              click: () => setOverwrite(ALWAYS_OVERWRITE),
            },
          ],
        },
      ],
    },
  ];

  appMenu = Menu.buildFromTemplate(template);
  captureMenuItem = appMenu.items[3].submenu.items[0];
  const helpMenuItem = appMenu.getMenuItemById("helpMenu");
  const devToolsMenuItem = new MenuItem({
    label: "Toggle Developer Tools",
    click: () => {
      mainWindow.webContents.toggleDevTools();
    },
  });

  if (helpMenuItem && helpMenuItem.submenu) {
    helpMenuItem.submenu.append(devToolsMenuItem);
  }

  Menu.setApplicationMenu(appMenu);

  const muteItem = appMenu.getMenuItemById("muteWindow");

  app.on("browser-window-focus", (_, window) => {
    if (!muteItem) return;
    if (window && !window.isDestroyed()) {
      muteItem.checked = !!window.webContents.isAudioMuted();
    } else {
      muteItem.checked = false;
    }
  });

  app.on("browser-window-created", (_, window) => {
    window.on("focus", () => {
      if (appMenu)
        appMenu.getMenuItemById("muteWindow").checked =
          window.webContents.isAudioMuted();
    });
    window.on("closed", () => {
      const focused = BrowserWindow.getFocusedWindow();
      if (appMenu)
        appMenu.getMenuItemById("muteWindow").checked = focused
          ? focused.webContents.isAudioMuted()
          : false;
    });
  });
}

function openUrlPrompt() {
  const promptWin = new BrowserWindow({
    width: 300,
    height: 150,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const html = `<style>body{font-family:sans-serif;margin:12px}input{width:100%;padding:8px;font-size:14px;margin-bottom:12px}.btn-row{display:flex;justify-content:flex-end;gap:8px}</style><h3 style="margin-top:0">Enter URL</h3><input id="url" placeholder="https://www.google.com" value="https://www.google.com"><div class="btn-row"><button onclick="closeWin()">Cancel</button><button onclick="submit()">OK</button></div><script>const { ipcRenderer } = require("electron");

  function submit() {
    ipcRenderer.send("url-entered", document.getElementById("url").value);
    window.close();
  }

  function closeWin() {
    window.close();
  }</script>`;

  // Load as a data URL
  promptWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));

  // Close the window when data is received
  ipcMain.once("url-entered", (_event, url) => {
    console.log("Entered:", `'${url}'`);
    promptWin.close();

    createWindow(url);
  });
}

function clearHTTPCache() {
  try {
    session.defaultSession.clearCache();
    console.log(magenta("HTTP cache cleared."));
  } catch (err) {
    console.error(magenta("Error clearing cache:"), err);
  }
}

function clearStorageData() {
  try {
    session.defaultSession.clearStorageData();
    console.log(magenta("Storage data cleared."));
    app.relaunch();
    app.exit();
  } catch (error) {
    console.error(magenta("Error clearing storage data:", error));
  }
}

/** AUTO CAPTURE */

const baseDir = app.isPackaged
  ? path.dirname(process.execPath)
  : path.join(process.cwd());

const OUTPUT_DIR = path.join(baseDir, "output");
const WHITELIST_FILE = path.join(baseDir, "whitelist.txt");
const LOG_DIR = path.join(baseDir, "logs");
const CONFIG_FILE = path.join(baseDir, "capture.cfg");

const NEVER_OVERWRITE = 1;
const ALWAYS_OVERWRITE_EVERY_1_WEEK = 2;
const ALWAYS_OVERWRITE_EVERY_1_MONTH = 3;
const ALWAYS_OVERWRITE = 4;

// can be set from configs in capture.cfg
let captureOnStart = false;
let overwriteMode = ALWAYS_OVERWRITE_EVERY_1_WEEK;
let disableLogs = true;

let whitelist = [];
let isCapturing = false;
let captureStats = {
  total: 0,
  saved: 0,
  ignoredAlreadyInDisk: 0,
  ignoredNotInWhiteList: 0,
  error: 0,
};
let captureLogFilename = null;

const customRequests = new Set();
const downloadedCache = new Map();

function startCapture() {
  if (isCapturing) {
    console.log(magenta("Already capturing."));
    return;
  }
  isCapturing = true;

  updateCaptureStatusLabel("ON");
  createCaptureStats();
  createCaptureLog();
  if (captureLogFilename != null) {
    showCaptureToast(`Capture started at ${captureLogFilename}`);
  } else {
    showCaptureToast(`Capture started (log disabled)`);
  }

  ensureCaptureOutputDirectory();
  saveRequestHook();

  console.log(magenta("Capture ENABLED."));
}

function stopCapture() {
  if (!isCapturing) {
    console.log(magenta("Capture already disabled."));
    return;
  }

  session.defaultSession.webRequest.onCompleted(null);
  isCapturing = false;

  updateCaptureStatusLabel("OFF");
  if (captureLogFilename != null) {
    showCaptureToast(`Capture stopped at ${captureLogFilename}`);
  } else {
    showCaptureToast(`Capture stopped (log disabled)`);
  }

  writeCaptureStats(captureLogFilename);
  captureLogFilename = null;
  captureStats = {};

  console.log(magenta("Capture DISABLED."));
}

function saveRequestHook() {
  const ses = session.defaultSession;

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    // before sending header, check if request is made by us
    if (details.requestHeaders["x-custom-save"]) {
      customRequests.add(details.id);
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  ses.webRequest.onCompleted({ urls: ["*://*/*"] }, (details) => {
    // Ignore requests made by our custom handler
    // to prevent making double custom request (and infinite if on always overwrite mode).
    if (customRequests.has(details.id)) {
      customRequests.delete(details.id);
      return;
    }

    // Only capture GET requests
    if (details.method !== "GET") return;

    // Ignore if not in whitelist
    if (!isInWhitelist(details.url)) {
      appendToCaptureLog(`Ignored (not in whitelist): ${details.url}`);
      captureStats.ignoredNotInWhiteList =
        captureStats.ignoredNotInWhiteList + 1;
      console.log(grey("Ignored (not in whitelist):"), details.url);
      return;
    }

    // Prepare file path and url key (for checking cache)
    const filePath = createPathFromUrl(details.url);
    const urlKey = createUrlKeyFromPath(filePath);

    // Avoid capturing downloaded file (already in disk) unless overwrite mode allows it
    if (!shouldSaveOrOverwrite(urlKey)) {
      appendToCaptureLog(`Ignored (already in disk): ${details.url}`);
      captureStats.ignoredAlreadyInDisk = captureStats.ignoredAlreadyInDisk + 1;
      console.log(yellow("Ignored (already in disk):"), details.url);
      return;
    }

    try {
      // create custom request
      const req = net.request({
        method: "GET",
        url: details.url,
        headers: {
          ...details.requestHeaders,
          "x-custom-save": "1",
        },
      });

      // on response of that custom request, save resource to disk
      req.on("response", (res) => {
        // ensure that parent dir (i.e, directory before the file) is created
        ensureParentDir(path.dirname(filePath));

        let downloadedBytes = 0;

        res.on("data", (chunk) => {
          downloadedBytes += chunk.length;
        });

        // Stream directly to file asynchronously
        const fileStream = fs.createWriteStream(filePath);
        res.pipe(fileStream);

        fileStream.on("finish", () => {
          appendToCaptureLog(
            `Saved (new file): ${details.url} [${
              bytesToKbOrMB(downloadedBytes) || "unknown bytes"
            }]`,
          );
          captureStats.saved = captureStats.saved + 1;
          updateDownloadedCacheEntry(filePath, urlKey);
          console.log(
            green("Saved (new file):"),
            details.url,
            ` [${bytesToKbOrMB(downloadedBytes) || "unknown bytes"}]`,
          );
        });

        fileStream.on("error", (err) => {
          appendToCaptureLog(
            `Error (write error): ${details.url} [${err.message}]`,
          );
          captureStats.error = captureStats.error + 1;
          console.error(red("Write error:"), red(err.message));
        });
      });

      req.on("error", (err) => {
        appendToCaptureLog(
          `Error (request error): ${details.url} [${err.message}]`,
        );
        captureStats.error = captureStats.error + 1;
        console.error(red("Request error:"), red(err.message));
      });

      req.end();
    } catch (err) {
      appendToCaptureLog(
        `Error (capture error): ${details.url} [${err.message}]`,
      );
      captureStats.error = captureStats.error + 1;
      console.error(red("Capture error:"), red(err.message));
    }
  });
}

function parseCaptureCfg() {
  if (!fs.existsSync(CONFIG_FILE)) return;

  const text = fs.readFileSync(CONFIG_FILE, "utf8");
  const lines = text.split(/\r?\n/);

  for (let line of lines) {
    line = line.trim();
    // skip empty lines and comment
    if (!line || line.startsWith("#")) continue;

    // structure: key=value
    const [rawKey, rawValue] = line.split("=");
    if (!rawKey || rawValue === undefined) continue;

    const key = rawKey.trim();
    const value = rawValue.trim();

    switch (key) {
      case "captureOnStart":
        captureOnStart = value === "1";
        break;

      case "overwriteMode":
        overwriteMode =
          {
            1: NEVER_OVERWRITE,
            2: ALWAYS_OVERWRITE_EVERY_1_WEEK,
            3: ALWAYS_OVERWRITE_EVERY_1_MONTH,
            4: ALWAYS_OVERWRITE,
          }[value] ?? ALWAYS_OVERWRITE_EVERY_1_WEEK;
        break;

      case "disableLogs":
        disableLogs = value === "1";
    }
  }
}

function bytesToKbOrMB(bytes) {
  const kb = bytes / 1000;
  const mb = bytes / 1000 / 1000;

  if (kb >= 100) {
    return mb.toFixed(2) + " MB"; // use MB when >= 100 KB
  } else {
    return kb.toFixed(2) + " KB";
  }
}

function isInWhitelist(url) {
  // 1. Check negative rules first (highest priority)
  const blocked = whitelist.some(
    (line) => line.startsWith("!") && url.includes(line.slice(1)),
  );
  if (blocked) return false;

  // 2. If "*" is in whitelist → allow everything except blocked ones
  if (whitelist.includes("*")) return true;

  // 3. Check positive rules
  const allowed = whitelist.some(
    (line) => !line.startsWith("!") && url.includes(line),
  );

  return allowed;
}

/**
 * Create file path from URL.
 *
 * https://example.com/game/data/assets.swf will be saved in:
 *
 * example.com (directory) -> game (directory) -> data (directory) -> assets.swf (file)
 */
function createPathFromUrl(url) {
  const u = new URL(url);

  const hostDir = path.join(OUTPUT_DIR, u.hostname);

  let pathname = u.pathname;

  // Handle root URL: "/" → "index.html"
  if (pathname === "/" || pathname === "") {
    pathname = "index.html";
  }

  // Remove leading slash
  if (pathname.startsWith("/")) pathname = pathname.slice(1);

  // If there's no "." extension → treat it as HTML
  if (!path.extname(pathname)) {
    pathname += ".html";
  }

  // Sanitize each segment
  const safePath = pathname
    .split("/")
    .map((part) => sanitize(part))
    .join(path.sep);

  return path.join(hostDir, safePath);
}

function createUrlKeyFromPath(filePath) {
  let rel = path.relative(OUTPUT_DIR, filePath);

  const segments = rel.split(path.sep);
  const hostname = segments.shift();
  let p = segments.join("/");

  if (p === "index.html") {
    p = "/";
  } else {
    if (p.endsWith(".html") && !path.basename(p).includes(".")) {
      p = p.slice(0, -5);
    }
  }

  return `https://${hostname}/${p}`;
}

function ensureCaptureOutputDirectory() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function ensureParentDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
      console.error("ensureParentDir failed");
      console.error("  filePath:", filePath);
      console.error("  dirPath:", dirPath);
      console.error("  error:", err.code, err.message);
      throw err;
    }
  }
}

function initializeCaptureList() {
  try {
    if (fs.existsSync(WHITELIST_FILE)) {
      const content = fs.readFileSync(WHITELIST_FILE, "utf-8");
      const l = content
        .split(/\r?\n/) // split lines (handles Windows \r\n and Unix \n)
        .map((line) => line.trim()) // remove extra spaces
        .filter((line) => line.length > 0 && !line.startsWith("#")); // remove empty lines and comments
      whitelist = whitelist.concat(l);
    }
  } catch (err) {
    console.error(red("Failed to read WHITELIST file:"), err);
  }
  console.log(magenta("WHITELIST:"), whitelist);
}

function updateCaptureStatusLabel(msg) {
  if (captureMenuItem) {
    captureMenuItem.label = `Capture status: ${msg}`;
    initializeBrowserMenu();
  }
}

function showCaptureToast(message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();

  const toast = new BrowserWindow({
    width: 300,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    x: bounds.width / 2 + bounds.x - 150,
    y: bounds.height / 2 + bounds.y - 50,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  toast.loadURL(`data:text/html;charset=utf-8,
    <body style="margin:0;background:rgba(30,30,30,0.85);color:white;padding:10px;
    font-family:sans-serif;border-radius:6px;">
      ${message}
    </body>
  `);

  setTimeout(() => {
    if (!toast.isDestroyed()) toast.close();
  }, 2000);
}

function ensureCaptureLogDirectory() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function createCaptureLog() {
  if (disableLogs) return;
  ensureCaptureLogDirectory();

  const timestamp = createTimestamp();
  const filename = `capture-log ${timestamp}.txt`;
  const fullPath = path.join(LOG_DIR, filename);

  fs.writeFileSync(fullPath, "\n");
  captureLogFilename = filename;
}

function createTimestamp() {
  const date = new Date();

  const year = date.getFullYear();
  const month = date.getMonth().toString().padStart(2, "0");
  const day = date.getDay().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`;
}

function appendToCaptureLog(msg) {
  if (disableLogs) return;
  const filename = path.join(LOG_DIR, captureLogFilename);
  try {
    if (!fs.existsSync(filename) || filename === null) {
      createCaptureLog();
    }
    fs.appendFileSync(filename, msg + "\n");
  } catch (err) {
    console.error("Error on appendToCaptureLog:", err);
  }
}

function createCaptureStats() {
  captureStats = {
    total: 0,
    saved: 0,
    ignoredAlreadyInDisk: 0,
    ignoredNotInWhiteList: 0,
    error: 0,
  };
}

function writeCaptureStats(filename) {
  if (disableLogs) return;
  const filePath = path.join(LOG_DIR, filename);

  try {
    if (!fs.existsSync(filePath)) {
      createCaptureLog();
    }

    let content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    lines[0] = JSON.stringify(captureStats) + "\n";

    const newContent = lines.join("\n");
    fs.writeFileSync(filePath, newContent, "utf8");
  } catch (err) {
    console.error("writeCaptureStats error:", err);
  }
}

function initializeDownloadedCache() {
  if (!fs.existsSync(OUTPUT_DIR)) return;

  let fileSizeAll = 0;

  walkFiles(OUTPUT_DIR, (filePath) => {
    const key = createUrlKeyFromPath(filePath);
    const stat = fs.statSync(filePath);

    fileSizeAll += stat.size;

    // there is potential stat time stale
    downloadedCache.set(key, {
      mtimeMs: stat.mtimeMs,
      path: filePath,
    });
  });

  console.log(
    "Loaded downloaded entries:",
    downloadedCache.size,
    `[${bytesToKbOrMB(fileSizeAll)}]`,
  );
}

function walkFiles(dir, callback) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of items) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkFiles(fullPath, callback);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}

function updateDownloadedCacheEntry(filePath, urlKey) {
  const stat = fs.statSync(filePath);

  // there is potential stat time stale
  downloadedCache.set(urlKey, {
    mtimeMs: stat.mtimeMs,
    path: filePath,
  });
}

function setOverwrite(mode) {
  overwriteMode = mode;
  if (
    captureLogFilename !== null &&
    fs.existsSync(path.join(LOG_DIR, captureLogFilename))
  ) {
    appendToCaptureLog(`Overwrite changed to: ${getOverwriteLabel(mode)}`);
  }
  console.log("Overwrite changed to:", getOverwriteLabel(mode));
}

function getOverwriteLabel(mode) {
  switch (mode) {
    case NEVER_OVERWRITE:
      return "NEVER_OVERWRITE";

    case ALWAYS_OVERWRITE:
      return "ALWAYS_OVERWRITE";

    case ALWAYS_OVERWRITE_EVERY_1_WEEK:
      return "ALWAYS_OVERWRITE_EVERY_1_WEEK";

    case ALWAYS_OVERWRITE_EVERY_1_MONTH:
      return "ALWAYS_OVERWRITE_EVERY_1_MONTH";

    default:
      return "NEVER_OVERWRITE";
  }
}

function shouldSaveOrOverwrite(urlKey) {
  const info = downloadedCache.get(urlKey);

  if (!info) {
    // file not in memory cache, which mean it is not in the disk -> always save
    return true;
  }

  // there is potential stat time stale
  const fileTime = info.mtimeMs;

  switch (overwriteMode) {
    case NEVER_OVERWRITE:
      return false;

    case ALWAYS_OVERWRITE:
      return true;

    case ALWAYS_OVERWRITE_EVERY_1_WEEK:
      return isOlderThan(fileTime, 7);

    case ALWAYS_OVERWRITE_EVERY_1_MONTH:
      return isOlderThan(fileTime, 30);

    default:
      return false;
  }
}

function isOlderThan(date, days) {
  if (!date) return true;
  const diffMs = Date.now() - date;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= days;
}

/** COLORS UTILS */

const COLORS = {
  reset: "\x1b[0m",
  grey: "\x1b[100m",
  magenta: "\x1b[45m",
  yellow: "\x1b[43m",
  green: "\x1b[42m",
  red: "\x1b[41m",
};

let colorEnabled = true;

function grey(text) {
  if (!colorEnabled) return;
  return COLORS.grey + text + COLORS.reset;
}

function magenta(text) {
  if (!colorEnabled) return text;
  return COLORS.magenta + text + COLORS.reset;
}

function yellow(text) {
  if (!colorEnabled) return text;
  return COLORS.yellow + text + COLORS.reset;
}

function green(text) {
  if (!colorEnabled) return text;
  return COLORS.green + text + COLORS.reset;
}

function red(text) {
  if (!colorEnabled) return text;
  return COLORS.red + text + COLORS.reset;
}
