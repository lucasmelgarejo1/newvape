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

      const tarjeta = document.createElement("div");
      tarjeta.classList.add("producto");

      tarjeta.innerHTML = `
        <img src="${prod.imagen}" alt="${prod.nombre}">
        <h3>${prod.nombre}</h3>
        <p>${prod.sabor}</p>
      `;

      tarjeta.addEventListener("click", () => {
        const modal = document.getElementById("modal");
        const modalImg = document.getElementById("modal-img");
        const modalNombre = document.getElementById("modal-nombre");
        const modalSabor = document.getElementById("modal-sabor");
        const modalWsp = document.getElementById("modal-wsp");

        if (!modal || !modalImg || !modalNombre || !modalSabor || !modalWsp) {
          return;
        }

        modalImg.src = prod.imagen;
        modalNombre.textContent = prod.nombre;
        modalSabor.textContent = prod.sabor;
        modalWsp.href = `https://wa.me/5493487652952?text=Hola!%20Estoy%20interesado%20en%20${encodeURIComponent(prod.nombre)}%20(${encodeURIComponent(prod.sabor)})`;
        modal.classList.remove("hidden");
      });

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
