// Service Worker para Auditoría Ferroviaria
const CACHE_NAME = 'train-audit-v1';
const QUEUE_NAME = 'gps-queue';

// Archivos para cache
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './background.js'
];

// Instalar Service Worker
self.addEventListener('install', event => {
  console.log('🚀 Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cacheando archivos');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activar Service Worker
self.addEventListener('activate', event => {
  console.log('✅ Service Worker activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Limpiando cache viejo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar fetch requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Background Sync para datos GPS
self.addEventListener('sync', event => {
  console.log('🔄 Background Sync:', event.tag);
  
  if (event.tag === QUEUE_NAME) {
    event.waitUntil(syncData());
  }
});

// Periodic Sync (cada hora)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'periodic-gps-sync') {
    console.log('⏰ Periodic Sync ejecutado');
    event.waitUntil(syncData());
  }
});

// Función para sincronizar datos
async function syncData() {
  try {
    // Obtener datos de IndexedDB
    const db = await openDatabase();
    const pendingData = await getAllPendingData(db);
    
    if (pendingData.length === 0) {
      console.log('✅ No hay datos pendientes');
      return;
    }
    
    console.log(`📤 Sincronizando ${pendingData.length} puntos...`);
    
    // Enviar a Google Sheets
    const result = await sendToGoogleSheets(pendingData);
    
    if (result.success) {
      // Eliminar datos enviados
      await clearSentData(db, result.sentIds);
      console.log('✅ Datos sincronizados exitosamente');
      
      // Mostrar notificación
      self.registration.showNotification('Auditoría Ferroviaria', {
        body: `${pendingData.length} puntos sincronizados`,
        icon: 'icon-192.png',
        badge: 'icon-192.png'
      });
    }
    
  } catch (error) {
    console.error('❌ Error en sync:', error);
  }
}

// Abrir base de datos IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TrainAuditDB', 2);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('gps_data')) {
        const store = db.createObjectStore('gps_data', {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('sent', 'sent', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

// Obtener todos los datos pendientes
function getAllPendingData(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['gps_data'], 'readonly');
    const store = transaction.objectStore('gps_data');
    const index = store.index('sent');
    const request = index.getAll(IDBKeyRange.only(false));
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Eliminar datos enviados
function clearSentData(db, ids) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['gps_data'], 'readwrite');
    const store = transaction.objectStore('gps_data');
    
    ids.forEach(id => {
      store.delete(id);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Enviar a Google Sheets (adaptado para Service Worker)
async function sendToGoogleSheets(data) {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwGGJpiJVLYRrquwUXrlAxvLQobstdSYbo7BIHrpZeucwUFSFF7Tw20tzsAbWNwoDbR/exec';
  
  try {
    const formattedData = data.map(item => ({
      Timestamp: new Date(item.timestamp).toISOString(),
      lat: item.lat,
      lng: item.lng,
      velocidad: item.velocidad || 0,
      direccion: item.direccion || 0,
      precision: item.precision || 0,
      tipo_evento: item.tipo_evento || 'EN_RUTA',
      duracion_parada: item.duracion_parada || 0,
      linea: item.linea || 'NO_DETECTADA',
      desvio_metros: item.desvio_metros || 0,
      sentido: item.sentido || 'IDA',
      identificador_viaje: item.identificador_viaje || 'BACKGROUND'
    }));
    
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'action=saveData&data=' + encodeURIComponent(JSON.stringify(formattedData))
    });
    
    const result = await response.json();
    
    return {
      success: result.status === 'success',
      sentIds: data.map(item => item.id)
    };
    
  } catch (error) {
    console.error('Error enviando datos:', error);
    throw error;
  }
}