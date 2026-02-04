// Sistema de renderizado Markdown a HTML con estilos científicos
class MarkdownRenderer {
    constructor() {
        // Configurar marked.js con opciones personalizadas
        marked.setOptions({
            breaks: true,
            gfm: true,
            smartLists: true,
            smartypants: true,
            langPrefix: 'language-',
            highlight: function(code, lang) {
                return code; // Simple highlighting, podrías agregar Prism.js
            }
        });
        
        // Renderizadores personalizados
        this.setupCustomRenderers();
    }
    
    setupCustomRenderers() {
        const renderer = new marked.Renderer();
        
        // Personalizar encabezados
        renderer.heading = (text, level) => {
            const id = text.toLowerCase().replace(/[^\w]+/g, '-');
            
            switch(level) {
                case 1:
                    return `<h1 id="${id}">${text}</h1>`;
                case 2:
                    return `<h2 id="${id}"><span class="section-number"></span>${text}</h2>`;
                case 3:
                    return `<h3 id="${id}">${text}</h3>`;
                case 4:
                    return `<h4 id="${id}">${text}</h4>`;
                default:
                    return `<h${level} id="${id}">${text}</h${level}>`;
            }
        };
        
        // Personalizar tablas
        renderer.table = (header, body) => {
            return `
                <div class="table-responsive">
                    <table class="scientific-table">
                        <thead>${header}</thead>
                        <tbody>${body}</tbody>
                    </table>
                </div>
            `;
        };
        
        // Personalizar bloques de código
        renderer.code = (code, language, isEscaped) => {
            const lang = language || 'text';
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="language">${lang}</span>
                        <button class="copy-code" onclick="copyToClipboard(this)">Copiar</button>
                    </div>
                    <pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>
                </div>
            `;
        };
        
        // Personalizar bloques de citas
        renderer.blockquote = (quote) => {
            return `<blockquote class="scientific-quote">${quote}</blockquote>`;
        };
        
        marked.use({ renderer });
    }
    
    // Convertir markdown a HTML con estilos científicos
    render(markdown) {
        // Procesar markdown
        let html = marked.parse(markdown);
        
        // Post-procesamiento para agregar clases específicas
        html = this.postProcess(html);
        
        return html;
    }
    
    postProcess(html) {
        // Agregar números de sección automáticamente
        let sectionCounter = 0;
        let subsectionCounter = 0;
        
        html = html.replace(/<h2[^>]*>/g, (match) => {
            sectionCounter++;
            subsectionCounter = 0;
            return match.replace('<span class="section-number"></span>', 
                                `<span class="section-number">${sectionCounter}</span>`);
        });
        
        // Agregar clases a elementos específicos
        html = html.replace(/<table/g, '<table class="scientific-table"');
        html = html.replace(/<ul>/g, '<ul class="scientific-list">');
        html = html.replace(/<ol>/g, '<ol class="scientific-list">');
        html = html.replace(/<blockquote/g, '<blockquote class="scientific-quote"');
        
        // Detectar y formatear notas importantes
        html = html.replace(/\[!IMPORTANT\]\s*(.*?)(?=\n\n|$)/gs, 
                            '<div class="important-note">$1</div>');
        
        // Detectar y formatear advertencias
        html = html.replace(/\[!WARNING\]\s*(.*?)(?=\n\n|$)/gs, 
                            '<div class="warning-note">$1</div>');
        
        // Detectar y formatear información
        html = html.replace(/\[!INFO\]\s*(.*?)(?=\n\n|$)/gs, 
                            '<div class="info-note">$1</div>');
        
        return html;
    }
    
    // Método para crear diagramas a partir de texto
    createDiagram(type, data) {
        switch(type) {
            case 'pie':
                return this.createPieChart(data);
            case 'bar':
                return this.createBarChart(data);
            case 'timeline':
                return this.createTimeline(data);
            default:
                return `<div class="diagram-placeholder">Diagrama: ${type}</div>`;
        }
    }
    
    createPieChart(data) {
        // Implementación simple de gráfico de torta con CSS
        return `
            <div class="pie-chart">
                <div class="pie-chart-title">${data.title || 'Distribución'}</div>
                <div class="pie-chart-container">
                    ${data.sections.map((section, i) => `
                        <div class="pie-section" 
                             style="--percentage: ${section.value}; --color: ${section.color || '#3498db'};">
                            <span class="pie-label">${section.label} (${section.value}%)</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    createTimeline(items) {
        return `
            <div class="timeline">
                ${items.map((item, i) => `
                    <div class="timeline-item">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <div class="timeline-date">${item.date}</div>
                            <div class="timeline-title">${item.title}</div>
                            <div class="timeline-description">${item.description}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

// Función auxiliar para escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Función para copiar código al portapapeles
function copyToClipboard(button) {
    const code = button.parentElement.nextElementSibling.textContent;
    navigator.clipboard.writeText(code).then(() => {
        const originalText = button.textContent;
        button.textContent = '¡Copiado!';
        button.style.background = '#27ae60';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    });
}

// Inicializar renderizador
const renderer = new MarkdownRenderer();

// Función para renderizar contenido en la página
function renderContent(markdown) {
    const container = document.getElementById('project-content');
    
    if (!markdown || markdown.trim() === '') {
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>No se pudo cargar el contenido</h3>
                <p>El documento está vacío o no se pudo acceder.</p>
                <button onclick="toggleConfigModal(true)" class="btn-primary">
                    <i class="fas fa-cog"></i> Configurar Documento
                </button>
            </div>
        `;
        return;
    }
    
    try {
        // Renderizar markdown a HTML
        const html = renderer.render(markdown);
        
        // Insertar en el contenedor
        container.innerHTML = html;
        
        // Aplicar efectos adicionales
        applyPostRenderEffects();
        
    } catch (error) {
        console.error('Error renderizando contenido:', error);
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error al renderizar el documento</h3>
                <p>${error.message}</p>
                <button onclick="location.reload()" class="btn-primary">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// Efectos post-renderizado
function applyPostRenderEffects() {
    // Agregar numeración a las tablas
    document.querySelectorAll('.scientific-table').forEach((table, index) => {
        const caption = table.previousElementSibling;
        if (caption && caption.tagName === 'P' && caption.textContent.includes('Tabla')) {
            table.setAttribute('data-table-id', `tabla-${index + 1}`);
        }
    });
    
    // Agregar interactividad a las imágenes
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('click', function() {
            openLightbox(this.src, this.alt);
        });
    });
    
    // Inicializar tooltips para abreviaturas
    document.querySelectorAll('abbr').forEach(abbr => {
        abbr.title = abbr.title || abbr.textContent;
    });
}

// Lightbox para imágenes
function openLightbox(src, alt) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <img src="${src}" alt="${alt}">
            <div class="lightbox-caption">${alt}</div>
            <button class="lightbox-close">&times;</button>
        </div>
    `;
    
    document.body.appendChild(lightbox);
    
    lightbox.querySelector('.lightbox-close').addEventListener('click', () => {
        lightbox.remove();
    });
    
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            lightbox.remove();
        }
    });
}

// Exportar funciones
window.renderContent = renderContent;
window.MarkdownRenderer = MarkdownRenderer;