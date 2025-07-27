document.addEventListener('DOMContentLoaded', () => {
  window.electronAPI.getLayout();
  window.electronAPI.onLayoutData((event, layout) => {
    if (!layout) return;

    console.log('🎬 Yeni layout verisi alındı, player başlatılıyor...');
    const appDiv = document.getElementById('app');
    appDiv.innerHTML = ''; // Önceki içeriği temizle
    appDiv.style.width = layout.width + 'px';
    appDiv.style.height = layout.height + 'px';

    // Kayan yazı işleme
    handleScrollingText(layout);
    
    layout.zones.forEach(zone => {
      const zoneDiv = document.createElement('div');
      zoneDiv.className = 'zone';
      zoneDiv.style.left = zone.position_x + 'px';
      zoneDiv.style.top = zone.position_y + 'px';
      zoneDiv.style.width = zone.width + 'px';
      zoneDiv.style.height = zone.height + 'px';
      appDiv.appendChild(zoneDiv);

      // startZone fonksiyonu burada çağrılıyor
      startZone(zoneDiv, zone.media_list);
    });
    
    console.log('✅ Player başarıyla başlatıldı');
  });
  
  // Player temizleme eventi
  window.electronAPI.onClearPlayer(() => {
    console.log('🧹 Player ekranı temizleniyor...');
    const appDiv = document.getElementById('app');
    appDiv.innerHTML = '';
    
    const scrollDiv = document.getElementById('scrolling-text');
    if (scrollDiv) {
      scrollDiv.classList.add('hidden');
    }
    
    console.log('✅ Player ekranı temizlendi');
  });
});

// Kayan yazı işleme fonksiyonu
function handleScrollingText(layout) {
  const scrollDiv = document.getElementById('scrolling-text');
  
  if (!scrollDiv) {
    console.error('Scrolling text element not found');
    return;
  }

  if (!layout.scrolling_text_enabled) {
    scrollDiv.classList.add('hidden');
    return;
  }

  scrollDiv.textContent = layout.scrolling_text_content || 'Default scrolling text';
  scrollDiv.style.fontSize = (layout.scrolling_text_size || 24) + 'px';
  scrollDiv.style.color = layout.scrolling_text_color || 'black';
  scrollDiv.style.backgroundColor = layout.scrolling_text_background || 'transparent';

  // Position
  const pos = layout.scrolling_text_position || 'bottom';
  const dir = layout.scrolling_text_direction || 'left-right';
  
  // Önceki sınıfları temizle
  scrollDiv.className = '';
  scrollDiv.className = 'position-' + pos;

  // Animation
  const speed = layout.scrolling_text_speed || 10;
  let animationName = '';

  if (pos === 'top' || pos === 'bottom') {
    if (dir === 'left-right') {
      animationName = 'scroll-right';
    } else {
      animationName = 'scroll-left';
    }
  } else if (pos === 'left' || pos === 'right') {
    if (dir === 'top-bottom') {
      animationName = 'scroll-down';
    } else {
      animationName = 'scroll-up';
    }
  }

  scrollDiv.style.animation = `${animationName} ${speed}s linear infinite`;
  scrollDiv.classList.remove('hidden');
}

// startZone fonksiyonu
function startZone(container, mediaList) {
  if (!mediaList || mediaList.length === 0) {
    console.warn('Media list is empty for zone');
    return;
  }
  
  let index = 0;

  function showMedia() {
    if (!mediaList[index]) return;

    const media = mediaList[index];
    const mediaEl = createMediaElement(media);
    
    if (!mediaEl) {
      // Medya elementi oluşturulamazsa bir sonrakine geç
      index = (index + 1) % mediaList.length;
      setTimeout(showMedia, 100);
      return;
    }
    
    container.innerHTML = '';
    container.appendChild(mediaEl);

    const duration = media.duration * 1000;
    const transitionType = media.transition?.type || 'fade';
    const transitionDuration = media.transition?.duration || 500;

    setTimeout(() => {
      mediaEl.classList.remove('active');
      setTimeout(() => {
        if (mediaEl.parentNode) {
          mediaEl.remove();
        }
        index = (index + 1) % mediaList.length;
        showMedia();
      }, transitionDuration);
    }, duration);
  }

  function createMediaElement(media) {
    let el;

    if (media.type === 'image') {
      el = document.createElement('img');
      el.src = `http://localhost:3000/${media.source}`;
      el.onerror = () => console.error('Resim yüklenemedi:', media.source);
    } else if (media.type === 'video') {
      el = document.createElement('video');
      el.src = `http://localhost:3000/${media.source}`;
      el.autoplay = true;
      el.muted = true;
      el.loop = true;
      el.onerror = () => console.error('Video yüklenemedi:', media.source);
    } else if (media.type === 'website') {
      el = document.createElement('iframe');
      el.src = media.source;
      el.sandbox = 'allow-same-origin allow-scripts';
      el.onerror = () => console.error('Website yüklenemedi:', media.source);
    } else {
      console.error('Desteklenmeyen medya türü:', media.type);
      return null;
    }

    el.className = 'media active';
    return el;
  }

  showMedia();
}
