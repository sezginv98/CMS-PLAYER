const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const https = require('https');
const macaddress = require('node-macaddress');
const localIpV4Address = require('local-ipv4-address');
const os = require('os');

// SSL sertifika doğrulamasını geçici olarak devre dışı bırak
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

let mainWindow;
let settingsWindow;

const configPath = path.join(__dirname, 'config', 'config.json');
const devicePath = path.join(__dirname, 'config', 'device.json');
const layoutPath = path.join(__dirname, 'config', 'layout.json');

// Config klasörünü oluştur
if (!fs.existsSync(path.join(__dirname, 'config'))) {
  fs.mkdirSync(path.join(__dirname, 'config'));
}

// Cihaz bilgilerini tespit et ve kaydet
async function createDeviceInfo() {
  try {
    console.log('Cihaz bilgileri tespit ediliyor...');
    
    const deviceName = os.hostname();
    const ipAddress = await localIpV4Address();
    const macAddress = await new Promise((resolve, reject) => {
      macaddress.one((err, mac) => {
        if (err) reject(err);
        else resolve(mac);
      });
    });

    const deviceInfo = {
      device_name: deviceName,
      device_mac: macAddress,
      device_ip: ipAddress
    };

    fs.writeFileSync(devicePath, JSON.stringify(deviceInfo, null, 2));
    console.log('Cihaz bilgileri kaydedildi:', deviceInfo);
    return deviceInfo;
  } catch (error) {
    console.error('Cihaz bilgileri tespit edilemedi:', error);
    return null;
  }
}

// API bağlantısını test et
async function testApiConnection(apiUrl) {
  try {
    console.log('API bağlantısı test ediliyor:', apiUrl);
    
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    const response = await axios.get(`${apiUrl}/health`, {
      timeout: 5000,
      httpsAgent: agent,
      headers: {
        'User-Agent': 'CMS-Player/1.0'
      }
    });
    
    console.log('API test sonucu:', response.status, response.data);
    return response.status === 200;
  } catch (error) {
    console.error('API test hatası:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      url: error.config?.url
    });
    return false;
  }
}

// Config dosyasını yükle
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('Config yüklendi:', config);
      return config;
    }
  } catch (error) {
    console.error('Config yükleme hatası:', error);
  }
  return null;
}

// Ayar penceresini aç
function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadFile('settings.html');
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// Ana pencereyi oluştur
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Menüyü gizle
  Menu.setApplicationMenu(null);
}

// Uygulama başlangıcı
app.whenReady().then(async () => {
  console.log('Uygulama başlatılıyor...');
  
  // Cihaz bilgilerini kontrol et/oluştur
  if (!fs.existsSync(devicePath)) {
    await createDeviceInfo();
  }
  
  // Config kontrolü ve API testi
  const config = loadConfig();
  let apiConnected = false;
  
  if (config && config.apiUrl) {
    apiConnected = await testApiConnection(config.apiUrl);
  }
  
  // Ana pencereyi oluştur
  createMainWindow();
  
  // Config yoksa veya API bağlantısı yoksa ayar penceresini aç
  if (!config || !apiConnected) {
    console.log('Ayar penceresi açılıyor...');
    setTimeout(() => {
      openSettingsWindow();
    }, 1000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// IPC Handlers
ipcMain.on('get-layout', (event) => {
  try {
    if (fs.existsSync(layoutPath)) {
      const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
      event.reply('layout-data', layout);
    } else {
      console.error('Layout dosyası bulunamadı');
      event.reply('layout-data', null);
    }
  } catch (error) {
    console.error('Layout yükleme hatası:', error);
    event.reply('layout-data', null);
  }
});

ipcMain.handle('get-media-path', (event, relativePath) => {
  return path.join(__dirname, 'media', relativePath);
});

ipcMain.handle('test-api-connection', async (event, apiUrl) => {
  return await testApiConnection(apiUrl);
});

ipcMain.handle('save-config', async (event, configData) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    console.log('Config kaydedildi:', configData);
    return { success: true };
  } catch (error) {
    console.error('Config kaydetme hatası:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-current-config', (event) => {
  return loadConfig();
});