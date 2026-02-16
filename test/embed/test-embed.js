const STORAGE_KEY_URL = 'test-embed-last-url';
const STORAGE_KEY_PRELOAD_PYTHON = 'test-embed-preload-python';
const STORAGE_KEY_PRELOAD_JS = 'test-embed-preload-js';
const STORAGE_KEY_URL_LIST = 'test-embed-url-list';
const MAX_URL_LIST_SIZE = 10;

let currentBaseUrl = null;

function getUrlList() {
  try {
    const listJson = localStorage.getItem(STORAGE_KEY_URL_LIST);
    return listJson ? JSON.parse(listJson) : [];
  } catch (e) {
    return [];
  }
}

function saveUrlToList(url) {
  if (!url) return;

  let urlList = getUrlList();
  // Remove if already exists
  urlList = urlList.filter(u => u !== url);
  // Add to beginning
  urlList.unshift(url);
  // Limit size
  urlList = urlList.slice(0, MAX_URL_LIST_SIZE);

  try {
    localStorage.setItem(STORAGE_KEY_URL_LIST, JSON.stringify(urlList));
    updateUrlListDropdown();
  } catch (e) {
    console.error('Failed to save URL list:', e);
  }
}

function removeUrlFromList(url) {
  let urlList = getUrlList();
  urlList = urlList.filter(u => u !== url);

  try {
    localStorage.setItem(STORAGE_KEY_URL_LIST, JSON.stringify(urlList));
    updateUrlListDropdown();
  } catch (e) {
    console.error('Failed to remove URL from list:', e);
  }
}

function saveUrl() {
  const url = document.getElementById('urlInput').value.trim();
  if (url) {
    localStorage.setItem(STORAGE_KEY_URL, url);
    currentBaseUrl = url;
    saveUrlToList(url);
  }
  localStorage.setItem(STORAGE_KEY_PRELOAD_PYTHON, document.getElementById('preloadPython').checked);
  localStorage.setItem(STORAGE_KEY_PRELOAD_JS, document.getElementById('preloadJS').checked);
}

function loadSavedUrl() {
  const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
  if (savedUrl) {
    document.getElementById('urlInput').value = savedUrl;
    return savedUrl;
  }
  return null;
}

function loadSavedPreloadFlags() {
  const preloadPython = localStorage.getItem(STORAGE_KEY_PRELOAD_PYTHON) === 'true';
  const preloadJS = localStorage.getItem(STORAGE_KEY_PRELOAD_JS) === 'true';
  document.getElementById('preloadPython').checked = preloadPython;
  document.getElementById('preloadJS').checked = preloadJS;
}

function buildUrlWithParams(baseUrl) {
  const url = new URL(baseUrl);
  const preloadPython = document.getElementById('preloadPython').checked;
  const preloadJS = document.getElementById('preloadJS').checked;
  const readonly = document.getElementById('readonlyMode').checked;
  const sheetName = document.getElementById('sheetName').value.trim();

  const preloadValues = [];
  if (preloadPython) preloadValues.push('python');
  if (preloadJS) preloadValues.push('js');

  if (preloadValues.length > 0) {
    url.searchParams.set('preload', preloadValues.join(','));
  } else {
    url.searchParams.delete('preload');
  }

  if (readonly) {
    url.searchParams.set('readonly', '');
  } else {
    url.searchParams.delete('readonly');
  }

  if (sheetName) {
    url.searchParams.set('sheet', sheetName);
  } else {
    url.searchParams.delete('sheet');
  }

  return url.toString();
}

function loadUrl() {
  const urlInput = document.getElementById('urlInput').value.trim();
  if (!urlInput) {
    showError('Please enter a URL');
    return;
  }

  try {
    saveUrl();
    const finalUrl = buildUrlWithParams(urlInput);
    loadIframe(finalUrl);
    updateInfo(finalUrl);
    // Focus will be handled in loadIframe's onload handler
  } catch (e) {
    showError('Invalid URL. Please check and try again.');
    console.error('URL error:', e);
  }
}

function loadIframe(url) {
  const iframe = document.getElementById('quadraticIframe');
  const loading = document.getElementById('loading');

  loading.style.display = 'none';
  iframe.style.display = 'block';
  iframe.src = url;

  iframe.onload = function() {
    console.log('Iframe loaded successfully');
    hideError();
    // Focus the iframe after it loads
    setTimeout(() => {
      iframe.focus();
      // Try to focus the canvas inside the iframe
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const canvas = iframeDoc.querySelector('.pixi_canvas');
          if (canvas) {
            canvas.focus();
          }
        }
      } catch (e) {
        // Cross-origin restrictions may prevent access, which is fine
        // The iframe focus should still work
      }
    }, 500);
  };

  iframe.onerror = function() {
    showError('Failed to load the iframe. Check the console for details.');
  };
}

function updateInfo(url) {
  document.getElementById('currentUrl').textContent = url;
  document.getElementById('copyUrlBtn').style.display = url && url !== 'none' ? 'inline' : 'none';
}

