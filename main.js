const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Cihaz bilgilerini al
function getDeviceInfo() {
  const ip = localIp();
  const macAddress = mac.one();
  return { ip, macAddress };
}

// device.json dosyasını oluştur
function createDeviceFile(deviceInfo) {
  const devicePath = path.join(__dirname, 'config', 'device.json');
  fs.writeFileSync(devicePath, JSON.stringify(deviceInfo, null, 2));
}

// config.json dosyasını oku
function getConfig() {
  const configPath = path.join(__dirname, 'config', 'config.json');
  const data = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(data);
}

// Cihaz CMS'de kayıtlı mı?
async function isDeviceRegistered(macAddress, apiUrl) {
  try {
    const response = await axios.get(`${apiUrl}/devices/${macAddress}`);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Cihazı CMS'e kaydet
async function registerDevice(deviceInfo, apiUrl) {
  const payload = {
    name: "CMS Player",
    mac_address: deviceInfo.macAddress,
    ip_address: deviceInfo.ip,
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

app.whenReady().then(() => {
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