const mensajes = [
  "📱 Seguinos en Instagram @vapezrt_",
  "🕒 Horarios: lunes a lunes de 10 AM a 00:00"
];

const imagenesHero = [
  "/assets/2023_1120_Ignite_Lifestyle_MikeKirschbaum_016_1_1000x.webp",
  "assets/Imagen de WhatsApp 2025-07-17 a las 22.23.09_bf985f76.webp.jpg",
  "/assets/Imagen de WhatsApp 2025-07-18 a las 01.27.53_af5c1526.jpg"
];

let indexMensaje = 0;
let indexHero = 0;

document.addEventListener("DOMContentLoaded", () => {
  const mensajeEl = document.getElementById("mensaje-rotativo");
  if (mensajeEl) {
    const actualizarMensaje = () => {
      mensajeEl.textContent = mensajes[indexMensaje];
      mensajeEl.style.animation = "none";
      void mensajeEl.offsetWidth;
      mensajeEl.style.animation = "slide 16s linear infinite";
      indexMensaje = (indexMensaje + 1) % mensajes.length;
    };

    actualizarMensaje();
    setInterval(actualizarMensaje, 16000);
  }

  const heroImg = document.getElementById("hero-imagen");
  if (heroImg) {
    setInterval(() => {
      indexHero = (indexHero + 1) % imagenesHero.length;
      heroImg.src = imagenesHero[indexHero];
    }, 5000);
  }

  const cerrarModal = document.getElementById("cerrarModal");
  const modal = document.getElementById("modal");
  if (cerrarModal && modal) {
    cerrarModal.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    window.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }
});
