const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const mac = require('node-macaddress');
const localIp = require('local-ipv4-address');
const os = require('os');

let mainWindow;
let settingsWindow;

// Cihaz bilgilerini al
async function getDeviceInfo() {
  try {
    const ip = await new Promise((resolve, reject) => {
      localIp((err, ip) => {
        if (err) reject(err);
        else resolve(ip);
      });
    });
    
    const macAddress = await new Promise((resolve, reject) => {
      mac.one((err, addr) => {
        if (err) reject(err);
        else resolve(addr);
      });
    });
    
    const deviceName = os.hostname();
    
    return {
      device_name: deviceName,
      device_mac: macAddress,
      device_ip: ip
    };
  } catch (error) {
    console.error('Cihaz bilgileri alınamadı:', error);
    return null;
  }
}

// device.json dosyasını oluştur
function createDeviceFile(deviceInfo) {
  const devicePath = path.join(__dirname, 'config', 'device.json');
  
  // Config klasörü yoksa oluştur
  const configDir = path.join(__dirname, 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(devicePath, JSON.stringify(deviceInfo, null, 2));
}

// config.json dosyasını oku
function getConfig() {
  try {
    const configPath = path.join(__dirname, 'config', 'config.json');
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Config dosyası okunamadı:', error);
    return null;
  }
}

// config.json dosyasını oluştur
function createConfigFile(configData) {
  const configPath = path.join(__dirname, 'config', 'config.json');
  
  // Config klasörü yoksa oluştur
  const configDir = path.join(__dirname, 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
}

// Cihaz CMS'de kayıtlı mı?
async function isDeviceRegistered(macAddress, apiUrl) {
  try {
    const response = await axios.get(`${apiUrl}/devices/${macAddress}`);
    return response.status === 200;
  } catch (error) {
    console.error('Cihaz kayıt kontrolü hatası:', error.message);
    return false;
  }
}

// API bağlantısını test et
async function testApiConnection(apiUrl) {
  try {
    console.log('API bağlantısı test ediliyor:', apiUrl);
    
    // URL formatını kontrol et
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      console.error('Geçersiz URL formatı:', apiUrl);
      return false;
    }
    
    const response = await axios.get(`${apiUrl}/health`, { timeout: 5000 });
    console.log('API yanıtı:', response.status, response.data);
    return response.status === 200;
  } catch (error) {
    console.error('API bağlantı testi hatası:', {
      message: error.message,
      code: error.code,
      response: error.response?.status,
      url: apiUrl
    });
    return false;
  }
}

// Cihazı CMS'e kaydet
async function registerDevice(deviceInfo, apiUrl) {
  const payload = {
    name: "CMS Player",
    mac_address: deviceInfo.device_mac,
    ip_address: deviceInfo.device_ip,
    registered_key: "default_key",
    status: "online",
    group_id: 1,
    last_online: new Date().toISOString()
  };

  try {
    const response = await axios.post(`${apiUrl}/devices`, payload);
    return response.status === 201;
  } catch (error) {
    console.error('Cihaz kayıt hatası:', error.message);
    return false;
  }
}

// Ayar penceresi oluştur
function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 300,
    parent: mainWindow,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile('settings.html');
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createWindow(customSize = { width: 800, height: 600 }) {
  mainWindow = new BrowserWindow({
    width: customSize.width,
    height: customSize.height,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(async () => {
  // 1. Device.json kontrolü ve oluşturma
  const devicePath = path.join(__dirname, 'config', 'device.json');
  if (!fs.existsSync(devicePath)) {
    console.log('device.json bulunamadı, cihaz bilgileri alınıyor...');
    const deviceInfo = await getDeviceInfo();
    if (deviceInfo) {
      createDeviceFile(deviceInfo);
      console.log('device.json oluşturuldu:', deviceInfo);
    } else {
      console.error('Cihaz bilgileri alınamadı!');
    }
  }

  // 2. Config.json kontrolü
  let config = getConfig();
  let needsSettings = false;

  if (!config) {
    console.log('config.json bulunamadı');
    needsSettings = true;
  } else {
    // API bağlantısını test et
    const apiConnected = await testApiConnection(config.apiUrl);
    if (!apiConnected) {
      console.log('API bağlantısı kurulamadı');
      needsSettings = true;
    }
  }

  // 3. Ana pencereyi oluştur
  // layout.json okuyup pencereyi oluştur
  const layoutPath = path.join(__dirname, 'config', 'layout.json');

  fs.readFile(layoutPath, 'utf8', (err, data) => {
    if (err) {
      console.error('layout.json okunamadı:', err);
      createWindow(); // Varsayılan boyutlarla pencere oluştur
    } else {
      try {
        const layout = JSON.parse(data);
        createWindow({
          width: layout.width,
          height: layout.height
        });
      } catch (parseError) {
        console.error('layout.json parse hatası:', parseError);
        createWindow(); // Hata durumunda varsayılan pencere
      }
    }

    // Dosya değişikliklerini izle
    watchFile(path.join('config', 'layout.json'), 'layout-data');
    
    // 4. Gerekirse ayar penceresini aç
    if (needsSettings) {
      createSettingsWindow();
    }
  });
});


// Dosya izleme fonksiyonu
function watchFile(filename, channel) {
  const filePath = path.join(__dirname, filename);

  fs.watch(filePath, (eventType) => {
    if (eventType === 'change') {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (!err) {
          try {
            const jsonData = JSON.parse(data);

            if (filename.includes('layout.json')) {
              // Yeni pencere oluştur
              if (!mainWindow.isDestroyed()) {
                mainWindow.close(); // Eski pencereyi kapat
              }
              createWindow({
                width: jsonData.width,
                height: jsonData.height
              });
            }

            // JSON verisini renderer'a gönder
            mainWindow.webContents.send(channel, jsonData);
          } catch (parseError) {
            console.error(`${filename} parse hatası:`, parseError);
          }
        }
      });
    }
  });
}

// layout.json'u oku
ipcMain.on('get-layout', (event) => {
  fs.readFile(path.join(__dirname, 'config', 'layout.json'), 'utf8', (err, data) => {
    if (err) {
      console.error('layout.json okunamadı:', err);
      event.reply('layout-data', null);
    } else {
      event.reply('layout-data', JSON.parse(data));
    }
  });
});

ipcMain.handle('get-media-path', (event, relativePath) => {
  return path.join(__dirname, relativePath);
});

// Ayar penceresi IPC handlers
ipcMain.handle('test-api-connection', async (event, apiUrl) => {
  return await testApiConnection(apiUrl);
});

ipcMain.handle('save-config', async (event, configData) => {
  try {
    createConfigFile(configData);
    
    // Ayar penceresini kapat
    if (settingsWindow) {
      settingsWindow.close();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Config kaydetme hatası:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-current-config', () => {
  return getConfig();
});