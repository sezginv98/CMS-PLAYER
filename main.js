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
      code: error.code,
      status: error.response?.status,
      url: error.config?.url
    });
    return false;
  }
}

// Layout verilerini API'den çek ve medya dosyalarını indir
async function syncLayoutData(apiUrl, macAddress) {
  try {
    console.log('Layout verileri çekiliyor...');
    
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    const layoutUrl = `${apiUrl}/api/device-layouts/${macAddress}`;
    console.log('Layout URL:', layoutUrl);
    
    const response = await axios.get(layoutUrl, {
      timeout: 10000,
      httpsAgent: agent,
      headers: {
        'User-Agent': 'CMS-Player/1.0'
      }
    });

    const layoutData = response.data;
    console.log('Layout verileri alındı:', layoutData);

    // Layout verisini kaydet
    fs.writeFileSync(layoutPath, JSON.stringify(layoutData, null, 2));
    console.log('Layout.json dosyası kaydedildi');

    // Medya dosyalarını topla ve indir
    if (layoutData.zones && Array.isArray(layoutData.zones)) {
      await downloadMediaFiles(apiUrl, layoutData);
    } else {
      console.log('Layout verisinde zones bulunamadı');
    }

    return true;
  } catch (error) {
    console.error('Layout senkronizasyon hatası:', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url
    });
    return false;
  }
}

// Medya dosyalarını indir
async function downloadMediaFiles(apiUrl, layoutData) {
  console.log('=== MEDYA DOSYASI TOPLAMA BAŞLADI ===');
  
  const mediaList = [];
  
  // Tüm zone'lardan medya dosyalarını topla
  try {
    layoutData.zones.forEach((zone, zoneIndex) => {
      console.log(`Zone ${zoneIndex + 1} kontrol ediliyor...`);
      
      if (zone.media_list && Array.isArray(zone.media_list)) {
        zone.media_list.forEach((media, mediaIndex) => {
          console.log(`  Media ${mediaIndex + 1}: type=${media.type}, source=${media.source}`);
          
          if ((media.type === 'image' || media.type === 'video') && media.source) {
            // Website URL'lerini atla
            if (!media.source.startsWith('http://') && !media.source.startsWith('https://')) {
              mediaList.push(media);
              console.log(`    ✅ Listeye eklendi: ${media.source}`);
            } else {
              console.log(`    ⏭️ Website URL atlandı: ${media.source}`);
            }
          } else {
            console.log(`    ⏭️ Desteklenmeyen tür veya kaynak eksik`);
          }
        });
      } else {
        console.log(`  Zone ${zoneIndex + 1}'de media_list bulunamadı`);
      }
    });
  } catch (error) {
    console.error('Medya listesi toplama hatası:', error);
  }
  
  console.log(`Toplam ${mediaList.length} medya dosyası bulundu`);
  
  if (mediaList.length === 0) {
    console.log('❌ İndirilecek medya dosyası bulunamadı');
    return;
  }

  // Media klasörünü oluştur
  const mediaDir = path.join(__dirname, 'media');
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir);
    console.log('Media klasörü oluşturuldu:', mediaDir);
  } else {
    console.log('Media klasörü mevcut:', mediaDir);
  }

  console.log('=== MEDYA DOSYASI İNDİRME BAŞLADI ===');
  
  // Paralel indirme
  const downloadPromises = mediaList.map((media, index) => 
    downloadSingleMedia(apiUrl, media, index, mediaList.length, mediaDir)
  );
  
  const results = await Promise.allSettled(downloadPromises);
  
  // Sonuçları analiz et
  let successCount = 0;
  let existsCount = 0;
  let errorCount = 0;
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.status === 'downloaded') successCount++;
      else if (result.value.status === 'exists') existsCount++;
    } else {
      errorCount++;
      console.error(`❌ Promise hatası [${index + 1}]:`, result.reason);
    }
  });
  
  console.log('=== MEDYA DOSYASI İNDİRME RAPORU ===');
  console.log(`📊 Toplam dosya: ${mediaList.length}`);
  console.log(`✅ Yeni indirilen: ${successCount}`);
  console.log(`📁 Zaten mevcut: ${existsCount}`);
  console.log(`❌ Hatalı: ${errorCount}`);
  console.log('=====================================');
}

