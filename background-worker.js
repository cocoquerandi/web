// Web Worker para procesamiento en background
self.addEventListener('message', (e) => {
  const { action, data } = e.data;
  
  if (action === 'startRecording') {
    console.log('🚂 Worker: Iniciando grabación background');
    
    // Simular grabación GPS
    const interval = setInterval(() => {
      const point = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        lat: -34.6037 + (Math.random() * 0.01),
        lng: -58.3816 + (Math.random() * 0.01),
        velocidad: Math.random() * 50,
        precision: 10 + Math.random() * 20,
        sent: false
      };
      
      // Guardar en IndexedDB
      saveToIndexedDB(point).then(() => {
        self.postMessage({
          action: 'pointSaved',
          data: point
        });
      });
    }, data.interval || 10000);
    
    // Guardar referencia para detener
    self.recordingInterval = interval;
    
  } else if (action === 'stopRecording') {
    console.log('🚂 Worker: Deteniendo grabación');
    clearInterval(self.recordingInterval);
  }
});

async function saveToIndexedDB(point) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TrainAuditDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('gps_points')) {
        const store = db.createObjectStore('gps_points', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['gps_points'], 'readwrite');
      const store = transaction.objectStore('gps_points');
      
      store.add(point);
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}