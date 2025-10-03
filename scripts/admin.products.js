import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  addDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function initAdminProducts() {
  console.log('[panel:init]', new Date().toISOString());

  try {
    const firebaseConfig = {
      apiKey: "AIzaSyBkCmjY9pCUXLia-fsw9Od4AybFxRzCAjg",
      authDomain: "vapezrt-56f20.firebaseapp.com",
      projectId: "vapezrt-56f20",
      storageBucket: "vapezrt-56f20.appspot.com",
      messagingSenderId: "1000261974016",
      appId: "1:1000261974016:web:281161e24522eb2bee00e5",
      measurementId: "G-B84Z2N19NE"
    };

    // reuse app if exists
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const PAGE_SIZE = 20;
    let lastVisible = null;
    let cache = [];

    const root = document.getElementById("admin-productos");
    if (!root) {
      console.error("[panel] missing #admin-productos");
      return;
    }

    // insert toolbar above root if not present
    const parent = root.parentElement;
    if (!parent) {
      console.error("[panel] parent of #admin-productos not found");
      return;
    }

    // create toolbar (idempotent)
    let toolbar = document.querySelector('.admin-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'admin-toolbar';
      toolbar.style.display = 'flex';
      toolbar.style.gap = '12px';
      toolbar.style.alignItems = 'center';
      toolbar.style.marginBottom = '16px';
      toolbar.innerHTML = `
        <button id="btnAddTile" class="modal-action-primary" aria-label="Nuevo producto">Nuevo producto</button>
        <input id="adminSearch" type="search" placeholder="Buscar por nombre..." aria-label="Buscar productos por nombre" class="hero-busqueda" style="max-width:320px;">
      `;
      parent.insertBefore(toolbar, root);
    }

    // create load more wrapper (idempotent)
    let loadMoreWrap = document.getElementById('btnLoadMore')?.parentElement;
    if (!loadMoreWrap) {
      loadMoreWrap = document.createElement('div');
      loadMoreWrap.style.marginTop = '20px';
      loadMoreWrap.style.textAlign = 'center';
      loadMoreWrap.innerHTML = `<button id="btnLoadMore" class="load-more">Cargar más</button>`;
      parent.appendChild(loadMoreWrap);
    }

    // modal appended to body (idempotent)
    let modal = document.getElementById('modalNewProduct');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalNewProduct';
      modal.className = 'modal hidden';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="modal-content">
          <button id="closeNewProductModal" class="modal-close" type="button" aria-label="Cerrar modal">&times;</button>
          <form id="formNewProduct" novalidate>
            <h3 id="modal-title">Nuevo producto</h3>
            <div class="form-group">
              <label for="p_imagen">URL de Imagen</label>
              <input id="p_imagen" name="imagen" type="url" required>
            </div>
            <div class="form-group">
              <label for="p_nombre">Nombre</label>
              <input id="p_nombre" name="nombre" type="text" minlength="3" required>
            </div>
            <div class="form-group">
              <label for="p_sabor">Sabor</label>
              <input id="p_sabor" name="sabor" type="text" minlength="3" required>
            </div>
            <div class="form-group">
              <label for="p_stock">Stock</label>
              <input id="p_stock" name="stock" type="number" min="0" value="0" required>
            </div>
            <div class="modal-actions">
              <button type="submit" class="modal-action-primary">Guardar</button>
              <button type="button" id="cancelNewProduct" class="modal-action-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Cache nodes safely
    const btnAddTile = document.getElementById('btnAddTile');
    const adminSearch = document.getElementById('adminSearch');
    const btnLoadMore = document.getElementById('btnLoadMore');
    const closeNewBtn = document.getElementById('closeNewProductModal');
    const cancelNewBtn = document.getElementById('cancelNewProduct');
    const formNew = document.getElementById('formNewProduct');

    if (btnAddTile) btnAddTile.addEventListener('click', openNewModal);
    if (adminSearch) adminSearch.addEventListener('input', (e) => renderGrid(e.target.value.trim().toLowerCase()));
    if (btnLoadMore) btnLoadMore.addEventListener('click', () => loadPage());
    if (closeNewBtn) closeNewBtn.addEventListener('click', closeNewModal);
    if (cancelNewBtn) cancelNewBtn.addEventListener('click', closeNewModal);
    if (formNew) formNew.addEventListener('submit', handleNewProductSubmit);

    // helper builders
    function buildNewTile() {
      const tile = document.createElement("article");
      tile.className = "producto producto--new";
      tile.tabIndex = 0;
      tile.setAttribute("role", "button");
      tile.setAttribute("aria-label", "Nuevo producto");
      tile.style.display = "flex";
      tile.style.alignItems = "center";
      tile.style.justifyContent = "center";
      tile.style.minHeight = "220px";
      tile.innerHTML = `
        <div style="text-align:center">
          <div style="font-size:48px;line-height:1">+</div>
          <div style="margin-top:8px;font-weight:700">Nuevo producto</div>
        </div>
      `;
      tile.addEventListener("click", openNewModal);
      tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openNewModal();
        }
      });
      return tile;
    }

    function buildProductCard(item) {
      const article = document.createElement("article");
      article.className = "producto";
      article.tabIndex = 0;
      article.dataset.id = item.id;
      article.innerHTML = `
        <div class="producto-media" role="button" tabindex="0">
          <img src="${escapeHtml(item.imagen || '')}" alt="${escapeHtml(item.nombre || '')}">
        </div>
        <div class="producto-info">
          <h3>${escapeHtml(item.nombre || '')}</h3>
          <p class="producto-sabor">${escapeHtml(item.sabor || '')}</p>
          <p class="producto-precio">Stock: ${String(item.stock ?? 0)}</p>
        </div>
      `;
      const delBtn = document.createElement("button");
      delBtn.className = "producto-btn producto-btn-secondary";
      delBtn.style.position = "absolute";
      delBtn.style.top = "12px";
      delBtn.style.right = "12px";
      delBtn.style.padding = "6px 10px";
      delBtn.setAttribute("aria-label", "Eliminar producto");
      delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleDeleteProduct(item.id, article);
      });
      article.style.position = "relative";
      article.appendChild(delBtn);
      return article;
    }

    function renderGrid(filter = "") {
      root.innerHTML = "";
      root.appendChild(buildNewTile());
      const list = cache.filter(it => it.nombre && it.nombre.toLowerCase().includes(filter));
      if (list.length === 0) {
        const msg = document.createElement("div");
        msg.style.padding = "20px";
        msg.style.gridColumn = "1 / -1";
        msg.textContent = "No hay productos. Usa 'Nuevo producto' para agregar uno.";
        root.appendChild(msg);
        return;
      }
      list.forEach(item => root.appendChild(buildProductCard(item)));
    }

    async function handleDeleteProduct(id, element) {
      if (!confirm("¿Eliminar este producto?")) return;
      try {
        await deleteDoc(doc(db, "productos", id));
        console.log('[panel:delete] ok', id);
        cache = cache.filter(x => x.id !== id);
        if (element && element.parentNode) element.parentNode.removeChild(element);
      } catch (e) {
        console.error('[panel:delete:err]', e?.code || e, e?.message || "");
        alert("Error al eliminar: " + (e.code || "error"));
      }
    }

    function openNewModal() {
      const m = document.getElementById("modalNewProduct");
      if (!m) return;
      m.classList.remove("hidden");
      const f = document.getElementById("p_imagen");
      if (f) f.focus();
    }

    function closeNewModal() {
      const m = document.getElementById("modalNewProduct");
      if (!m) return;
      m.classList.add("hidden");
      const frm = document.getElementById("formNewProduct");
      if (frm) frm.reset();
    }

    async function handleNewProductSubmit(e) {
      e.preventDefault();
      const form = e.target;
      const imagen = form.imagen.value?.trim() || "";
      const nombre = form.nombre.value?.trim() || "";
      const sabor = form.sabor.value?.trim() || "";
      const stock = Number(form.stock.value);
      if (!imagen) return alert("Imagen requerida");
      if (nombre.length < 3) return alert("Nombre mínimo 3 caracteres");
      if (sabor.length < 3) return alert("Sabor mínimo 3 caracteres");
      if (!Number.isFinite(stock) || stock < 0) return alert("Stock inválido");
      try {
        const ref = await addDoc(collection(db, "productos"), { imagen, nombre, sabor, stock: Number(stock) });
        console.log('[panel:new] ok', ref.id);
        const newItem = { id: ref.id, imagen, nombre, sabor, stock: Number(stock) };
        cache.unshift(newItem);
        renderGrid(document.getElementById("adminSearch")?.value?.toLowerCase() || "");
        closeNewModal();
      } catch (err) {
        console.error('[panel:new:err]', err?.code || err, err?.message || "");
        alert("Error creando producto: " + (err.code || "error"));
      }
    }

    async function loadPage() {
      console.log('[panel:list] fetching…');
      try {
        let q;
        if (lastVisible) {
          q = query(collection(db, "productos"), orderBy("nombre"), startAfter(lastVisible), limit(PAGE_SIZE));
        } else {
          q = query(collection(db, "productos"), orderBy("nombre"), limit(PAGE_SIZE));
        }
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[panel:list] got', docs.length);
        if (snap.empty) {
          if (!lastVisible) {
            cache = [];
            renderGrid(document.getElementById("adminSearch")?.value?.toLowerCase() || "");
          }
          const btn = document.getElementById("btnLoadMore");
          if (btn) btn.disabled = true;
          return;
        }
        lastVisible = snap.docs[snap.docs.length - 1];
        cache = cache.concat(docs);
        renderGrid(document.getElementById("adminSearch")?.value?.toLowerCase() || "");
        const btn = document.getElementById("btnLoadMore");
        if (docs.length < PAGE_SIZE) {
          if (btn) btn.disabled = true;
        } else {
          if (btn) btn.disabled = false;
        }
      } catch (e) {
        console.error('[panel:list:err]', e?.code || e, e?.message || "");
        root.innerHTML = '<div style="padding:20px">Error al cargar productos</div>';
      }
    }

    function resetAndLoad() {
      lastVisible = null;
      cache = [];
      root.innerHTML = '<div style="padding:20px">Cargando…</div>';
      loadPage();
    }

    function escapeHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // initial load
    resetAndLoad();
  } catch (e) {
    console.error('[panel:init]', e);
    alert('Panel: ' + (e.code ?? e.message));
  }
}
function resetAndLoad() {
  lastVisible = null;
  cache = [];
  const container = document.getElementById("admin-productos");
  if (container) container.innerHTML = '<div style="padding:20px">Cargando…</div>';
  loadPage();
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Auto-mount when this script is imported after gate sets admin-panel-content
const panelContent = document.getElementById("admin-panel-content");
if (panelContent) {
  mountGridPanel();
}
