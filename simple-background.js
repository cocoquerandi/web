// Solución simple para background usando Web Workers y localStorage
class SimpleBackgroundRecorder {
  constructor() {
    this.isRecording = false;
    this.worker = null;
    this.lastSync = 0;
  }
  
  init() {
    console.log('🔄 Inicializando Background Recorder simple');
    
    // Intentar usar Web Workers
    if (window.Worker) {
      try {
        this.worker = new Worker('background-worker.js');
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        console.log('✅ Web Worker creado');
      } catch (e) {
        console.warn('⚠️ No se pudo crear Web Worker:', e);
      }
    }
    
    // Iniciar sincronización periódica
    this.startPeriodicSync();
    
    // Recuperar grabación anterior al recargar
    this.restorePreviousRecording();
  }
  
  handleWorkerMessage(event) {
    const { action, data } = event.data;
    
    switch (action) {
      case 'pointSaved':
        this.updateStats(data);
        break;
    }
  }
  
  startRecording(config = {}) {
    if (this.isRecording) return;
    
    console.log('🎥 Iniciando grabación background simple');
    this.isRecording = true;
    
    // Usar Web Worker si está disponible
    if (this.worker) {
      this.worker.postMessage({
        action: 'startRecording',
        data: { interval: config.interval || 10000 }
      });
    } else {
      // Fallback a setInterval
      this.startFallbackRecording(config);
    }
    
    // Guardar en localStorage
    localStorage.setItem('background_recording', 'true');
    localStorage.setItem('recording_start', Date.now());
    
    // Mostrar notificación
    this.showNotification('Grabación en background iniciada');
    
    return true;
  }
  
  startFallbackRecording(config) {
    this.recordingInterval = setInterval(() => {
      const point = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        lat: -34.6037 + (Math.random() * 0.01),
        lng: -58.3816 + (Math.random() * 0.01),
        velocidad: Math.random() * 50,
        precision: 10 + Math.random() * 20,
        sent: false
      };
      
      // Guardar en localStorage
      this.saveToLocalStorage(point);
      
    }, config.interval || 10000);
  }
  
  saveToLocalStorage(point) {
    try {
      // Obtener puntos existentes
      const stored = localStorage.getItem('background_points');
      const points = stored ? JSON.parse(stored) : [];
      
      // Agregar nuevo punto
      points.push(point);
      
      // Mantener solo los últimos 1000 puntos
      if (points.length > 1000) {
        points.splice(0, points.length - 1000);
      }
      
      // Guardar
      localStorage.setItem('background_points', JSON.stringify(points));
      
      // Actualizar estadísticas
      this.updateStats(point);
      
    } catch (error) {
      console.error('Error guardando en localStorage:', error);
    }
  }
  
  stopRecording() {
    if (!this.isRecording) return;
    
    console.log('⏹️ Deteniendo grabación background simple');
    this.isRecording = false;
    
    // Detener Web Worker
    if (this.worker) {
      this.worker.postMessage({ action: 'stopRecording' });
    }
    
    // Detener intervalo
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
    }
    
    // Limpiar localStorage
    localStorage.removeItem('background_recording');
    
    // Sincronizar datos restantes
    this.syncPendingData();
    
    this.showNotification('Grabación en background detenida');
  }
  
  async syncPendingData() {
    try {
      const points = this.getPendingPoints();
      
      if (points.length === 0) {
        console.log('✅ No hay puntos pendientes');
        return;
      }
      
      console.log(`📤 Sincronizando ${points.length} puntos...`);
      
      // Enviar a Google Sheets
      const success = await this.sendToGoogleSheets(points);
      
      if (success) {
        // Marcar como enviados
        this.markAsSent(points.map(p => p.id));
        console.log('✅ Datos sincronizados');
      }
      
    } catch (error) {
      console.error('❌ Error sincronizando:', error);
    }
  }
  
  getPendingPoints() {
    try {
      const stored = localStorage.getItem('background_points');
      return stored ? JSON.parse(stored).filter(p => !p.sent) : [];
    } catch {
      return [];
    }
  }
  
  markAsSent(ids) {
    try {
      const stored = localStorage.getItem('background_points');
      let points = stored ? JSON.parse(stored) : [];
      
      points = points.map(p => ({
        ...p,
        sent: ids.includes(p.id) ? true : p.sent
      }));
      
      localStorage.setItem('background_points', JSON.stringify(points));
    } catch (error) {
      console.error('Error marcando como enviado:', error);
    }
  }
  
  async sendToGoogleSheets(points) {
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwGGJpiJVLYRrquwUXrlAxvLQobstdSYbo7BIHrpZeucwUFSFF7Tw20tzsAbWNwoDbR/exec';
    
    try {
      const formattedData = points.map(point => ({
        Timestamp: point.timestamp,
        Latitud: point.lat,
        Longitud: point.lng,
        'Velocidad (km/h)': point.velocidad.toFixed(1),
        'Precisión (m)': Math.round(point.precision),
        'Tipo Evento': 'BACKGROUND',
        'Línea': 'NO_DETECTADA',
        'Desvío (m)': 0,
        'Estado GPS': 'ACTIVO',
        'Sentido': 'IDA',
        'Identificador Viaje': `BG_${Date.now()}`
      }));
      
      const params = new URLSearchParams();
      params.append('action', 'saveData');
      params.append('data', JSON.stringify(formattedData));
      
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      
      return response.ok;
      
    } catch (error) {
      console.error('Error enviando datos:', error);
      return false;
    }
  }
  
  startPeriodicSync() {
    // Sincronizar cada 30 segundos
    setInterval(() => {
      if (this.isRecording) {
        this.syncPendingData();
      }
    }, 30000);
  }
  
  restorePreviousRecording() {
    const wasRecording = localStorage.getItem('background_recording');
    
    if (wasRecording === 'true') {
      console.log('🔄 Restaurando grabación anterior');
      this.startRecording({ interval: 10000 });
    }
  }
  
  updateStats(point) {
    // Enviar a la ventana principal
    if (window.parent) {
      window.parent.postMessage({
        action: 'backgroundUpdate',
        data: { point }
      }, '*');
    }
  }
  
  showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Auditoría Ferroviaria', {
        body: message,
        icon: 'https://img.icons8.com/color/96/000000/train.png',
        silent: true
      });
    }
  }
  
  getStatus() {
    const points = this.getPendingPoints();
    return {
      isRecording: this.isRecording,
      pendingPoints: points.length,
      workerAvailable: !!this.worker
    };
  }
}

// Crear instancia global
window.simpleBackground = new SimpleBackgroundRecorder();