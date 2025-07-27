document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm');
  const testBtn = document.getElementById('testBtn');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');
  
  const apiUrlInput = document.getElementById('apiUrl');
  const localMediaUrlInput = document.getElementById('localMediaUrl');
  const registeredKeyInput = document.getElementById('registeredKey');
  
  // Mevcut config varsa yükle
  try {
    const currentConfig = await window.electronAPI.getCurrentConfig();
    if (currentConfig) {
      apiUrlInput.value = currentConfig.apiUrl || '';
      localMediaUrlInput.value = currentConfig.localMediaUrl || './media';
      registeredKeyInput.value = currentConfig.registered_key || '';
    }
  } catch (error) {
    console.error('Mevcut config yüklenemedi:', error);
  }
  
  // Status mesajı göster
  function showStatus(message, type = 'info') {
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove('hidden');
    
    // 5 saniye sonra gizle (error hariç)
    if (type !== 'error') {
      setTimeout(() => {
        status.classList.add('hidden');
      }, 5000);
    }
  }
  
  // Test butonu
  testBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim();
    
    if (!apiUrl) {
      showStatus('Lütfen API URL girin', 'error');
      return;
    }
    
    testBtn.disabled = true;
    testBtn.textContent = 'Test ediliyor...';
    showStatus('API bağlantısı test ediliyor...', 'info');
    
    try {
      const result = await window.electronAPI.testApiConnection(apiUrl);
      
      if (result) {
        showStatus('✓ API bağlantısı başarılı!', 'success');
      } else {
        showStatus('✗ API bağlantısı başarısız. URL\'yi kontrol edin.', 'error');
      }
    } catch (error) {
      showStatus('✗ Bağlantı testi sırasında hata oluştu: ' + error.message, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Bağlantıyı Test Et';
    }
  });
  
  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const configData = {
      apiUrl: apiUrlInput.value.trim(),
      localMediaUrl: localMediaUrlInput.value.trim(),
      registered_key: registeredKeyInput.value.trim()
    };
    
    // Validation
    if (!configData.apiUrl) {
      showStatus('API URL gerekli', 'error');
      return;
    }
    
    if (!configData.localMediaUrl) {
      showStatus('Yerel medya klasörü gerekli', 'error');
      return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Kaydediliyor...';
    showStatus('Ayarlar kaydediliyor...', 'info');
    
    try {
      const result = await window.electronAPI.saveConfig(configData);
      
      if (result.success) {
        showStatus('✓ Ayarlar başarıyla kaydedildi!', 'success');
        
        // 2 saniye sonra pencereyi kapat
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        showStatus('✗ Ayarlar kaydedilemedi: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      showStatus('✗ Kaydetme sırasında hata oluştu: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Kaydet';
    }
  });
});