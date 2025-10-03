import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBkCmjY9pCUXLia-fsw9Od4AybFxRzCAjg",
  authDomain: "vapezrt-56f20.firebaseapp.com",
  projectId: "vapezrt-56f20",
  storageBucket: "vapezrt-56f20.appspot.com",
  messagingSenderId: "1000261974016",
  appId: "1:1000261974016:web:281161e24522eb2bee00e5",
  measurementId: "G-B84Z2N19NE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const contenedor = document.querySelector(".productos");
const buscador = document.getElementById("buscador");

if (contenedor) {
  contenedor.innerHTML = "";
}

async function cargarProductos() {
  if (!contenedor) {
    return;
  }

  try {
    const querySnapshot = await getDocs(collection(db, "productos"));
    querySnapshot.forEach((doc) => {
      const prod = doc.data();

      const tarjeta = document.createElement("article");
      tarjeta.classList.add("producto");

      const sanitize = (value) =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const badge = prod.badge || prod.etiqueta;
      const precio = prod.precio;
      const nombreRaw = prod.nombre || "";
      const saborRaw = prod.sabor || "";
      const imagenRaw = prod.imagen || "";
      const nombreLimpio = sanitize(nombreRaw);
      const saborLimpio = sanitize(saborRaw);
      const imagenLimpia = sanitize(imagenRaw);
      const badgeMarkup = badge ? `<span class="producto-badge">${sanitize(badge)}</span>` : "";
      const precioMarkup = precio ? `<p class="producto-precio">${sanitize(precio)}</p>` : "";
      const whatsappMensaje = encodeURIComponent(
        `Hola! Estoy interesado en ${nombreRaw}${saborRaw ? ` (${saborRaw})` : ""}`
      );

      tarjeta.innerHTML = `
        <div class="producto-media" role="button" tabindex="0" aria-label="Ver detalles de ${nombreLimpio}">
          <img src="${imagenLimpia}" alt="${nombreLimpio}">
          ${badgeMarkup}
        </div>
        <div class="producto-info">
          <h3>${nombreLimpio}</h3>
          <p class="producto-sabor">${saborLimpio}</p>
          ${precioMarkup}
        </div>
        <div class="producto-actions">
          <a class="producto-btn producto-btn-primary" href="https://wa.me/5493487652952?text=${whatsappMensaje}" target="_blank" rel="noopener">Añadir</a>
          <button type="button" class="producto-btn producto-btn-secondary" data-action="detalles">Detalles</button>
        </div>
      `;

      const modal = document.getElementById("modal");
      const modalImg = document.getElementById("modal-img");
      const modalNombre = document.getElementById("modal-nombre");
      const modalSabor = document.getElementById("modal-sabor");
      const modalWsp = document.getElementById("modal-wsp");

      const abrirModal = () => {
        if (!modal || !modalImg || !modalNombre || !modalSabor || !modalWsp) {
          return;
        }

        modalImg.src = prod.imagen;
        modalNombre.textContent = prod.nombre;
        modalSabor.textContent = prod.sabor || "";
        modalWsp.href = `https://wa.me/5493487652952?text=${whatsappMensaje}`;
        modal.classList.remove("hidden");
      };

      const media = tarjeta.querySelector(".producto-media");
      const detallesBtn = tarjeta.querySelector('[data-action="detalles"]');

      if (media) {
        media.addEventListener("click", (event) => {
          event.stopPropagation();
          abrirModal();
        });

        media.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            abrirModal();
          }
        });
      }

      if (detallesBtn instanceof HTMLButtonElement) {
        detallesBtn.addEventListener("click", (event) => {
          event.preventDefault();
          abrirModal();
        });
      }

      contenedor.appendChild(tarjeta);
    });

    if (buscador) {
      buscador.addEventListener("input", () => {
        const filtro = buscador.value.toLowerCase();
        const tarjetas = document.querySelectorAll(".producto");

        tarjetas.forEach((card) => {
          const texto = card.innerText.toLowerCase();
          card.style.display = texto.includes(filtro) ? "block" : "none";
        });
      });
    }
  } catch (error) {
    console.error("Error al cargar productos:", error);
    contenedor.innerHTML = "<p>No se pudieron cargar los productos.</p>";
  }
}

cargarProductos();
