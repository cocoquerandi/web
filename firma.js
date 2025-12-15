const canvas = document.getElementById("firma");
const ctx = canvas.getContext("2d");

let dibujando = false;

canvas.addEventListener("pointerdown", e => {
  dibujando = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener("pointermove", e => {
  if (!dibujando) return;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
});

canvas.addEventListener("pointerup", () => dibujando = false);

function limpiarFirma() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

document.getElementById("formulario").addEventListener("submit", async e => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const firmaBase64 = canvas.toDataURL("image/png");

  const payload = Object.fromEntries(formData);
  payload.firma = firmaBase64;

  await fetch("/generar-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  alert("Formulario enviado correctamente");
});
