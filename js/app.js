function loadPage(page) {
  fetch(`pages/${page}.html`)
    .then(response => {
      if (!response.ok) throw new Error("Página no encontrada");
      return response.text();
    })
    .then(html => {
      document.getElementById("content").innerHTML = html;
      closeMenu();
    })
    .catch(err => {
      document.getElementById("content").innerHTML =
        "<h2>Error</h2><p>No se pudo cargar el contenido.</p>";
    });
}

function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  menu.style.display = menu.style.display === "flex" ? "none" : "flex";
}

function closeMenu() {
  document.getElementById("mobileMenu").style.display = "none";
}
