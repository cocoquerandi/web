// Código para Google Apps Script que permite acceso API
// Ve a: https://script.google.com/ y pega este código

function doGet(e) {
  const docId = e.parameter.id;
  
  if (!docId) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Se requiere ID del documento'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const doc = DocumentApp.openById(docId);
    const content = doc.getBody().getText();
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        content: content,
        title: doc.getName(),
        lastUpdated: doc.getLastUpdated().toISOString(),
        editors: doc.getEditors().map(editor => editor.getEmail())
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Función para publicar como web app:
// 1. Guarda el script
// 2. Ve a "Publicar" -> "Implementar como aplicación web"
// 3. Configura: "Ejecutar como" -> "Yo", "Quién tiene acceso" -> "Cualquiera, incluso anónimos"
// 4. Copia la URL generada