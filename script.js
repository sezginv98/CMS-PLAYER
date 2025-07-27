document.addEventListener('DOMContentLoaded', () => {
  window.electronAPI.getLayout();
  window.electronAPI.onLayoutData((event, layout) => {
    if (!layout) return;

    const appDiv = document.getElementById('app');
    appDiv.style.width = layout.width + 'px';
    appDiv.style.height = layout.height + 'px';

    layout.zones.forEach(zone => {
      const zoneDiv = document.createElement('div');
      zoneDiv.className = 'zone';
      zoneDiv.style.left = zone.position_x + 'px';
      zoneDiv.style.top = zone.position_y + 'px';
      zoneDiv.style.width = zone.width + 'px';
      zoneDiv.style.height = zone.height + 'px';
      appDiv.appendChild(zoneDiv);

      // ✅ startZone fonksiyonu burada çağrılıyor
      startZone(zoneDiv, zone.media_list);
    });
  });
});

window.electronAPI.getScrollText();
  window.electronAPI.onScrollTextData((event, scrollText) => {
    const scrollDiv = document.getElementById('scrolling-text');

    if (!scrollText || !scrollText.scrolling_text_enabled) {
      scrollDiv.classList.add('hidden');
      return;
    }

    scrollDiv.textContent = scrollText.scrolling_text_content || 'Default scrolling text';
    scrollDiv.style.fontSize = scrollText.scrolling_text_size + 'px';
    scrollDiv.style.color = scrollText.scrolling_text_color;
    scrollDiv.style.backgroundColor = scrollText.scrolling_text_background;

    // Position
    const pos = scrollText.scrolling_text_position;
    const dir = scrollText.scrolling_text_direction;
    scrollDiv.className = 'position-' + pos;

    // Animation
    const speed = scrollText.scrolling_text_speed;
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

    scrollDiv.style.animation = `${animationName} ${speed * 10}s linear infinite`;
    scrollDiv.classList.remove('hidden');
  });


// ✅ startZone fonksiyonu DOMContentLoaded dışına alınmalı
function startZone(container, mediaList) {
  let index = 0;

  function showMedia() {
    if (!mediaList[index]) return;

    const media = mediaList[index];
    const mediaEl = createMediaElement(media);
    container.innerHTML = '';
    container.appendChild(mediaEl);

    const duration = media.duration * 1000;
    const transitionType = media.transition?.type || 'fade';
    const transitionDuration = media.transition?.duration || 500;

    setTimeout(() => {
      mediaEl.classList.remove('active');
      setTimeout(() => {
        mediaEl.remove();
        index = (index + 1) % mediaList.length;
        showMedia();
      }, transitionDuration);
    }, duration);
  }

function createMediaElement(media) {
  let el;

  if (media.type === 'image') {
    el = document.createElement('img');
  el.src = `${window.CONFIG.media_url}/${media.source}`;
  } else if (media.type === 'video') {
    el = document.createElement('video');
    el.src = `${window.CONFIG.media_url}/${media.source}`;
    el.autoplay = true;
    el.muted = true;
    el.loop = true;
  } else if (media.type === 'website') {
    el = document.createElement('iframe');
    el.src = media.source;
    el.sandbox = 'allow-same-origin allow-scripts';
  } else {
    console.error('Desteklenmeyen medya türü:', media.type);
    return null;
  }

  el.className = 'media active';
  return el;
}

  showMedia();
}
