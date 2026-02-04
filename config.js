// Configuración del sistema de sincronización
class ConfigManager {
    constructor() {
        this.config = {
            // URL por defecto - REEMPLAZA CON TU URL REAL
            docUrl: 'https://docs.google.com/document/d/1TuDocumentoIDaqui/edit?usp=sharing',
            exportUrl: 'https://docs.google.com/document/d/1TuDocumentoIDaqui/export?format=txt',
            syncInterval: 15, // minutos
            autoSync: true,
            lastSync: null,
            docId: null,
            docName: 'Proyecto Coco Querandí'
        };
        
        this.init();
    }
    
    init() {
        // Cargar configuración desde localStorage
        const savedConfig = localStorage.getItem('cocoQuerandiConfig');
        if (savedConfig) {
            try {
                this.config = { ...this.config, ...JSON.parse(savedConfig) };
            } catch (e) {
                console.error('Error cargando configuración:', e);
            }
        }
        
        // Extraer ID del documento de la URL
        this.extractDocId();
    }
    
    extractDocId() {
        const url = this.config.docUrl;
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            this.config.docId = match[1];
            this.config.exportUrl = `https://docs.google.com/document/d/${this.config.docId}/export?format=txt`;
        }
    }
    
    save() {
        localStorage.setItem('cocoQuerandiConfig', JSON.stringify(this.config));
    }
    
    update(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.save();
        this.extractDocId();
    }
    
    get() {
        return this.config;
    }
    
    // Método para validar URL de Google Docs
    isValidGoogleDocsUrl(url) {
        return url.includes('docs.google.com/document/d/');
    }
}

// Inicializar gestor de configuración
const configManager = new ConfigManager();

// Función para mostrar/ocultar modal de configuración
function toggleConfigModal(show = true) {
    const modal = document.getElementById('config-modal');
    if (show) {
        // Cargar configuración actual en el formulario
        const config = configManager.get();
        document.getElementById('doc-url').value = config.docUrl;
        document.getElementById('sync-interval').value = config.syncInterval;
        document.getElementById('auto-sync').checked = config.autoSync;
        
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
}

// Configurar eventos del modal
document.addEventListener('DOMContentLoaded', function() {
    // Botón para abrir configuración (puedes añadirlo en el header)
    const configBtn = document.getElementById('config-btn');
    if (configBtn) {
        configBtn.addEventListener('click', () => toggleConfigModal(true));
    }
    
    // Botón para cerrar modal
    document.getElementById('close-config').addEventListener('click', () => toggleConfigModal(false));
    
    // Guardar configuración
    document.getElementById('save-config').addEventListener('click', function() {
        const docUrl = document.getElementById('doc-url').value;
        
        if (!configManager.isValidGoogleDocsUrl(docUrl)) {
            alert('Por favor, ingresa una URL válida de Google Docs');
            return;
        }
        
        configManager.update({
            docUrl: docUrl,
            syncInterval: parseInt(document.getElementById('sync-interval').value),
            autoSync: document.getElementById('auto-sync').checked
        });
        
        toggleConfigModal(false);
        
        // Reiniciar sincronización con nueva configuración
        if (window.syncManager) {
            window.syncManager.restartSync();
        }
        
        // Actualizar interfaz
        updateUI();
    });
    
    // Cerrar modal al hacer clic fuera
    document.getElementById('config-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            toggleConfigModal(false);
        }
    });
});

// Exportar configuración
window.configManager = configManager;
window.toggleConfigModal = toggleConfigModal;