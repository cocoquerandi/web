// Background Script para grabación continua
class BackgroundRecorder {
  constructor() {
    this.isRecording = false;
    this.watchId = null;
    this.recordingInterval = null;
    this.lastPosition = null;
    this.queue = [];
    this.config = {
      interval: 10000, // 10 segundos
      maxQueueSize: 100,
      syncInterval: 30000 // 30 segundos
    };
    
    this.init();
  }
  
  async init() {
    console.log('🎬 Iniciando Background Recorder...');
    
    // Cargar configuración
    await this.loadConfig();
    
    // Iniciar Service Worker
    await this.registerServiceWorker();
    
    // Iniciar listeners
    this.setupListeners();
    
    // Iniciar sincronización periódica
    this.startPeriodicSync();
    
    console.log('✅ Background Recorder listo');
  }
  
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registrado:', registration);
        
        // Registrar sync periódico
        if ('periodicSync' in registration) {
          try {
            await registration.periodicSync.register('periodic-gps-sync', {
              minInterval: 3600000 // 1 hora
            });
            console.log('✅ Periodic Sync registrado');
          } catch (error) {
            console.log('⚠️ Periodic Sync no disponible:', error);
          }
        }
        
      } catch (error) {
        console.error('❌ Error registrando Service Worker:', error);
      }
    }
  }
  
  async loadConfig() {
    try {
      const saved = localStorage.getItem('train_audit_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config.interval = parsed.recordInterval || 10000;
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  }
  
  setupListeners() {
    // Escuchar mensajes desde la app principal
    self.addEventListener('message', event => {
      const { action, data } = event.data;
      
      switch (action) {
        case 'startRecording':
          this.startRecording(data);
          break;
        case 'stopRecording':
          this.stopRecording();
          break;
        case 'updateConfig':
          this.updateConfig(data);
          break;
        case 'syncNow':
          this.triggerSync();
          break;
      }
    });
    
    // Eventos de visibilidad
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('📱 App en segundo plano');
      } else {
        console.log('📱 App en primer plano');
        this.triggerSync();
      }
    });
    
    // Evento online/offline
    window.addEventListener('online', () => {
      console.log('🌐 Conexión restaurada');
      this.triggerSync();
    });
  }
  
  startRecording(config = {}) {
    if (this.isRecording) return;
    
    console.log('🎥 Iniciando grabación en background...');
    this.isRecording = true;
    
    // Actualizar configuración
    if (config.interval) {
      this.config.interval = config.interval;
    }
    
    // Iniciar geolocalización
    this.startWatchingPosition();
    
    // Iniciar intervalo de grabación
    this.recordingInterval = setInterval(() => {
      this.recordCurrentPosition();
    }, this.config.interval);
    
    // Notificar a la app principal
    self.postMessage({
      action: 'recordingStarted',
      data: { time: Date.now() }
    });
  }
  
  stopRecording() {
    if (!this.isRecording) return;
    
    console.log('⏹️ Deteniendo grabación en background...');
    this.isRecording = false;
    
    // Detener geolocalización
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    // Detener intervalo
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    // Sincronizar datos restantes
    this.triggerSync();
    
    // Notificar a la app principal
    self.postMessage({
      action: 'recordingStopped',
      data: { time: Date.now() }
    });
  }
  
  startWatchingPosition() {
    if (!navigator.geolocation) {
      console.error('❌ Geolocalización no disponible');
      return;
    }
    
    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    };
    
    this.watchId = navigator.geolocation.watchPosition(
      position => {
        this.handlePosition(position);
      },
      error => {
        console.error('❌ Error GPS:', error);
        this.handleGPSError(error);
      },
      options
    );
  }
  
  handlePosition(position) {
    this.lastPosition = {
      timestamp: position.timestamp || Date.now(),
      coords: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
        accuracy: position.coords.accuracy
      }
    };
  }
  
  async recordCurrentPosition() {
    if (!this.lastPosition) {
      console.log('⚠️ Esperando posición GPS...');
      return;
    }
    
    try {
      const dataPoint = {
        id: Date.now() + Math.random(),
        timestamp: this.lastPosition.timestamp,
        lat: this.lastPosition.coords.lat,
        lng: this.lastPosition.coords.lng,
        velocidad: (this.lastPosition.coords.speed || 0) * 3.6, // km/h
        direccion: this.lastPosition.coords.heading || 0,
        precision: Math.round(this.lastPosition.coords.accuracy || 0),
        tipo_evento: 'EN_RUTA',
        duracion_parada: 0,
        linea: 'NO_DETECTADA',
        desvio_metros: 0,
        sentido: 'IDA',
        identificador_viaje: `BACKGROUND_${Date.now()}`,
        sent: false,
        createdAt: Date.now()
      };
      
      // Guardar en IndexedDB
      await this.saveToIndexedDB(dataPoint);
      
      // Agregar a cola para sincronización
      this.queue.push(dataPoint);
      
      // Limitar tamaño de cola
      if (this.queue.length > this.config.maxQueueSize) {
        this.queue.shift();
      }
      
      // Sincronizar si hay suficiente datos o tiempo
      if (this.queue.length >= 10) {
        this.triggerSync();
      }
      
      // Notificar a la app principal
      self.postMessage({
        action: 'pointRecorded',
        data: dataPoint
      });
      
    } catch (error) {
      console.error('❌ Error grabando punto:', error);
    }
  }
  
  async saveToIndexedDB(data) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TrainAuditDB', 2);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = event => {
        const db = event.target.result;
        const transaction = db.transaction(['gps_data'], 'readwrite');
        const store = transaction.objectStore('gps_data');
        
        const addRequest = store.add(data);
        
        addRequest.onsuccess = () => resolve(addRequest.result);
        addRequest.onerror = () => reject(addRequest.error);
      };
      
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
      };
    });
  }
  
  async triggerSync() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.ready) {
      console.log('⚠️ Service Worker no está listo');
      return;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      
      if ('sync' in registration) {
        await registration.sync.register('gps-queue');
        console.log('🔄 Background Sync registrado');
      } else {
        console.log('⚠️ Background Sync no disponible, sincronizando ahora...');
        await this.syncData();
      }
    } catch (error) {
      console.error('❌ Error registrando sync:', error);
    }
  }
  
  async syncData() {
    try {
      const db = await this.openDatabase();
      const pendingData = await this.getPendingData(db);
      
      if (pendingData.length === 0) {
        console.log('✅ No hay datos pendientes');
        return;
      }
      
      console.log(`📤 Sincronizando ${pendingData.length} puntos...`);
      
      // Enviar a Google Sheets
      const result = await this.sendToGoogleSheets(pendingData);
      
      if (result.success) {
        // Marcar como enviados en IndexedDB
        await this.markAsSent(db, result.sentIds);
        
        // Limpiar cola
        this.queue = this.queue.filter(item => 
          !result.sentIds.includes(item.id)
        );
        
        console.log('✅ Datos sincronizados exitosamente');
        
        // Mostrar notificación
        this.showNotification(
          'Auditoría Ferroviaria',
          `${pendingData.length} puntos sincronizados en background`
        );
      }
      
    } catch (error) {
      console.error('❌ Error sincronizando datos:', error);
    }
  }
  
  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TrainAuditDB', 2);
      
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event.target.error);
    });
  }
  
  async getPendingData(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['gps_data'], 'readonly');
      const store = transaction.objectStore('gps_data');
      const index = store.index('sent');
      const request = index.getAll(IDBKeyRange.only(false));
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
  
  async markAsSent(db, ids) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['gps_data'], 'readwrite');
      const store = transaction.objectStore('gps_data');
      
      ids.forEach(id => {
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const data = getRequest.result;
          if (data) {
            data.sent = true;
            store.put(data);
          }
        };
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  async sendToGoogleSheets(data) {
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
  
  showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: 'icon-192.png',
        badge: 'icon-192.png'
      });
    }
  }
  
  startPeriodicSync() {
    setInterval(() => {
      if (this.queue.length > 0) {
        this.triggerSync();
      }
    }, this.config.syncInterval);
  }
  
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('background_recorder_config', JSON.stringify(this.config));
  }
  
  handleGPSError(error) {
    console.error('❌ Error GPS en background:', error);
    
    // Notificar a la app principal
    self.postMessage({
      action: 'gpsError',
      data: { error: error.message }
    });
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.backgroundRecorder = new BackgroundRecorder();
  });
} else {
  window.backgroundRecorder = new BackgroundRecorder();
}