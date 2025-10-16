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
  getCountFromServer,
  deleteDoc, // getCountFromServer
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// LIST-VIEW: estado de vista (arriba, fuera de funciones)
let viewMode = 'grid'; // 'grid' | 'list'

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

    let cache = [];
    // EDIT-MODE: estado para edición
    let currentProductId = null;

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
        <button id="btn-grid" class="modal-action-secondary" type="button" aria-pressed="true">Cards</button>
        <button id="btn-lista" class="modal-action-secondary" type="button" aria-pressed="false">Lista</button>
      `;
      parent.insertBefore(toolbar, root);
    }

    // Inyectar contenedor de estadísticas si no existe
    let statsContainer = document.getElementById('admin-stats');
    if (!statsContainer) {
      statsContainer = document.createElement('div');
      statsContainer.id = 'admin-stats';
      statsContainer.className = 'admin-stats';
      statsContainer.innerHTML = `
        <div class="stat-card" id="stat-total">
          <div class="stat-label">Total de<br>Productos</div>
          <div class="stat-value" id="stat-total-products">0</div>
        </div>
        <div class="stat-card" id="stat-stock">
          <div class="stat-label">Total de<br>Stock</div>
          <div class="stat-value" id="stat-total-stock">0</div>
        </div>
        <div class="stat-card" id="stat-average">
          <div class="stat-label">Stock<br>Promedio</div>
          <div class="stat-value" id="stat-average-stock">0</div>
        </div>
      `;
      parent.insertBefore(statsContainer, root);
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
    const closeNewBtn = document.getElementById('closeNewProductModal');
    const cancelNewBtn = document.getElementById('cancelNewProduct');
    const formNew = document.getElementById('formNewProduct');

    // LIST-VIEW: refs a botones
    const btnLista = document.getElementById('btn-lista');
    const btnGrid = document.getElementById('btn-grid');

    if (btnAddTile) btnAddTile.addEventListener('click', openNewModal);
    // LIST-VIEW: si abren modal desde "Nuevo producto", volver a modo grid
    if (btnAddTile) btnAddTile.addEventListener('click', () => {
      viewMode = 'grid';
      if (btnLista) btnLista.setAttribute('aria-pressed', 'false');
    });

    if (adminSearch) adminSearch.addEventListener('input', (e) => renderGrid(e.target.value.trim().toLowerCase()));
    if (closeNewBtn) closeNewBtn.addEventListener('click', closeNewModal);
    if (cancelNewBtn) cancelNewBtn.addEventListener('click', closeNewModal);
    if (formNew) formNew.addEventListener('submit', handleNewProductSubmit);

    // LIST-VIEW: bind seguro (evitar doble binding)
    if (btnGrid && !btnGrid.dataset.bound) {
      btnGrid.dataset.bound = '1';
      btnGrid.addEventListener('click', () => {
        viewMode = 'grid';
        btnGrid.setAttribute('aria-pressed', 'true');
        btnLista?.setAttribute('aria-pressed', 'false');
        renderGrid(document.getElementById("adminSearch")?.value?.toLowerCase() || "");
      });
    }
    if (btnLista && !btnLista.dataset.bound) {
      btnLista.dataset.bound = '1';
      btnLista.addEventListener('click', () => {
        viewMode = 'list';
        btnLista.setAttribute('aria-pressed', 'true');
        btnGrid?.setAttribute('aria-pressed', 'false');
        // re-render usando el filtro actual
        renderGrid(document.getElementById("adminSearch")?.value?.toLowerCase() || "");
      });
    }

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
      // EDIT-MODE: marcar como botón de eliminar para que el listener de la tarjeta lo ignore
      delBtn.className = "producto-btn producto-btn-secondary btn-eliminar";
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

      // EDIT-MODE: abrir modal en modo edición al hacer click en la tarjeta (ignorando clicks en eliminar)
      article.addEventListener("click", (ev) => {
        if (ev.target.closest('.btn-eliminar')) return;
        openProductForEdit(item);
      });

      return article;
    }

    function renderGrid(filter = "") {
      // LIST-VIEW: si estamos en modo lista, delegar a renderList con los items filtrados
      const list = cache.filter(it => it.nombre && it.nombre.toLowerCase().includes(filter));
      if (viewMode === 'list') {
        return renderList(list);
      }

      // si no, continúa el render actual (grid/cards) como está
      root.innerHTML = "";
      root.appendChild(buildNewTile());
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

    // Helper para actualizar el contador de productos
    function updateStats(products) {
      const totalProductsEl = document.getElementById('stat-total-products');
      const totalStockEl = document.getElementById('stat-total-stock');
      const averageStockEl = document.getElementById('stat-average-stock');

      const totalProducts = products.length;
      const totalStock = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
      const averageStock = totalProducts > 0 ? (totalStock / totalProducts).toFixed(1) : 0;

      if (totalProductsEl) totalProductsEl.textContent = String(totalProducts);
      if (totalStockEl) totalStockEl.textContent = String(totalStock);
      if (averageStockEl) averageStockEl.textContent = String(averageStock);
    }

    // LIST-VIEW: nueva función de listado (usar el MISMO contenedor)
    function renderList(items) {
      const container = document.getElementById('admin-productos');
      if (!container) return;

      container.innerHTML = `
        <div class="admin-list">
          <table class="admin-table" role="table" aria-label="Listado de productos">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Sabor</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              ${(items || []).map(p => `
                <tr data-id="${p.id}" role="row">
                  <td class="col-nombre" data-label="Nombre" role="cell">${escapeHtml(p.nombre||'')}</td>
                  <td class="col-sabor"  data-label="Sabor" role="cell">${escapeHtml(p.sabor||'')}</td>
                  <td class="col-stock"  data-label="Stock" role="cell">${Number(p.stock??0)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;

      // LIST-VIEW: clic en fila para editar (reutiliza helper existente)
      container.querySelectorAll('tbody tr').forEach(tr => {
        tr.addEventListener('click', () => {
          const id = tr.getAttribute('data-id');
          const producto = (cache || []).find(x => x.id === id);
          if (!producto) return;
          if (typeof openProductForEdit === 'function') {
            openProductForEdit(producto);
          } else if (typeof openNewModal === 'function') {
            openNewModal(producto);
          }
        });
      });
    }

    async function handleDeleteProduct(id, element) {
      if (!confirm("¿Eliminar este producto?")) return;
      try {
        await deleteDoc(doc(db, "productos", id));
        console.log('[panel:delete] ok', id);
        cache = cache.filter(x => x.id !== id);
        if (element && element.parentNode) element.parentNode.removeChild(element);
        updateStats(cache); // Actualizar contadores
      } catch (e) {
        console.error('[panel:delete:err]', e?.code || e, e?.message || "");
        alert("Error al eliminar: " + (e.code || "error"));
      }
    }

    function openNewModal(producto) {
      const m = document.getElementById("modalNewProduct");
      if (!m) return;
      m.classList.remove("hidden");

      // EDIT-MODE: si viene producto, entrar en modo edición y precargar campos
      const titleEl = document.getElementById("modal-title");
      const formEl = document.getElementById("formNewProduct");

      if (producto && producto.id) {
        currentProductId = producto.id; // EDIT-MODE: marcar id actual para update
        if (titleEl) titleEl.textContent = "Editar producto";
        // precargar campos de forma segura
        const fImagen = document.getElementById("p_imagen");
        const fNombre = document.getElementById("p_nombre");
        const fSabor = document.getElementById("p_sabor");
        const fStock = document.getElementById("p_stock");
        if (fImagen) fImagen.value = producto.imagen || "";
        if (fNombre) fNombre.value = producto.nombre || "";
        if (fSabor) fSabor.value = producto.sabor || "";
        if (fStock) fStock.value = String(producto.stock ?? 0);
      } else {
        // nuevo producto (modo por defecto)
        currentProductId = null; // EDIT-MODE: asegurar null
        if (titleEl) titleEl.textContent = "Nuevo producto";
        if (formEl) formEl.reset();
      }

      const f = document.getElementById("p_imagen");
      if (f) f.focus();
    }

    // EDIT-MODE: helper para abrir modal en modo edición (reusa openNewModal)
    function openProductForEdit(producto) {
      // setear id actual para que el submit haga update en vez de add
      currentProductId = producto?.id ?? null;
      // Reusar modal existente para prefill (openNewModal ya soporta producto)
      if (typeof openNewModal === 'function') {
        openNewModal(producto);
      } else {
        // fallback: prefills manualmente si fuera necesario
        const fImagen = document.getElementById("p_imagen");
        const fNombre = document.getElementById("p_nombre");
        const fSabor = document.getElementById("p_sabor");
        const fStock = document.getElementById("p_stock");
        if (fImagen) fImagen.value = producto.imagen || "";
        if (fNombre) fNombre.value = producto.nombre || "";
        if (fSabor) fSabor.value = producto.sabor || "";
        if (fStock) fStock.value = String(producto.stock ?? 0);
        const titleEl = document.getElementById("modal-title");
        if (titleEl) titleEl.textContent = "Editar producto";
      }
    }

    function closeNewModal() {
      const m = document.getElementById("modalNewProduct");
      if (!m) return;
      m.classList.add("hidden");
      const frm = document.getElementById("formNewProduct");
      if (frm) frm.reset();

      // EDIT-MODE: limpiar estado de edición y título
      currentProductId = null;
      const titleEl = document.getElementById("modal-title");
      if (titleEl) titleEl.textContent = "Nuevo producto";
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
        // EDIT-MODE: si hay currentProductId -> updateDoc, sino addDoc (nuevo)
        if (currentProductId) {
          await updateDoc(doc(db, "productos", currentProductId), { imagen, nombre, sabor, stock: Number(stock) });
          console.log('[panel:update] ok', currentProductId);
          // actualizar cache localmente y re-render
          const idx = cache.findIndex(x => x.id === currentProductId);
          if (idx !== -1) {
            cache[idx] = { id: currentProductId, imagen, nombre, sabor, stock: Number(stock) };
          } else {
            // si no estaba en cache, agregar al inicio
            cache.unshift({ id: currentProductId, imagen, nombre, sabor, stock: Number(stock) });
          }
          renderGrid(document.getElementById("adminSearch")?.value?.toLowerCase() || "");
          updateStats(cache); // Actualizar contadores
          closeNewModal();
          currentProductId = null; // EDIT-MODE: limpiar estado
          return;
        }

        // comportamiento existente: crear nuevo
        const ref = await addDoc(collection(db, "productos"), { imagen, nombre, sabor, stock: Number(stock) });
        console.log('[panel:new] ok', ref.id);
        const newItem = { id: ref.id, imagen, nombre, sabor, stock: Number(stock) };
        cache.unshift(newItem);
        renderGrid(document.getElementById("adminSearch")?.value?.toLowerCase() || "");
        updateStats(cache); // Actualizar contadores
        closeNewModal();
      } catch (err) {
        console.error('[panel:new:err]', err?.code || err, err?.message || "");
        alert("Error creando/actualizando producto: " + (err.code || "error"));
      }
    }

    async function loadAllProducts() {
      console.log('[panel:list] fetching all products…');
      root.innerHTML = '<div style="padding:20px">Cargando…</div>';
      try {
        const q = query(collection(db, "productos"), orderBy("nombre"));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[panel:list] got all', docs.length, 'products');
        cache = docs;
        renderGrid(document.getElementById("adminSearch")?.value?.toLowerCase() || "");
        updateStats(cache); // Actualizar contadores con los datos cargados
      } catch (e) {
        console.error('[panel:list:err]', e?.code || e, e?.message || "");
        root.innerHTML = '<div style="padding:20px">Error al cargar productos</div>';
      }
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
    loadAllProducts();
  } catch (e) {
    console.error('[panel:init]', e);
    alert('Panel: ' + (e.code ?? e.message));
  }
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