function copyCurrentUrl() {
  const url = document.getElementById('currentUrl').textContent;
  navigator.clipboard.writeText(url);
}

function showError(message) {
  let errorDiv = document.getElementById('error');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'error';
    errorDiv.className = 'error';
    const container = document.querySelector('.container');
    container.insertBefore(errorDiv, container.lastElementChild);
  }
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function hideError() {
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

// Initialize URL list dropdown
function updateUrlListDropdown(filteredList = null) {
  const urlList = filteredList || getUrlList();
  const dropdown = document.getElementById('urlListDropdown');
  const urlInput = document.getElementById('urlInput');

  // Clear existing items
  dropdown.innerHTML = '';

  if (urlList.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  // Add header
  const header = document.createElement('div');
  header.className = 'url-list-header';
  header.textContent = filteredList ? `Matching (${urlList.length})` : `Recently loaded (${urlList.length})`;
  dropdown.appendChild(header);

  // Add items
  urlList.forEach(url => {
    const item = document.createElement('div');
    item.className = 'url-list-item';

    const text = document.createElement('div');
    text.className = 'url-list-item-text';
    text.textContent = url;
    text.onclick = () => {
      urlInput.value = url;
      dropdown.classList.remove('show');
      loadUrl();
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'url-list-item-delete';
    deleteBtn.textContent = '×';
    deleteBtn.setAttribute('aria-label', 'Remove URL');
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      removeUrlFromList(url);
    };

    item.appendChild(text);
    item.appendChild(deleteBtn);
    dropdown.appendChild(item);
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.getElementById('urlInput');
  const urlListDropdown = document.getElementById('urlListDropdown');

  const origin = window.location.origin;
  urlInput.placeholder = `Enter embed URL (e.g., ${origin}/embed?fileId=xxx)`;
  const exampleFileId = document.getElementById('exampleUrlFileId');
  const exampleImport = document.getElementById('exampleUrlImport');
  if (exampleFileId) exampleFileId.textContent = `${origin}/embed?fileId=xxx`;
  if (exampleImport) exampleImport.textContent = `${origin}/embed?import=...`;

  urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      urlListDropdown.classList.remove('show');
      loadUrl();
    }
  });

  urlInput.addEventListener('focus', function() {
    const urlList = getUrlList();
    if (urlList.length > 0) {
      urlListDropdown.classList.add('show');
    }
  });

  urlInput.addEventListener('blur', function() {
    // Delay hiding to allow clicks on dropdown items
    setTimeout(() => {
      urlListDropdown.classList.remove('show');
    }, 200);
  });

  urlInput.addEventListener('input', function() {
    const value = this.value.trim();
    if (value) {
      const urlList = getUrlList();
      const filtered = urlList.filter(url => url.toLowerCase().includes(value.toLowerCase()));
      if (filtered.length > 0) {
        updateUrlListDropdown(filtered);
        urlListDropdown.classList.add('show');
      } else {
        urlListDropdown.classList.remove('show');
      }
    } else {
      updateUrlListDropdown();
      urlListDropdown.classList.add('show');
    }
  });

  // Save preload flags immediately when checkboxes change and reload if embed is already loaded
  document.getElementById('preloadPython').addEventListener('change', function() {
    localStorage.setItem(STORAGE_KEY_PRELOAD_PYTHON, this.checked);
    if (currentBaseUrl) {
      const finalUrl = buildUrlWithParams(currentBaseUrl);
      loadIframe(finalUrl);
      updateInfo(finalUrl);
    }
  });

  document.getElementById('preloadJS').addEventListener('change', function() {
    localStorage.setItem(STORAGE_KEY_PRELOAD_JS, this.checked);
    if (currentBaseUrl) {
      const finalUrl = buildUrlWithParams(currentBaseUrl);
      loadIframe(finalUrl);
      updateInfo(finalUrl);
    }
  });

  // Reload when readonly or sheet name changes
  document.getElementById('readonlyMode').addEventListener('change', function() {
    if (currentBaseUrl) {
      const finalUrl = buildUrlWithParams(currentBaseUrl);
      loadIframe(finalUrl);
      updateInfo(finalUrl);
    }
  });

  document.getElementById('sheetName').addEventListener('change', function() {
    if (currentBaseUrl) {
      const finalUrl = buildUrlWithParams(currentBaseUrl);
      loadIframe(finalUrl);
      updateInfo(finalUrl);
    }
  });

  document.getElementById('clearSheetName').addEventListener('click', function() {
    const sheetNameInput = document.getElementById('sheetName');
    sheetNameInput.value = '';
    if (currentBaseUrl) {
      const finalUrl = buildUrlWithParams(currentBaseUrl);
      loadIframe(finalUrl);
      updateInfo(finalUrl);
    }
  });

  // Load saved URL and preload flags on page load
  loadSavedPreloadFlags();
  updateUrlListDropdown();
  const savedUrl = loadSavedUrl();
  if (savedUrl) {
    setTimeout(() => {
      loadUrl();
    }, 100);
  }
});