// Tek bir medya dosyasını indir
async function downloadSingleMedia(apiUrl, media, index, total, mediaDir) {
  try {
    console.log(`[${index + 1}/${total}] Kontrol ediliyor: ${media.source} (${media.type})`);
    
    const filePath = path.join(mediaDir, media.source);
    
    // Dosya zaten varsa atla
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ [${index + 1}/${total}] Dosya zaten mevcut: ${media.source} (${(stats.size / 1024).toFixed(2)} KB)`);
      return { status: 'exists', file: media.source };
    }
    
    // Dosyayı indir
    const mediaUrl = `${apiUrl}/media/${media.source}`;
    console.log(`⬇️ [${index + 1}/${total}] İndiriliyor: ${media.source}`);
    console.log(`   🌐 URL: ${mediaUrl}`);
    const startTime = Date.now();
    
    const agent = new https.Agent({
      rejectUnauthorized: false
    });
    
    const response = await axios.get(mediaUrl, {
      responseType: 'stream',
      timeout: 30000,
      httpsAgent: agent,
      headers: {
        'User-Agent': 'CMS-Player/1.0'
      }
    });
    
    const contentLength = response.headers['content-length'];
    const fileSizeKB = contentLength ? (parseInt(contentLength) / 1024).toFixed(2) : 'bilinmiyor';
    console.log(`📦 [${index + 1}/${total}] Dosya boyutu: ${fileSizeKB} KB`);

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const stats = fs.statSync(filePath);
        const actualSizeKB = (stats.size / 1024).toFixed(2);
        console.log(`✅ [${index + 1}/${total}] İndirme tamamlandı: ${media.source}`);
        console.log(`   📊 Boyut: ${actualSizeKB} KB, Süre: ${duration}s`);
        resolve({ status: 'downloaded', file: media.source });
      });
      
      writer.on('error', (error) => {
        console.error(`❌ [${index + 1}/${total}] Yazma hatası: ${media.source}`);
        console.error(`   🔍 Hata detayı: ${error.message}`);
        reject(error);
      });
    });
    
  } catch (error) {
    if (error.response) {
      console.error(`❌ [${index + 1}/${total}] HTTP hatası: ${media.source}`);
      console.error(`   📡 Status: ${error.response.status}`);
      console.error(`   🌐 URL: ${apiUrl}/media/${media.source}`);
    } else {
      console.error(`❌ [${index + 1}/${total}] İndirme hatası: ${media.source}`);
      console.error(`   🔍 Hata detayı: ${error.message}`);
    }
    throw error;
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
  
  // Geliştirici araçlarını aç
  mainWindow.webContents.openDevTools();
  
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
    
    // API bağlantısı varsa ve layout dosyası yoksa otomatik senkronizasyon
    if (apiConnected && !fs.existsSync(layoutPath)) {
      console.log('Layout dosyası bulunamadı, API\'den çekiliyor...');
      const deviceInfo = JSON.parse(fs.readFileSync(devicePath, 'utf8'));
      const syncResult = await syncLayoutData(config.apiUrl, deviceInfo.device_mac);
      
      if (syncResult) {
        console.log('✅ Layout otomatik olarak senkronize edildi');
      } else {
        console.log('❌ Layout senkronizasyonu başarısız');
      }
    }
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

ipcMain.handle('sync-layout', async (event) => {
  try {
    const config = loadConfig();
    if (!config || !config.apiUrl) {
      return { success: false, error: 'Config bulunamadı' };
    }
    
    const deviceInfo = JSON.parse(fs.readFileSync(devicePath, 'utf8'));
    const result = await syncLayoutData(config.apiUrl, deviceInfo.device_mac);
    
    return { success: result };
  } catch (error) {
    console.error('Layout senkronizasyon hatası:', error);
    return { success: false, error: error.message };
  }
});