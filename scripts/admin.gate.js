import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setLogLevel } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log('[gate:init]', new Date().toISOString());

const firebaseConfig = {
  apiKey: "AIzaSyBkCmjY9pCUXLia-fsw9Od4AybFxRzCAjg",
  authDomain: "vapezrt-56f20.firebaseapp.com",
  projectId: "vapezrt-56f20",
  storageBucket: "vapezrt-56f20.appspot.com",
  messagingSenderId: "1000261974016",
  appId: "1:1000261974016:web:281161e24522eb2bee00e5",
  measurementId: "G-B84Z2N19NE"
};

// initialize guard (no double init)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
console.log('[gate:app] ready');

const auth = getAuth(app);
const db = getFirestore(app);

// enable verbose firestore logs if available
try {
  setLogLevel && setLogLevel('debug');
  console.log('[gate:firestore] setLogLevel debug');
} catch (e) {
  console.warn('[gate:firestore] setLogLevel not available or failed', e);
}

const provider = new GoogleAuthProvider();

const uiLoginButtonHTML = `
  <div style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:24px">
    <div style="width:min(520px,100%);text-align:center;background:rgba(15,23,42,0.6);padding:24px;border-radius:12px;border:1px solid rgba(255,255,255,0.06)">
      <p style="margin:0 0 12px">Inicia sesión con Google para acceder al panel de administración.</p>
      <button id="btnGoogleSign" class="admin-login-btn modal-action-primary">Iniciar con Google</button>
    </div>
  </div>
`;

function bindLoginButton() {
  const btn = document.getElementById("btnGoogleSign");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
      console.log('[gate:login] popup ok');
    } catch (e) {
      console.error('[gate:login:err]', e.code, e.message, e);
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        console.log('[gate:login] fallback redirect');
        try {
          await signInWithRedirect(auth, provider);
        } catch (r) {
          console.error('[gate:login:redirect:err]', r.code, r.message);
          alert('Auth: ' + (r.code || 'redirect-error'));
        }
        return;
      }
      if (e.code === 'auth/unauthorized-domain') {
        console.warn('[gate:login] unauthorized-domain; revisá Authorized domains (localhost, 127.0.0.1, dominio Vercel)');
        alert('Auth: unauthorized-domain. Agregá localhost, 127.0.0.1 y tu dominio en Firebase → Authentication → Authorized domains.');
        return;
      }
      alert('Auth: ' + (e.code || 'error'));
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  const root = document.getElementById("admin-root");
  console.log('[gate:auth]', user ? 'signed-in' : 'signed-out', user?.uid || null);
  if (!root) return;

  if (!user) {
    root.innerHTML = uiLoginButtonHTML;
    setTimeout(bindLoginButton, 20);
    return;
  }

  try {
    console.log('[gate:role:check]', 'admins/', user.uid);
    const adminRef = doc(db, "admins", user.uid);
    const snap = await getDoc(adminRef);
    console.log('[gate:role:exists]', snap.exists());
    if (snap.exists()) console.log('[gate:role:data]', snap.data());

    if (snap.exists() && snap.data().role === "admin") {
      // mount skeleton with admin-productos container
      root.innerHTML = `
        <section class="productos-grid-section">
          <div class="section-container">
            <main id="admin-productos" class="productos"></main>
          </div>
        </section>
      `;
      console.log('[gate] panel skeleton mounted');

      try {
        console.log('[gate:panel] importing…');
        const mod = await import("./admin.products.js");
        console.log('[gate:panel] imported module', !!mod);
        try {
          if (typeof mod.initAdminProducts === "function") {
            console.log("[gate:panel] init");
            await mod.initAdminProducts();
            console.log("[gate:panel] init done");
          } else if (typeof mod.default === "function") {
            console.log("[gate:panel] default()");
            await mod.default();
            console.log("[gate:panel] default done");
          } else {
            throw new Error('admin.products.js no exporta inicializador');
          }
        } catch (initErr) {
          console.error('[gate:panel:init:err]', initErr);
          alert('Panel import/init: ' + (initErr.code ?? initErr.message));
        }
      } catch (impErr) {
        console.error('[gate:panel:import:err]', impErr?.message || impErr, impErr);
        alert('Panel import error: ' + (impErr?.message || 'error'));
        const content = document.getElementById("admin-productos");
        if (content) content.textContent = "Error al cargar el módulo de administración.";
      }
    } else {
      console.warn('[gate] not admin:', user.uid);
      alert("No autorizado");
      location.href = "index.html";
    }
  } catch (e) {
    console.error('[gate:role:err]', e?.code, e?.message, e);
    alert("Gate: " + (e.code || "error"));
  }
});

