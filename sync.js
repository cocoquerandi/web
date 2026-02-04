// Sistema de sincronización con Google Docs
class GoogleDocsSync {
    constructor() {
        this.config = configManager.get();
        this.isSyncing = false;
        this.syncInterval = null;
        this.lastContent = null;
        this.init();
    }
    
    init() {
        // Configurar eventos
        this.setupEventListeners();
        
        // Iniciar sincronización automática
        if (this.config.autoSync) {
            this.startAutoSync();
        }
        
        // Realizar primera sincronización
        this.sync();
    }
    
    setupEventListeners() {
        // Botón de sincronización manual
        document.getElementById('manual-sync').addEventListener('click', () => {
            this.sync();
        });
        
        // Botón para abrir documento en Google Docs
        document.getElementById('edit-doc').addEventListener('click', (e) => {
            e.preventDefault();
            window.open(this.config.docUrl, '_blank');
        });
        
        // Botones de exportación
        document.getElementById('export-pdf').addEventListener('click', () => {
            this.exportToPDF();
        });
        
        document.getElementById('print-doc').addEventListener('click', () => {
            window.print();
        });
    }
    
    // Iniciar sincronización automática
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        if (this.config.syncInterval > 0) {
            const intervalMs = this.config.syncInterval * 60 * 1000;
            this.syncInterval = setInterval(() => {
                if (!this.isSyncing) {
                    this.sync();
                }
            }, intervalMs);
            
            console.log(`Sincronización automática cada ${this.config.syncInterval} minutos`);
        }
    }
    
    // Detener sincronización automática
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    
    // Reiniciar con nueva configuración
    restartSync() {
        this.config = configManager.get();
        this.stopAutoSync();
        
        if (this.config.autoSync) {
            this.startAutoSync();
        }
        
        // Actualizar URL del botón de edición
        document.getElementById('edit-doc').href = this.config.docUrl;
    }
    
    // Sincronizar con Google Docs
    async sync() {
        if (this.isSyncing) return;
        
        this.isSyncing = true;
        this.updateSyncStatus('Sincronizando...', 'syncing');
        
        try {
            // Obtener contenido desde Google Docs
            const content = await this.fetchGoogleDocsContent();
            
            if (content && content !== this.lastContent) {
                // Renderizar nuevo contenido
                renderContent(content);
                this.lastContent = content;
                
                // Actualizar metadata
                this.updateDocumentMetadata();
                
                this.updateSyncStatus('Sincronizado', 'success');
                console.log('Documento sincronizado exitosamente');
            } else {
                this.updateSyncStatus('Sin cambios', 'no-changes');
            }
            
        } catch (error) {
            console.error('Error sincronizando:', error);
            this.updateSyncStatus('Error al sincronizar', 'error');
            
            // Mostrar error al usuario
            this.showSyncError(error);
            
        } finally {
            this.isSyncing = false;
        }
    }
    
    // Obtener contenido de Google Docs
    async fetchGoogleDocsContent() {
        // Usar proxy para evitar problemas de CORS
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const targetUrl = this.config.exportUrl;
        
        try {
            const response = await fetch(proxyUrl + targetUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            
            // Limpiar y formatear el texto
            return this.cleanGoogleDocsContent(text);
            
        } catch (error) {
            // Si falla con proxy, intentar método alternativo
            return await this.tryAlternativeMethod();
        }
    }
    
    // Método alternativo usando Google Apps Script
    async tryAlternativeMethod() {
        const scriptUrl = `https://script.google.com/macros/s/AKfycbwYourScriptID/exec`;
        
        try {
            const response = await fetch(`${scriptUrl}?id=${this.config.docId}`);
            const data = await response.json();
            
            if (data.success && data.content) {
                return data.content;
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            throw new Error(`No se pudo obtener el contenido: ${error.message}`);
        }
    }
    
    // Limpiar contenido de Google Docs
    cleanGoogleDocsContent(text) {
        // Eliminar metadatos de Google Docs
        let cleaned = text
            .replace(/\x00/g, '') // Caracteres nulos
            .replace(//g, '') // Caracteres especiales
            .replace(/\n{3,}/g, '\n\n') // Múltiples saltos de línea
            .trim();
        
        // Convertir marcadores específicos de Google Docs a Markdown
        cleaned = cleaned
            .replace(/\*\*(.*?)\*\*/g, '**$1**') // Negrita
            .replace(/_(.*?)_/g, '*$1*') // Cursiva
            .replace(/\[(.*?)\]\((.*?)\)/g, '[$1]($2)') // Links
        
        return cleaned;
    }
    
    // Actualizar estado de sincronización en la UI
    updateSyncStatus(message, status = 'syncing') {
        const icon = document.getElementById('sync-icon');
        const statusText = document.getElementById('sync-status');
        const lastUpdate = document.getElementById('last-update');
        
        statusText.textContent = message;
        
        // Actualizar icono según estado
        switch(status) {
            case 'syncing':
                icon.className = 'fas fa-sync-alt fa-spin';
                icon.style.color = '#f39c12';
                break;
            case 'success':
                icon.className = 'fas fa-check-circle';
                icon.style.color = '#27ae60';
                break;
            case 'error':
                icon.className = 'fas fa-exclamation-circle';
                icon.style.color = '#e74c3c';
                break;
            case 'no-changes':
                icon.className = 'fas fa-check';
                icon.style.color = '#3498db';
                break;
        }
        
        // Actualizar hora de última sincronización
        const now = new Date();
        lastUpdate.textContent = `Última sincronización: ${now.toLocaleTimeString()}`;
        
        // Actualizar en el footer también
        document.getElementById('update-time').textContent = now.toLocaleString();
    }
    
    // Actualizar metadata del documento
    updateDocumentMetadata() {
        document.getElementById('doc-id').textContent = this.config.docId || 'No configurado';
        
        // Intentar obtener información del editor (esto sería con API más avanzada)
        // Por ahora, simular
        document.getElementById('last-editor').textContent = 'Usuario del equipo';
    }
    
    // Mostrar error de sincronización
    showSyncError(error) {
        // Podrías implementar un sistema de notificaciones más sofisticado
        console.error('Error de sincronización:', error);
        
        const container = document.getElementById('project-content');
        if (container.innerHTML.includes('error-message')) return;
        
        const errorHtml = `
            <div class="error-message" style="margin: 20px; padding: 20px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px;">
                <h3><i class="fas fa-exclamation-triangle"></i> Error de Sincronización</h3>
                <p>${error.message}</p>
                <p><small>URL del documento: ${this.config.docUrl}</small></p>
                <div style="margin-top: 15px;">
                    <button onclick="window.syncManager.sync()" class="btn-primary">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                    <button onclick="toggleConfigModal(true)" class="btn-secondary">
                        <i class="fas fa-cog"></i> Cambiar Configuración
                    </button>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('afterbegin', errorHtml);
    }
    
    // Exportar a PDF
    exportToPDF() {
        // Usar html2pdf.js o similar para exportar
        const element = document.getElementById('project-content');
        
        const opt = {
            margin:       1,
            filename:     `Proyecto_Coco_Querandí_${new Date().toISOString().split('T')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        
        // Cargar html2pdf.js dinámicamente
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => {
            html2pdf().set(opt).from(element).save();
        };
        document.head.appendChild(script);
    }
}

// Inicializar sistema de sincronización
function initializeSystem() {
    // Crear instancia del sincronizador
    window.syncManager = new GoogleDocsSync();
    
    // Actualizar interfaz con configuración actual
    updateUI();
    
    // Configurar botón de configuración si no existe
    if (!document.getElementById('config-btn')) {
        const configBtn = document.createElement('button');
        configBtn.id = 'config-btn';
        configBtn.className = 'btn-edit';
        configBtn.innerHTML = '<i class="fas fa-cog"></i> Configurar';
        configBtn.style.marginLeft = '10px';
        
        configBtn.addEventListener('click', () => toggleConfigModal(true));
        document.querySelector('.sync-controls').appendChild(configBtn);
    }
}

// Actualizar interfaz con configuración actual
function updateUI() {
    const config = configManager.get();
    
    // Actualizar enlace de edición
    document.getElementById('edit-doc').href = config.docUrl;
    
    // Actualizar información del documento
    document.getElementById('doc-id').textContent = config.docId || 'No configurado';
}

// Exportar funciones globales
window.initializeSystem = initializeSystem;
window.GoogleDocsSync = GoogleDocsSync;