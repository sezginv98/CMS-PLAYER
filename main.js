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
    
    // 3 saniye sonra gizle (error hariç)
    if (type !== 'error') {
      setTimeout(() => {
        status.classList.add('hidden');
      }, 3000);
    }
  }
  
  // Test butonu
  testBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim();
    console.log('Test butonu tıklandı, API URL:', apiUrl);
    
    if (!apiUrl) {
      showStatus('API URL gerekli', 'error');
      apiUrlInput.focus();
      return;
    }
    
    testBtn.disabled = true;
    testBtn.textContent = '⏳ Test...';
    showStatus('Bağlantı test ediliyor...', 'info');
    
    try {
      const result = await window.electronAPI.testApiConnection(apiUrl);
      
      if (result) {
        showStatus('✅ Bağlantı başarılı!', 'success');
      } else {
        showStatus('❌ Bağlantı başarısız', 'error');
      }
    } catch (error) {
      showStatus('❌ Test hatası: ' + error.message, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '🔍 Test Et';
    }
  });
  
  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const configData = {
      apiUrl: apiUrlInput.value.trim(),
      localMediaUrl: localMediaUrlInput.value.trim() || './media',
      registered_key: registeredKeyInput.value.trim() || 'string'
    };
    
    if (!configData.apiUrl) {
      showStatus('API URL gerekli', 'error');
      apiUrlInput.focus();
      return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Kaydediyor...';
    showStatus('Ayarlar kaydediliyor...', 'info');
    
    try {
      const result = await window.electronAPI.saveConfig(configData);
      
      if (result.success) {
        showStatus('✅ Kaydedildi!', 'success');
        
        // 1.5 saniye sonra pencereyi kapat
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        showStatus('❌ Kaydetme hatası: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      showStatus('❌ Hata: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Kaydet';
    }
  });
  
  // Enter tuşu ile test
  apiUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !testBtn.disabled) {
      testBtn.click();
    }
  });
});