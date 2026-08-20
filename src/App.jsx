import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, PackagePlus, ShoppingCart, Boxes, Receipt,
  Plus, Trash2, X, Search, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, Minus, ChevronRight, Wallet, PiggyBank, Save,
  Users, Truck, Landmark, Download, Upload, Phone, LogOut, ShieldCheck, Lock, Printer,
  FileText, ClipboardList, UserCog, Barcode, BarChart3, Receipt as Receipt2, RotateCcw, Settings, Pencil, Layers,
  Image as ImageIcon, Camera, Sun, Moon, MessageCircle, TrendingDown, AlertCircle
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
import JsBarcode from "jsbarcode";
import { Html5Qrcode } from "html5-qrcode";

// ---- Design tokens : identité Electrolik (noir / or, typographie tech) ----
const LIGHT_THEME = {
  ink: "#14161B",
  inkSoft: "#6B7280",
  paper: "#F4F5F7",
  paperCard: "#FFFFFF",
  sidebar: "#0C0D10",
  sidebarAlt: "#1C1D22",
  sidebarText: "#9CA3AF",
  accent: "#F2B705",
  accentSoft: "#FDF1CC",
  success: "#1FA97A",
  successSoft: "#DCF5EB",
  danger: "#E5484D",
  dangerSoft: "#FBE3E4",
  border: "#E4E6EB",
};
const DARK_THEME = {
  ink: "#EDEEF2",
  inkSoft: "#9BA1AE",
  paper: "#0E0F12",
  paperCard: "#1A1C21",
  sidebar: "#000000",
  sidebarAlt: "#1C1D22",
  sidebarText: "#9CA3AF",
  accent: "#F2B705",
  accentSoft: "#3A2F0C",
  success: "#34D399",
  successSoft: "#123527",
  danger: "#F87171",
  dangerSoft: "#3A1518",
  border: "#2B2E36",
};
// C est mutable : ses propriétés sont réassignées par applyTheme() pour basculer clair/sombre
// sans devoir toucher chaque référence C.xxx dans le reste du fichier.
let C = { ...LIGHT_THEME };
function applyTheme(mode) {
  Object.assign(C, mode === "dark" ? DARK_THEME : LIGHT_THEME);
}

const displayFont = { fontFamily: "'Space Grotesk', ui-sans-serif, sans-serif", fontWeight: 700 };
const bodyFont = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" };
const monoFont = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

function useGoogleFonts() {
  useEffect(() => {
    if (document.getElementById("electrolik-fonts")) return;
    const link = document.createElement("link");
    link.id = "electrolik-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);

    if (document.getElementById("electrolik-global-style")) return;
    const style = document.createElement("style");
    style.id = "electrolik-global-style";
    style.textContent = `
      * { box-sizing: border-box; }
      body { -webkit-font-smoothing: antialiased; }
      ::selection { background: ${C.accent}; color: #14161B; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #D8DBE2; border-radius: 8px; }
      ::-webkit-scrollbar-thumb:hover { background: #B9BEC9; }

      .rounded-xl.border {
        box-shadow: 0 1px 2px rgba(12,13,16,0.04), 0 10px 24px -14px rgba(12,13,16,0.14);
        transition: box-shadow .18s ease, transform .18s ease;
      }
      .rounded-xl.border:hover {
        box-shadow: 0 2px 6px rgba(12,13,16,0.06), 0 16px 32px -14px rgba(12,13,16,0.18);
      }
      button { transition: background .15s ease, color .15s ease, opacity .15s ease, transform .1s ease, box-shadow .15s ease; }
      button:active { transform: scale(0.97); }
      input, select, textarea { transition: border-color .15s ease, box-shadow .15s ease; }
      input:focus, select:focus, textarea:focus {
        outline: none;
        border-color: ${C.accent} !important;
        box-shadow: 0 0 0 3px ${C.accentSoft};
      }
      .nav-btn { position: relative; transition: background .15s ease, color .15s ease; }
      .nav-btn:hover { background: rgba(255,255,255,0.06) !important; color: #fff !important; }
      .ek-badge { transition: transform .15s ease; }
      .ek-badge:hover { transform: rotate(0deg) scale(1.03); }
    `;
    document.head.appendChild(style);
  }, []);
}

function uidBarcode() {
  // EAN-13-like 13 digit code, generated locally (not a registered GS1 prefix)
  let code = "200"; // internal-use prefix
  for (let i = 0; i < 9; i++) code += Math.floor(Math.random() * 10);
  // simple check digit (mod 10)
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return code + check;
}

const uid = () => Math.random().toString(36).slice(2, 10);

// ---- Variant-aware stock helpers ----
function productQty(p) {
  return p.variants && p.variants.length > 0
    ? p.variants.reduce((s, v) => s + (v.qty || 0), 0)
    : p.qty || 0;
}
function variantLabel(v) {
  return [v.color, v.size, v.length].filter(Boolean).join(" / ");
}
function findByCode(products, code) {
  for (const p of products) {
    if (p.barcode === code || p.sku === code) return { product: p, variant: null };
    if (p.variants) {
      const v = p.variants.find((x) => x.barcode === code || x.sku === code);
      if (v) return { product: p, variant: v };
    }
  }
  return null;
}
function adjustStock(products, productId, variantId, delta) {
  return products.map((p) => {
    if (p.id !== productId) return p;
    if (variantId && p.variants) {
      const variants = p.variants.map((v) =>
        v.id === variantId ? { ...v, qty: Math.max(0, (v.qty || 0) + delta) } : v
      );
      return { ...p, variants, qty: variants.reduce((s, v) => s + (v.qty || 0), 0) };
    }
    return { ...p, qty: Math.max(0, (p.qty || 0) + delta) };
  });
}

const fmt = (n) =>
  (Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

const STORAGE_KEY = "negoce-data-v1";

// ---- Supabase (Auth + Audit log) ----
const SUPABASE_URL = "https://pycghxwqkdpgjkbjmesb.supabase.co";
const SUPABASE_KEY = "sb_publishable_kJzdc12bH0H3MmCn2H0guw_pPO_1Wgp";

async function sbLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Identifiants incorrects");
  return data; // { access_token, user, ... }
}

async function sbFetchProfile(userId, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const rows = await res.json();
  return rows && rows[0];
}

async function sbFetchAllProfiles(session) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&order=created_at.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` },
  });
  if (!res.ok) return [];
  return res.json();
}

async function sbUpdateRole(session, profileId, role) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ role }),
  });
  return res.ok;
}

async function sbLogAction(session, action, tableName, recordId, details) {
  if (!session) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: session.userId,
        user_name: session.userName,
        action,
        table_name: tableName,
        record_id: String(recordId || ""),
        details: details || {},
      }),
    });
  } catch (e) {
    console.error("Audit log error", e);
  }
}

async function sbFetchAuditLog(session) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/audit_log?select=*&order=created_at.desc&limit=200`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` },
  });
  if (!res.ok) return [];
  return res.json();
}

// ---- Product image upload (Supabase Storage) ----
async function sbUploadProductImage(session, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${session.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": file.type || "image/jpeg",
    },
    body: file,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).message || (await res.text()); } catch (e) {}
    throw new Error(detail || `Échec de l'envoi (HTTP ${res.status})`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

// ---- Cloud backups (one row per day, upserted) ----
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function sbSaveBackup(session, db) {
  if (!session) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/backups?on_conflict=backup_date`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        backup_date: todayISO(),
        data: db,
        updated_by: session.userName,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("Backup error", e);
  }
}

async function sbListBackups(session) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/backups?select=backup_date,updated_by,updated_at&order=backup_date.desc&limit=30`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` } }
  );
  if (!res.ok) return [];
  return res.json();
}

async function sbRestoreBackup(session, date) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/backups?backup_date=eq.${date}&select=data`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` },
  });
  const rows = await res.json();
  return rows && rows[0] && rows[0].data;
}

async function sbLoadLatestBackup(session) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/backups?select=data,backup_date&order=backup_date.desc&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows && rows[0] ? rows[0].data : null;
  } catch (e) {
    console.error("Load latest backup error", e);
    return null;
  }
}

const DEFAULT_DB = {
  products: [
    { id: uid(), name: "Crème hydratante 50ml", sku: "COS-001", barcode: uidBarcode(), category: "Soin visage", price: 89, costPrice: 55, qty: 24, minQty: 5 },
    { id: uid(), name: "Gel désinfectant 250ml", sku: "PARA-014", barcode: uidBarcode(), category: "Para-médical", price: 32, costPrice: 20, qty: 6, minQty: 10 },
    { id: uid(), name: "Sérum vitamine C", sku: "COS-007", barcode: uidBarcode(), category: "Soin visage", price: 145, costPrice: 90, qty: 15, minQty: 5 },
  ],
  purchases: [],
  sales: [],
  invoices: [],
  nextInvoice: 1001,
  capital: 0,
  clients: [],
  suppliers: [],
  supplierPayments: [],
  openingDebts: [],
  cheques: [],
  quotes: [],
  nextQuote: 1,
  deliveryNotes: [],
  nextBL: 1,
  company: { name: "Electrolik", ice: "", rc: "", patente: "", address: "", phone: "", tvaRate: 20 },
  charges: [],
  returns: [],
};

export default function App() {
  useGoogleFonts();
  const [db, setDb] = useState(DEFAULT_DB);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ek-theme") : null;
    return saved || "light";
  });
  applyTheme(theme); // mute C avant le rendu pour que tous les composants lisent les bonnes couleurs

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("ek-theme", next); } catch (e) {}
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setDb(JSON.parse(raw));
      } catch (e) {
        // no saved data yet — keep defaults
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (next) => {
    setDb(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Storage error", e);
    }
    if (session) sbSaveBackup(session, next); // sauvegarde cloud automatique, en arrière-plan
  };

  // Synchronisation automatique : vérifie toutes les 20s si un autre appareil a mis à jour les données
  useEffect(() => {
    if (!session) return;
    const t = setInterval(async () => {
      const cloudDb = await sbLoadLatestBackup(session);
      if (cloudDb && JSON.stringify(cloudDb) !== JSON.stringify(db)) {
        setDb(cloudDb);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudDb));
        } catch (e) {
          console.error("Storage error", e);
        }
      }
    }, 20000);
    return () => clearInterval(t);
  }, [session, db]);

  const notify = (msg, undo) => {
    setToast({ msg, undo });
    setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), undo ? 6000 : 2200);
  };

  const log = (action, tableName, recordId, details) => sbLogAction(session, action, tableName, recordId, details);

  const handleLogin = async (email, password) => {
    const auth = await sbLogin(email, password);
    const profile = await sbFetchProfile(auth.user.id, auth.access_token);
    const s = {
      accessToken: auth.access_token,
      userId: auth.user.id,
      userName: (profile && profile.full_name) || auth.user.email,
      role: (profile && profile.role) || "vendeur",
    };
    setSession(s);
    // Synchronise avec la dernière sauvegarde cloud (récupère les données créées sur un autre appareil)
    const cloudDb = await sbLoadLatestBackup(s);
    if (cloudDb) {
      setDb(cloudDb);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudDb));
      } catch (e) {
        console.error("Storage error", e);
      }
    }
    sbSaveBackup(s, cloudDb || db); // assure une sauvegarde du jour dès la connexion
  };

  const nav = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "rapports", label: "Rapports", icon: BarChart3 },
    { id: "devis", label: "Devis", icon: FileText },
    { id: "achats", label: "Achats", icon: PackagePlus },
    { id: "ventes", label: "Ventes / PDV", icon: ShoppingCart },
    { id: "livraison", label: "Colis & Livraison", icon: ClipboardList },
    { id: "stock", label: "Stock", icon: Boxes },
    { id: "clients", label: "Clients", icon: Users },
    { id: "fournisseurs", label: "Fournisseurs", icon: Truck },
    { id: "cheques", label: "Chèques", icon: Landmark },
    { id: "facturation", label: "Facturation", icon: Receipt },
    ...(session && session.role === "admin"
      ? [
          { id: "finance", label: "Comptabilité", icon: PiggyBank },
          { id: "charges", label: "Charges", icon: Receipt2 },
          { id: "equipe", label: "Équipe", icon: UserCog },
          { id: "audit", label: "Journal d'audit", icon: ShieldCheck },
        ]
      : []),
  ];

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div style={{ background: C.paper, minHeight: "100vh", ...bodyFont }} className="flex items-center justify-center">
        <div style={{ ...monoFont, color: C.inkSoft }} className="text-sm tracking-widest uppercase">
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh", ...bodyFont }} className="flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside style={{ background: `linear-gradient(180deg, ${C.sidebar} 0%, #08090B 100%)` }} className="md:w-64 w-full flex md:flex-col shrink-0">
        <div className="p-6 hidden md:block">
          <img src="/logo.png" alt="Electrolik" style={{ width: 150, height: "auto" }} />
          <div style={{ ...monoFont, color: C.sidebarText }} className="text-[10px] tracking-[0.2em] uppercase mt-2">
            Gestion Pro — Registre de commerce
          </div>
        </div>
        <nav className="flex md:flex-col flex-1 md:px-3 md:pb-6 overflow-x-auto">
          {nav.map((n, i) => {
            const active = tab === n.id;
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className="nav-btn flex items-center gap-3 px-4 md:px-3 py-3 md:py-2.5 md:rounded-xl whitespace-nowrap"
                style={{
                  background: active ? C.sidebarAlt : "transparent",
                  color: active ? "#fff" : C.sidebarText,
                  borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent",
                }}
              >
                <span style={{ ...monoFont, fontSize: 10, opacity: 0.6 }}>0{i + 1}</span>
                <Icon size={16} />
                <span className="text-sm">{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 md:border-t hidden md:block" style={{ borderColor: C.sidebarAlt }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ color: "#fff" }} className="text-sm">{session.userName}</div>
              <div style={{ ...monoFont, color: C.sidebarText, fontSize: 10 }} className="uppercase tracking-widest">
                {session.role === "admin" ? "Admin" : "Vendeur"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} title={theme === "dark" ? "Mode clair" : "Mode sombre"}>
                {theme === "dark" ? <Sun size={16} color={C.sidebarText} /> : <Moon size={16} color={C.sidebarText} />}
              </button>
              <button onClick={() => setSession(null)} title="Déconnexion">
                <LogOut size={16} color={C.sidebarText} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-5 md:p-10 max-w-6xl">
        {tab === "dashboard" && <Dashboard db={db} />}
        {tab === "rapports" && <Rapports db={db} />}
        {tab === "devis" && <Devis db={db} persist={persist} notify={notify} log={log} session={session} />}
        {tab === "achats" && <Achats db={db} persist={persist} notify={notify} log={log} />}
        {tab === "ventes" && <Ventes db={db} persist={persist} notify={notify} session={session} />}
        {tab === "livraison" && <Livraison db={db} persist={persist} notify={notify} log={log} />}
        {tab === "stock" && <Stock db={db} persist={persist} notify={notify} log={log} session={session} />}
        {tab === "clients" && <Clients db={db} persist={persist} notify={notify} log={log} />}
        {tab === "fournisseurs" && <Fournisseurs db={db} persist={persist} notify={notify} log={log} />}
        {tab === "cheques" && <Cheques db={db} persist={persist} notify={notify} log={log} />}
        {tab === "facturation" && <Facturation db={db} persist={persist} notify={notify} log={log} />}
        {tab === "finance" && session.role === "admin" && <Finance db={db} persist={persist} notify={notify} log={log} session={session} />}
        {tab === "charges" && session.role === "admin" && <Charges db={db} persist={persist} notify={notify} log={log} />}
        {tab === "equipe" && session.role === "admin" && <Equipe session={session} notify={notify} log={log} />}
        {tab === "audit" && session.role === "admin" && <AuditLog session={session} />}
      </main>

      {toast && (
        <div
          className="fixed bottom-6 right-6 px-4 py-3 rounded-md shadow-lg text-sm flex items-center gap-4"
          style={{ background: C.ink, color: "#fff" }}
        >
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo();
                setToast(null);
              }}
              className="px-3 py-1 rounded-md text-xs font-medium"
              style={{ background: C.accent, color: "#fff" }}
            >
              Annuler
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Login ----------
// ---------- Camera barcode scanner (mobile/webcam) ----------
function CameraScanner({ onDetected, onClose }) {
  const regionId = "camera-scan-region";
  const scannerRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;
    let stopped = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decodedText) => {
          if (stopped) return;
          stopped = true;
          scanner.stop().catch(() => {}).finally(() => onDetected(decodedText));
        },
        () => {} // ignore per-frame "not found" noise
      )
      .catch(() => setError("Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur."));

    return () => {
      stopped = true;
      scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,24,43,0.85)" }}>
      <div className="w-full max-w-sm rounded-xl p-4" style={{ background: C.paperCard }}>
        <div className="flex items-center justify-between mb-3">
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest">Scanner un code-barres</div>
          <button onClick={onClose}><X size={16} color={C.inkSoft} /></button>
        </div>
        {error ? (
          <p className="text-sm" style={{ color: C.danger }}>{error}</p>
        ) : (
          <div id={regionId} style={{ width: "100%", borderRadius: 8, overflow: "hidden" }} />
        )}
        <p className="text-xs mt-3 text-center" style={{ color: C.inkSoft }}>Pointez la caméra vers le code-barres du produit.</p>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!email || !password) return setError("Email et mot de passe requis");
    setBusy(true);
    try {
      await onLogin(email, password);
    } catch (e) {
      setError(e.message || "Échec de connexion");
    }
    setBusy(false);
  };

  return (
    <div style={{ background: C.sidebar, minHeight: "100vh", ...bodyFont }} className="flex items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-xl p-8" style={{ background: C.paperCard }}>
        <img src="/logo.png" alt="Electrolik" style={{ display: "block", width: 190, height: "auto", margin: "0 auto 6px" }} />
        <div style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }} className="uppercase tracking-[0.2em] mb-6 text-center">
          Gestion Pro — Connexion sécurisée
        </div>
        <div className="space-y-3">
          <Field label="Email">
            <input className={inputClass} style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
          <Field label="Mot de passe">
            <input type="password" className={inputClass} style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
        </div>
        {error && <p className="text-xs mt-3" style={{ color: C.danger }}>{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full mt-5 py-2.5 rounded-md text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: C.accent }}
        >
          <Lock size={14} /> {busy ? "Connexion…" : "Se connecter"}
        </button>
        <p className="text-xs mt-4 text-center" style={{ color: C.inkSoft }}>
          Les comptes sont créés par un administrateur dans Supabase.
        </p>
      </div>
    </div>
  );
}

// ---------- Audit log ----------
function AuditLog({ session }) {
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await sbFetchAuditLog(session);
      setRows(Array.isArray(data) ? data : []);
      setLoadingRows(false);
    })();
  }, []);

  return (
    <div>
      <SectionTitle eyebrow="Sécurité" title="Journal d'audit" />
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Date</td><td className="px-4 py-3">Utilisateur</td>
              <td className="px-4 py-3">Action</td><td className="px-4 py-3">Table</td><td className="px-4 py-3">Détails</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={monoFont}>{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3">{r.user_name}</td>
                <td className="px-4 py-3" style={{ color: C.accent }}>{r.action}</td>
                <td className="px-4 py-3" style={{ color: C.inkSoft }}>{r.table_name}</td>
                <td className="px-4 py-3 text-xs" style={{ ...monoFont, color: C.inkSoft }}>
                  {r.details ? JSON.stringify(r.details) : "—"}
                </td>
              </tr>
            ))}
            {!loadingRows && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucune activité enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Shared bits ----------
function StatCard({ label, value, icon: Icon, tone = "default" }) {
  const bg = tone === "danger" ? C.dangerSoft : tone === "success" ? C.successSoft : C.paperCard;
  const iconColor = tone === "danger" ? C.danger : tone === "success" ? C.success : C.accent;
  return (
    <div className="rounded-xl p-5 border" style={{ background: bg, borderColor: C.border }}>
      <div className="flex items-center justify-between mb-3">
        <span style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }} className="uppercase tracking-widest">
          {label}
        </span>
        <Icon size={16} color={iconColor} />
      </div>
      <div style={{ ...displayFont, color: C.ink }} className="text-3xl">
        {value}
      </div>
    </div>
  );
}

function Stamp({ status, labels }) {
  const paid = status === "paid";
  const returned = status === "returned";
  const color = returned ? C.inkSoft : paid ? C.success : C.danger;
  const text = returned ? "RETOURNÉ" : labels ? (paid ? labels[0] : labels[1]) : paid ? "PAYÉ" : "EN ATTENTE";
  return (
    <span
      className="ek-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full border-2"
      style={{ ...monoFont, fontSize: 10, letterSpacing: "0.12em", color, borderColor: color, transform: "rotate(-2deg)" }}
    >
      {returned ? <RotateCcw size={11} /> : paid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
      {text}
    </span>
  );
}

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
      <div>
        <div style={{ ...monoFont, color: C.accent, fontSize: 11 }} className="uppercase tracking-[0.2em] mb-1">
          {eyebrow}
        </div>
        <h1 style={{ ...displayFont, color: C.ink, letterSpacing: "-0.01em" }} className="text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span style={{ ...monoFont, color: C.inkSoft, fontSize: 10 }} className="uppercase tracking-widest block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
const inputStyle = { borderColor: C.border, color: C.ink };
const inputClass = "w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2";

// ---------- Dashboard ----------
function Dashboard({ db }) {
  const activeSales = db.sales.filter((s) => !s.returned);
  const stockValue = db.products.reduce((s, p) => s + (p.costPrice || 0) * productQty(p), 0);
  const rupture = db.products.filter((p) => productQty(p) <= 0);
  const lowStock = db.products.filter((p) => productQty(p) > 0 && productQty(p) <= p.minQty);
  const revenue = activeSales.reduce((s, sale) => s + sale.total, 0);
  const pendingInvoices = db.invoices.filter((i) => i.status === "pending");
  const grossMargin = activeSales.reduce((s, sale) => {
    const saleMargin = (sale.items || []).reduce((sm, item) => {
      const prod = db.products.find((p) => p.id === item.productId);
      const cost = prod ? prod.costPrice || 0 : 0;
      return sm + (item.price - cost) * item.qty;
    }, 0);
    return s + saleMargin;
  }, 0);

  const trend = useMemo(() => {
    const map = {};
    activeSales.forEach((s) => {
      map[s.date] = (map[s.date] || 0) + s.total;
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, total]) => ({ date: date.slice(5), total }));
  }, [db.sales]);

  const topProducts = useMemo(() => {
    const map = {};
    activeSales.forEach((s) =>
      s.items.forEach((i) => {
        map[i.name] = (map[i.name] || 0) + i.qty * i.price;
      })
    );
    return Object.entries(map)
      .map(([name, total]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [db.sales]);

  const byChannel = useMemo(() => {
    const map = {};
    activeSales.forEach((s) => {
      const ch = s.channel || "Boutique";
      map[ch] = (map[ch] || 0) + s.total;
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [db.sales]);

  const byVendor = useMemo(() => {
    const map = {};
    activeSales.forEach((s) => {
      const v = s.soldBy || "—";
      map[v] = (map[v] || 0) + s.total;
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [db.sales]);

  // Rappels de paiement : clients "chaque semaine" / "10 jours" qui ont un solde dû à collecter
  const clientsToRemind = useMemo(
    () =>
      (db.clients || [])
        .filter((c) => (c.balanceDue || 0) > 0 && (c.paymentMode === "hebdo" || c.paymentMode === "10j"))
        .sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0)),
    [db.clients]
  );

  // Produits stagnants : en stock depuis ≥30 jours sans aucune vente
  const stagnantProducts = useMemo(() => {
    const todayStr = today();
    const lastSale = {};
    activeSales.forEach((s) =>
      (s.items || []).forEach((i) => {
        if (!lastSale[i.productId] || s.date > lastSale[i.productId]) lastSale[i.productId] = s.date;
      })
    );
    const daysSince = (d) => (d ? Math.floor((new Date(todayStr) - new Date(d)) / 86400000) : Infinity);
    return db.products
      .filter((p) => productQty(p) > 0)
      .map((p) => ({ ...p, daysSince: daysSince(lastSale[p.id]) }))
      .filter((p) => p.daysSince >= 30)
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 8);
  }, [db.products, db.sales]);

  return (
    <div>
      <SectionTitle eyebrow="Vue d'ensemble" title="Tableau de bord" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Chiffre d'affaires" value={fmt(revenue) + " DHS"} icon={TrendingUp} />
        <StatCard label="Marge brute" value={fmt(grossMargin) + " DHS"} icon={PiggyBank} tone={grossMargin >= 0 ? "success" : "danger"} />
        <StatCard label="Valeur du stock (coût)" value={fmt(stockValue) + " DHS"} icon={Boxes} />
        <StatCard label="Ruptures de stock" value={rupture.length} icon={AlertTriangle} tone={rupture.length ? "danger" : "success"} />
        <StatCard label="Stock bas" value={lowStock.length} icon={AlertTriangle} tone={lowStock.length ? "danger" : "success"} />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Évolution des ventes</div>
          {trend.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Pas encore de ventes à afficher.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trend}>
                <CartesianGrid stroke={C.border} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.inkSoft }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.inkSoft }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: C.border }} formatter={(v) => fmt(v) + " DHS"} />
                <Line type="monotone" dataKey="total" stroke={C.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Top produits</div>
          {topProducts.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Pas encore de ventes à afficher.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: C.inkSoft }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.inkSoft }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: C.border }} formatter={(v) => fmt(v) + " DHS"} />
                <Bar dataKey="total" fill={C.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border p-5 mb-8" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Ventes par canal</div>
        {byChannel.length === 0 ? (
          <p className="text-sm" style={{ color: C.inkSoft }}>Pas encore de ventes à afficher.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
            {byChannel.map((c) => {
              const pct = revenue ? Math.round((c.total / revenue) * 100) : 0;
              return (
                <div key={c.name} className="rounded-md border p-3" style={{ borderColor: C.border }}>
                  <div style={{ color: C.inkSoft }} className="text-xs mb-1">{c.name}</div>
                  <div style={{ ...displayFont, color: C.ink }} className="text-lg">{fmt(c.total)} DHS</div>
                  <div style={{ ...monoFont, color: C.accent, fontSize: 11 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border p-5 mb-8" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Ventes par vendeur</div>
        {byVendor.length === 0 ? (
          <p className="text-sm" style={{ color: C.inkSoft }}>Pas encore de ventes à afficher.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
            {byVendor.map((v) => {
              const pct = revenue ? Math.round((v.total / revenue) * 100) : 0;
              return (
                <div key={v.name} className="rounded-md border p-3" style={{ borderColor: C.border }}>
                  <div style={{ color: C.inkSoft }} className="text-xs mb-1">{v.name}</div>
                  <div style={{ ...displayFont, color: C.ink }} className="text-lg">{fmt(v.total)} DHS</div>
                  <div style={{ ...monoFont, color: C.accent, fontSize: 11 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-1 flex items-center gap-2">
            <AlertCircle size={13} /> Rappels de paiement
          </div>
          <p className="text-xs mb-4" style={{ color: C.inkSoft }}>Clients "chaque semaine" / "10 jours" avec un solde à collecter.</p>
          {clientsToRemind.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Aucun rappel pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {clientsToRemind.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span style={{ color: C.ink }}>{c.name}</span>
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded" style={{ ...monoFont, background: C.accentSoft, color: "#8A6D00" }}>
                      {PAYMENT_MODE_LABELS[c.paymentMode]}
                    </span>
                  </div>
                  <span style={{ ...monoFont, color: C.danger }}>{fmt(c.balanceDue)} DHS</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-1 flex items-center gap-2">
            <TrendingDown size={13} /> Produits qui ne bougent pas
          </div>
          <p className="text-xs mb-4" style={{ color: C.inkSoft }}>En stock depuis 30 jours ou plus sans vente — à mettre en avant ou baisser de prix.</p>
          {stagnantProducts.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Rien de stagnant, tout se vend bien 👍</p>
          ) : (
            <ul className="space-y-2">
              {stagnantProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: C.ink }}>{p.name}</span>
                  <span style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }}>
                    {p.daysSince === Infinity ? "Jamais vendu" : `${p.daysSince} j sans vente`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Alertes stock</div>
          {rupture.length === 0 && lowStock.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Aucune alerte, tout est bien approvisionné.</p>
          ) : (
            <ul className="space-y-2">
              {rupture.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span style={{ color: C.ink }}>{p.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: C.dangerSoft, color: C.danger, ...monoFont }}>RUPTURE</span>
                </li>
              ))}
              {lowStock.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span style={{ color: C.ink }}>{p.name}</span>
                  <span style={{ ...monoFont, color: "#B4813A" }}>{p.qty} restant</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Dernières ventes</div>
          {db.sales.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Aucune vente enregistrée pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {[...db.sales].reverse().slice(0, 5).map((s) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span style={{ color: s.returned ? C.inkSoft : C.ink, textDecoration: s.returned ? "line-through" : "none" }}>
                    {s.client || "Client comptoir"}{s.returned ? " (retourné)" : ""}
                  </span>
                  <span style={{ ...monoFont, color: s.returned ? C.inkSoft : C.ink }}>{fmt(s.total)} DHS</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Rapports (hebdomadaire / mensuel) ----------
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day + 3); // jeudi de cette semaine
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-S${String(week).padStart(2, "0")}`;
}
function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function Rapports({ db }) {
  const [view, setView] = useState("week");

  const grouped = useMemo(() => {
    const map = {};
    db.sales.filter((s) => !s.returned).forEach((s) => {
      const key = view === "week" ? isoWeekKey(s.date) : monthKey(s.date);
      if (!map[key]) map[key] = { period: key, total: 0, count: 0, margin: 0 };
      map[key].total += s.total;
      map[key].count += 1;
      map[key].margin += (s.items || []).reduce((sm, item) => {
        const prod = db.products.find((p) => p.id === item.productId);
        const cost = prod ? prod.costPrice || 0 : 0;
        return sm + (item.price - cost) * item.qty;
      }, 0);
    });
    return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
  }, [db.sales, db.products, view]);

  const recent = grouped.slice(-(view === "week" ? 10 : 12));
  const current = recent[recent.length - 1];
  const previous = recent[recent.length - 2];
  const change = current && previous && previous.total > 0
    ? Math.round(((current.total - previous.total) / previous.total) * 100)
    : null;

  const exportExcel = () => {
    const rows = grouped.map((g) => ({
      Période: g.period,
      "Chiffre d'affaires": g.total,
      "Nombre de ventes": g.count,
      "Panier moyen": g.count ? Math.round(g.total / g.count) : 0,
      Marge: Math.round(g.margin),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, view === "week" ? "Hebdomadaire" : "Mensuel");
    XLSX.writeFile(wb, `rapport-${view === "week" ? "hebdo" : "mensuel"}-${today()}.xlsx`);
  };

  return (
    <div>
      <SectionTitle
        eyebrow="Analyse"
        title="Rapports des ventes"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden" style={{ borderColor: C.border }}>
              <button
                onClick={() => setView("week")}
                className="px-3 py-1.5 text-xs"
                style={{ background: view === "week" ? C.accent : C.paperCard, color: view === "week" ? C.paperCard : C.ink }}
              >
                Hebdomadaire
              </button>
              <button
                onClick={() => setView("month")}
                className="px-3 py-1.5 text-xs"
                style={{ background: view === "month" ? C.accent : C.paperCard, color: view === "month" ? C.paperCard : C.ink }}
              >
                Mensuel
              </button>
            </div>
            <button onClick={exportExcel} className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border" style={{ borderColor: C.border, color: C.inkSoft }}>
              <Download size={13} /> Excel
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label={view === "week" ? "Cette semaine" : "Ce mois"} value={current ? fmt(current.total) + " DHS" : "—"} icon={TrendingUp} />
        <StatCard
          label="Évolution"
          value={change === null ? "—" : (change >= 0 ? "+" : "") + change + "%"}
          icon={TrendingUp}
          tone={change === null ? "default" : change >= 0 ? "success" : "danger"}
        />
        <StatCard label="Ventes" value={current ? current.count : 0} icon={ShoppingCart} />
        <StatCard label="Panier moyen" value={current && current.count ? fmt(Math.round(current.total / current.count)) + " DHS" : "—"} icon={Receipt} />
      </div>

      <div className="rounded-xl border p-5 mb-8" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">
          {view === "week" ? "Chiffre d'affaires par semaine" : "Chiffre d'affaires par mois"}
        </div>
        {recent.length === 0 ? (
          <p className="text-sm" style={{ color: C.inkSoft }}>Pas encore de ventes à afficher.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={recent}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: C.inkSoft }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.inkSoft }} axisLine={false} tickLine={false} width={45} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: C.border }} formatter={(v) => fmt(v) + " DHS"} />
              <Bar dataKey="total" fill={C.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Période</td>
              <td className="px-4 py-3">Chiffre d'affaires</td>
              <td className="px-4 py-3">Ventes</td>
              <td className="px-4 py-3">Panier moyen</td>
              <td className="px-4 py-3">Marge</td>
            </tr>
          </thead>
          <tbody>
            {[...recent].reverse().map((g) => (
              <tr key={g.period} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={displayFont}>{g.period}</td>
                <td className="px-4 py-3" style={monoFont}>{fmt(g.total)} DHS</td>
                <td className="px-4 py-3" style={monoFont}>{g.count}</td>
                <td className="px-4 py-3" style={monoFont}>{g.count ? fmt(Math.round(g.total / g.count)) : 0} DHS</td>
                <td className="px-4 py-3" style={{ ...monoFont, color: g.margin >= 0 ? C.success : C.danger }}>{fmt(g.margin)} DHS</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucune donnée pour l'instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Stock ----------
function Stock({ db, persist, notify, log, session }) {
  const [form, setForm] = useState({ name: "", sku: "", barcode: "", category: "", price: "", costPrice: "", qty: "", minQty: "5", image: "" });
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // all | low | out
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [variantForm, setVariantForm] = useState({ color: "", size: "", length: "", qty: "" });
  const [uploading, setUploading] = useState(false);
  const importInputRef = useRef(null);

  const importProductsExcel = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        let products = [...db.products];
        let added = 0, updated = 0, skipped = 0;
        rows.forEach((r) => {
          const name = String(r["Produit"] || r["Nom"] || r["Name"] || r["nom"] || "").trim();
          if (!name) { skipped++; return; }
          const sku = String(r["SKU"] || r["Sku"] || r["Référence"] || r["Reference"] || "").trim();
          const barcode = String(r["Code-barres"] || r["Barcode"] || "").trim();
          const category = String(r["Catégorie"] || r["Categorie"] || r["Category"] || "").trim();
          const price = Number(r["Prix de vente"] || r["Prix"] || r["Price"] || 0);
          const costPrice = Number(r["Coût d'achat"] || r["Cout d'achat"] || r["Cout"] || r["CostPrice"] || 0);
          const qty = Number(r["Quantité"] || r["Quantite"] || r["Qty"] || r["Stock"] || 0);
          const minQty = Number(r["Seuil min."] || r["Seuil min"] || r["MinQty"] || 5);

          const existing = (sku && products.find((p) => p.sku === sku)) || products.find((p) => p.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            products = products.map((p) =>
              p.id === existing.id
                ? {
                    ...p,
                    name,
                    category: category || p.category,
                    price: price || p.price,
                    costPrice: costPrice || p.costPrice,
                    qty: r["Quantité"] || r["Quantite"] || r["Qty"] || r["Stock"] ? qty : p.qty,
                    minQty: minQty || p.minQty,
                    barcode: barcode || p.barcode,
                  }
                : p
            );
            updated++;
          } else {
            products.push({
              id: uid(),
              name,
              sku: sku || "SKU-" + uid().toUpperCase().slice(0, 5),
              barcode: barcode || uidBarcode(),
              category: category || "Général",
              price,
              costPrice,
              qty,
              minQty: minQty || 5,
              image: "",
              variants: [],
            });
            added++;
          }
        });
        persist({ ...db, products });
        if (log) log("import_products", "products", "-", { added, updated, skipped });
        notify(`Import terminé : ${added} ajouté(s), ${updated} mis à jour${skipped ? `, ${skipped} ligne(s) ignorée(s)` : ""}`);
      } catch (e) {
        notify("Fichier Excel invalide ou illisible");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await sbUploadProductImage(session, file);
      setForm((f) => ({ ...f, image: url }));
      notify("Image envoyée");
    } catch (e) {
      notify(e.message || "Échec de l'envoi de l'image");
    }
    setUploading(false);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      category: p.category,
      price: String(p.price),
      costPrice: String(p.costPrice || 0),
      qty: String(p.qty),
      minQty: String(p.minQty),
      image: p.image || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", sku: "", barcode: "", category: "", price: "", costPrice: "", qty: "", minQty: "5", image: "" });
  };

  const addProduct = () => {
    if (!form.name || !form.price) return notify("Nom et prix requis");

    if (editingId) {
      const before = db.products.find((p) => p.id === editingId);
      const updated = {
        ...before,
        name: form.name,
        sku: form.sku || before.sku,
        barcode: form.barcode || before.barcode,
        category: form.category || "Général",
        price: Number(form.price),
        costPrice: Number(form.costPrice) || 0,
        qty: before.variants && before.variants.length > 0 ? before.qty : Number(form.qty) || 0,
        minQty: Number(form.minQty) || 0,
        image: form.image || "",
      };
      persist({ ...db, products: db.products.map((p) => (p.id === editingId ? updated : p)) });
      if (log) log("update_product", "products", editingId, { name: updated.name });
      cancelEdit();
      notify("Produit modifié");
      return;
    }

    const p = {
      id: uid(),
      name: form.name,
      sku: form.sku || "SKU-" + uid().toUpperCase().slice(0, 5),
      barcode: form.barcode || uidBarcode(),
      category: form.category || "Général",
      price: Number(form.price),
      costPrice: Number(form.costPrice) || 0,
      qty: Number(form.qty) || 0,
      minQty: Number(form.minQty) || 0,
      image: form.image || "",
      variants: [],
    };
    persist({ ...db, products: [...db.products, p] });
    setForm({ name: "", sku: "", barcode: "", category: "", price: "", costPrice: "", qty: "", minQty: "5", image: "" });
    notify("Produit ajouté");
  };

  const addVariant = (product) => {
    if (!variantForm.color && !variantForm.size && !variantForm.length) {
      return notify("Renseignez au moins une couleur, taille ou longueur");
    }
    const v = {
      id: uid(),
      color: variantForm.color,
      size: variantForm.size,
      length: variantForm.length,
      sku: product.sku + "-" + uid().toUpperCase().slice(0, 4),
      barcode: uidBarcode(),
      qty: Number(variantForm.qty) || 0,
    };
    const variants = [...(product.variants || []), v];
    const products = db.products.map((p) =>
      p.id === product.id ? { ...p, variants, qty: variants.reduce((s, x) => s + (x.qty || 0), 0) } : p
    );
    persist({ ...db, products });
    if (log) log("add_variant", "products", product.id, { product: product.name, variant: variantLabel(v) });
    setVariantForm({ color: "", size: "", length: "", qty: "" });
    notify("Variante ajoutée");
  };

  const removeVariant = (product, variantId) => {
    const variants = (product.variants || []).filter((v) => v.id !== variantId);
    const products = db.products.map((p) =>
      p.id === product.id ? { ...p, variants, qty: variants.reduce((s, x) => s + (x.qty || 0), 0) } : p
    );
    persist({ ...db, products });
    if (log) log("delete_variant", "products", product.id, { product: product.name });
  };

  const updateVariantQty = (product, variantId, delta) => {
    const variants = (product.variants || []).map((v) =>
      v.id === variantId ? { ...v, qty: Math.max(0, (v.qty || 0) + delta) } : v
    );
    const products = db.products.map((p) =>
      p.id === product.id ? { ...p, variants, qty: variants.reduce((s, x) => s + (x.qty || 0), 0) } : p
    );
    persist({ ...db, products });
  };

  const printLabel = (p, variant) => {
    const label = variant ? `${p.name} — ${variantLabel(variant)}` : p.name;
    const barcode = variant ? variant.barcode : p.barcode;
    const w = window.open("", "_blank", "width=420,height=320");
    w.document.write(`
      <html><head><title>Étiquette ${variant ? variant.sku : p.sku}</title>
      <style>
        body { font-family: Inter, sans-serif; text-align: center; padding: 16px; }
        h3 { margin: 4px 0; }
        .price { font-size: 20px; font-weight: bold; margin-top: 4px; }
      </style></head>
      <body>
        <h3>${label}</h3>
        <svg id="bc"></svg>
        <div class="price">${fmt(p.price)} DHS</div>
      </body></html>
    `);
    w.document.close();
    w.onload = () => {
      JsBarcode(w.document.getElementById("bc"), barcode, { format: "EAN13", width: 2, height: 60, fontSize: 14 });
      setTimeout(() => w.print(), 200);
    };
  };

  const removeProduct = (id) => {
    const p = db.products.find((x) => x.id === id);
    const prevDb = db;
    persist({ ...db, products: db.products.filter((p) => p.id !== id) });
    if (log && p) log("delete_product", "products", id, { name: p.name });
    if (p) notify(`Produit "${p.name}" supprimé`, () => persist(prevDb));
  };

  const updateQty = (id, delta) =>
    persist({
      ...db,
      products: db.products.map((p) => (p.id === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p)),
    });

  const filtered = db.products
    .filter((p) => (p.name + p.sku + p.category + (p.barcode || "")).toLowerCase().includes(q.toLowerCase()))
    .filter((p) => {
      if (stockFilter === "out") return productQty(p) <= 0;
      if (stockFilter === "low") return productQty(p) > 0 && productQty(p) <= p.minQty;
      return true;
    });
  const rupture = db.products.filter((p) => productQty(p) <= 0);
  const lowStock = db.products.filter((p) => productQty(p) > 0 && productQty(p) <= p.minQty);

  return (
    <div>
      <SectionTitle
        eyebrow="Catalogue"
        title="Stock & produits"
        action={
          <div className="text-right">
            <div style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest">Produits référencés</div>
            <div style={{ ...displayFont, color: C.ink }} className="text-xl">{db.products.length}</div>
          </div>
        }
      />

      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: editingId ? C.accent : C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">
          {editingId ? "Modifier le produit" : "Nouveau produit"}
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-20 h-20 rounded-md border flex items-center justify-center overflow-hidden shrink-0"
            style={{ borderColor: C.border, background: C.paper }}
          >
            {form.image ? (
              <img src={form.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={22} color={C.inkSoft} />
            )}
          </div>
          <div>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border cursor-pointer" style={{ borderColor: C.border, color: C.ink }}>
              <Upload size={14} /> {uploading ? "Envoi…" : "Choisir une photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleImageUpload(e.target.files[0])}
              />
            </label>
            {form.image && (
              <button onClick={() => setForm({ ...form, image: "" })} className="ml-2 text-xs" style={{ color: C.danger }}>
                Retirer
              </button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-8 gap-3">
          <Field label="Nom">
            <input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="SKU">
            <input className={inputClass} style={inputStyle} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="auto" />
          </Field>
          <Field label="Code-barres">
            <input className={inputClass} style={inputStyle} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="auto (13 chiffres)" />
          </Field>
          <Field label="Catégorie">
            <input className={inputClass} style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Coût d'achat (DHS)">
            <input type="number" className={inputClass} style={inputStyle} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
          </Field>
          <Field label="Prix de vente (DHS)">
            <input type="number" className={inputClass} style={inputStyle} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Quantité">
            <input
              type="number"
              className={inputClass}
              style={inputStyle}
              value={form.qty}
              disabled={editingId ? (db.products.find((p) => p.id === editingId)?.variants || []).length > 0 : false}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
            />
          </Field>
          <Field label="Seuil min.">
            <input type="number" className={inputClass} style={inputStyle} value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} />
          </Field>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={addProduct} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
            {editingId ? <Save size={14} /> : <Plus size={14} />} {editingId ? "Enregistrer les modifications" : "Ajouter au catalogue"}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border" style={{ borderColor: C.border, color: C.inkSoft }}>
              Annuler
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <div className="flex items-center gap-2 border rounded-md px-3 py-2 max-w-sm flex-1" style={{ borderColor: C.border, background: C.paperCard }}>
            <Search size={14} color={C.inkSoft} />
            <input placeholder="Rechercher un produit…" className="w-full outline-none text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-1 border rounded-md p-1" style={{ borderColor: C.border, background: C.paperCard }}>
            {[
              { id: "all", label: "Tous" },
              { id: "low", label: `Stock bas (${lowStock.length})` },
              { id: "out", label: `Rupture (${rupture.length})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStockFilter(f.id)}
                className="text-xs px-3 py-1.5 rounded"
                style={{
                  background: stockFilter === f.id ? C.accent : "transparent",
                  color: stockFilter === f.id ? "#fff" : f.id === "out" ? C.danger : f.id === "low" ? "#B08900" : C.inkSoft,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={importInputRef}
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              importProductsExcel(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => importInputRef.current && importInputRef.current.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border"
            style={{ borderColor: C.border, color: C.ink, background: C.paperCard }}
          >
            <Upload size={14} /> Importer (Excel)
          </button>
          <button
            onClick={() => {
              const rows = [];
              db.products.forEach((p) => {
                if (p.variants && p.variants.length > 0) {
                  p.variants.forEach((v) => {
                    rows.push({
                      Produit: p.name, Variante: variantLabel(v), SKU: v.sku, "Code-barres": v.barcode,
                      Catégorie: p.category, "Coût d'achat": p.costPrice || 0, "Prix de vente": p.price,
                      Quantité: v.qty, "Seuil min.": p.minQty,
                      Statut: v.qty <= 0 ? "Rupture" : v.qty <= p.minQty ? "Stock bas" : "OK",
                    });
                  });
                } else {
                  rows.push({
                    Produit: p.name, Variante: "", SKU: p.sku, "Code-barres": p.barcode || "",
                    Catégorie: p.category, "Coût d'achat": p.costPrice || 0, "Prix de vente": p.price,
                    Quantité: p.qty, "Seuil min.": p.minQty,
                    Statut: p.qty <= 0 ? "Rupture" : p.qty <= p.minQty ? "Stock bas" : "OK",
                  });
                }
              });
              const ws = XLSX.utils.json_to_sheet(rows);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Stock");
              XLSX.writeFile(wb, `stock-complet-${today()}.xlsx`);
              notify("Export Excel téléchargé");
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border"
            style={{ borderColor: C.border, color: C.ink, background: C.paperCard }}
          >
            <Download size={14} /> Exporter (Excel)
          </button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b" >
              <td className="px-4 py-3" style={{ borderColor: C.border }}></td>
              <td className="px-4 py-3">Produit</td>
              <td className="px-4 py-3">SKU / Code-barres</td>
              <td className="px-4 py-3">Catégorie</td>
              <td className="px-4 py-3">Coût</td>
              <td className="px-4 py-3">Prix</td>
              <td className="px-4 py-3">Marge</td>
              <td className="px-4 py-3">Stock</td>
              <td className="px-4 py-3"></td>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const hasVariants = p.variants && p.variants.length > 0;
              const qty = productQty(p);
              const margin = p.price - (p.costPrice || 0);
              const marginPct = p.price ? Math.round((margin / p.price) * 100) : 0;
              const rupture = qty <= 0;
              const low = !rupture && qty <= p.minQty;
              const expanded = expandedId === p.id;
              return (
                <React.Fragment key={p.id}>
                  <tr className="border-b" style={{ borderColor: C.border }}>
                    <td className="px-4 py-3">
                      <div className="w-9 h-9 rounded border flex items-center justify-center overflow-hidden" style={{ borderColor: C.border, background: C.paper }}>
                        {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={14} color={C.inkSoft} />}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: C.ink }}>
                      {p.name}
                      {hasVariants && (
                        <button
                          onClick={() => setExpandedId(expanded ? null : p.id)}
                          className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: C.accentSoft, color: C.accent }}
                        >
                          {p.variants.length} variante{p.variants.length > 1 ? "s" : ""} {expanded ? "▲" : "▼"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div style={monoFont}>{p.sku}</div>
                      <div style={{ ...monoFont, color: C.inkSoft, fontSize: 10 }}>{p.barcode}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: C.inkSoft }}>{p.category}</td>
                    <td className="px-4 py-3" style={{ ...monoFont, color: C.inkSoft }}>{fmt(p.costPrice || 0)} DHS</td>
                    <td className="px-4 py-3" style={monoFont}>{fmt(p.price)} DHS</td>
                    <td className="px-4 py-3" style={{ ...monoFont, color: margin >= 0 ? C.success : C.danger }}>{fmt(margin)} DHS · {marginPct}%</td>
                    <td className="px-4 py-3">
                      {hasVariants ? (
                        <div className="flex items-center gap-2">
                          <span style={{ ...monoFont, color: rupture ? C.danger : low ? "#B4813A" : C.ink }}>{qty} (total)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(p.id, -1)} className="w-6 h-6 rounded border flex items-center justify-center" style={{ borderColor: C.border }}><Minus size={12} /></button>
                          <span style={{ ...monoFont, color: rupture ? C.danger : low ? "#B4813A" : C.ink }}>{qty}</span>
                          <button onClick={() => updateQty(p.id, 1)} className="w-6 h-6 rounded border flex items-center justify-center" style={{ borderColor: C.border }}><Plus size={12} /></button>
                        </div>
                      )}
                      {rupture && <span className="text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: C.dangerSoft, color: C.danger }}>RUPTURE</span>}
                      {low && <span className="text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: "#F5E7D3", color: "#B4813A" }}>BAS</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setExpandedId(expanded ? null : p.id)} title="Variantes"><Layers size={14} color={C.accent} /></button>
                        <button onClick={() => startEdit(p)} title="Modifier"><Pencil size={14} color={C.accent} /></button>
                        <button onClick={() => printLabel(p)} title="Imprimer l'étiquette"><Printer size={14} color={C.inkSoft} /></button>
                        <button onClick={() => removeProduct(p.id)}><Trash2 size={14} color={C.danger} /></button>
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={9} className="px-4 py-4" style={{ background: C.paper }}>
                        <div style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest mb-3">
                          Variantes de "{p.name}" (couleur / taille / longueur)
                        </div>
                        {hasVariants && (
                          <table className="w-full text-sm mb-4">
                            <tbody>
                              {p.variants.map((v) => {
                                const vRupture = (v.qty || 0) <= 0;
                                return (
                                  <tr key={v.id} className="border-b" style={{ borderColor: C.border }}>
                                    <td className="py-2" style={{ color: C.ink }}>{variantLabel(v) || "—"}</td>
                                    <td className="py-2" style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }}>{v.sku}</td>
                                    <td className="py-2">
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => updateVariantQty(p, v.id, -1)} className="w-6 h-6 rounded border flex items-center justify-center bg-white" style={{ borderColor: C.border }}><Minus size={12} /></button>
                                        <span style={{ ...monoFont, color: vRupture ? C.danger : C.ink }}>{v.qty}</span>
                                        <button onClick={() => updateVariantQty(p, v.id, 1)} className="w-6 h-6 rounded border flex items-center justify-center bg-white" style={{ borderColor: C.border }}><Plus size={12} /></button>
                                      </div>
                                    </td>
                                    <td className="py-2 text-right">
                                      <div className="flex items-center gap-2 justify-end">
                                        <button onClick={() => printLabel(p, v)} title="Imprimer l'étiquette"><Printer size={13} color={C.inkSoft} /></button>
                                        <button onClick={() => removeVariant(p, v.id)}><Trash2 size={13} color={C.danger} /></button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                        <div className="grid md:grid-cols-5 gap-3 items-end">
                          <Field label="Couleur">
                            <input className={inputClass} style={{ ...inputStyle, background: C.paperCard }} value={variantForm.color} onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })} placeholder="Ex. Noir" />
                          </Field>
                          <Field label="Taille">
                            <input className={inputClass} style={{ ...inputStyle, background: C.paperCard }} value={variantForm.size} onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })} placeholder="Ex. M" />
                          </Field>
                          <Field label="Longueur">
                            <input className={inputClass} style={{ ...inputStyle, background: C.paperCard }} value={variantForm.length} onChange={(e) => setVariantForm({ ...variantForm, length: e.target.value })} placeholder="Ex. 1m" />
                          </Field>
                          <Field label="Quantité">
                            <input type="number" className={inputClass} style={{ ...inputStyle, background: C.paperCard }} value={variantForm.qty} onChange={(e) => setVariantForm({ ...variantForm, qty: e.target.value })} />
                          </Field>
                          <button onClick={() => addVariant(p)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white h-fit" style={{ background: C.accent }}>
                            <Plus size={14} /> Ajouter
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun produit trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Achats ----------
// ---------- Import PDF de facture fournisseur (lecture heuristique) ----------
async function extractPdfRows(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const rows = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }))
      .filter((it) => it.text.trim() !== "");
    const groups = {};
    items.forEach((it) => {
      const key = Math.round(it.y / 3) * 3;
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    });
    const ys = Object.keys(groups).map(Number).sort((a, b) => b - a);
    ys.forEach((y) => {
      const rowItems = groups[y].sort((a, b) => a.x - b.x);
      const rowText = rowItems.map((it) => it.text).join(" ").replace(/\s+/g, " ").trim();
      if (rowText) rows.push(rowText);
    });
  }
  return rows;
}

function parsePdfInvoiceLines(rows) {
  const candidates = [];
  rows.forEach((line) => {
    if (/total|sous.?total|tva|remise|net.?à.?payer|montant\s*ht|montant\s*ttc|^page\s/i.test(line)) return;
    const numMatches = line.match(/\d+[.,]?\d*/g) || [];
    const numbers = numMatches.map((n) => parseFloat(n.replace(",", "."))).filter((n) => !isNaN(n));
    if (numbers.length < 2) return;
    let designation = line.replace(/\d+[.,]?\d*/g, " ").replace(/\s{2,}/g, " ").trim();
    if (designation.length < 3) return;

    let qty, unitPrice, total;
    if (numbers.length >= 3) {
      total = numbers[numbers.length - 1];
      unitPrice = numbers[numbers.length - 2];
      qty = numbers.find((n) => Number.isInteger(n) && n > 0 && n < 10000) || 1;
      if (unitPrice > 0 && Math.abs(qty * unitPrice - total) > total * 0.05) {
        qty = Math.max(1, Math.round(total / unitPrice));
      }
    } else {
      qty = 1;
      unitPrice = numbers[numbers.length - 1];
    }
    if (!unitPrice || unitPrice <= 0) return;
    candidates.push({ designation, qty: qty || 1, unitPrice: Number(unitPrice.toFixed(2)) });
  });
  return candidates;
}

function Achats({ db, persist, notify, log }) {
  const [form, setForm] = useState({ productId: "", variantId: "", newName: "", supplierId: "", supplierName: "", qty: "1", unitCost: "", payment: "cash" });
  const useExisting = form.productId !== "";
  const selectedProduct = useExisting ? db.products.find((p) => p.id === form.productId) : null;
  const needsVariant = selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0;
  const importInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const [pdfReview, setPdfReview] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePdfFile = async (file) => {
    if (!file) return;
    setPdfLoading(true);
    try {
      const rows = await extractPdfRows(file);
      const candidates = parsePdfInvoiceLines(rows);
      if (candidates.length === 0) {
        notify("Aucune ligne détectée dans ce PDF — vérifiez le fichier ou utilisez l'import Excel");
        setPdfLoading(false);
        return;
      }
      setPdfReview({ supplierId: "", supplierName: "", payment: "cash", lines: candidates.map((c) => ({ ...c, include: true })) });
    } catch (e) {
      notify("Impossible de lire ce PDF");
    }
    setPdfLoading(false);
  };

  const updatePdfLine = (idx, field, value) => {
    setPdfReview((r) => ({ ...r, lines: r.lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)) }));
  };
  const removePdfLine = (idx) => setPdfReview((r) => ({ ...r, lines: r.lines.filter((_, i) => i !== idx) }));

  const confirmPdfImport = () => {
    const supplierLabel = pdfReview.supplierId ? db.suppliers.find((s) => s.id === pdfReview.supplierId)?.name : pdfReview.supplierName.trim();
    if (!supplierLabel) return notify("Nom du fournisseur requis");
    const activeLines = pdfReview.lines.filter((l) => l.include && l.designation && Number(l.qty) > 0 && Number(l.unitPrice) > 0);
    if (activeLines.length === 0) return notify("Aucune ligne valide à importer");

    let products = [...db.products];
    let suppliers = [...db.suppliers];
    let supplier = pdfReview.supplierId
      ? suppliers.find((s) => s.id === pdfReview.supplierId)
      : suppliers.find((s) => s.name.toLowerCase() === supplierLabel.toLowerCase());
    if (!supplier) {
      supplier = { id: uid(), name: supplierLabel, phone: "", balanceDue: 0 };
      suppliers.push(supplier);
    }
    let newPurchases = [];
    let created = 0, matched = 0;
    activeLines.forEach((l) => {
      const qty = Number(l.qty);
      const unitCost = Number(l.unitPrice);
      let product = products.find((p) => p.name.toLowerCase() === l.designation.toLowerCase());
      if (product) {
        products = adjustStock(products, product.id, null, qty);
        products = products.map((p) => (p.id === product.id ? { ...p, costPrice: unitCost } : p));
        matched++;
      } else {
        product = { id: uid(), name: l.designation, sku: "SKU-" + uid().toUpperCase().slice(0, 5), barcode: uidBarcode(), category: "Général", price: Math.round(unitCost * 1.4), costPrice: unitCost, qty, minQty: 5, variants: [] };
        products.push(product);
        created++;
      }
      const total = qty * unitCost;
      if (pdfReview.payment === "credit") {
        suppliers = suppliers.map((s) => (s.id === supplier.id ? { ...s, balanceDue: (s.balanceDue || 0) + total } : s));
      }
      newPurchases.push({ id: uid(), date: today(), productName: product.name, supplier: supplier.name, supplierId: supplier.id, qty, unitCost, total, payment: pdfReview.payment });
    });
    persist({ ...db, products, suppliers, purchases: [...db.purchases, ...newPurchases] });
    if (log) log("import_achats_pdf", "purchases", "-", { lignes: newPurchases.length, created, matched });
    notify(`Import PDF terminé : ${newPurchases.length} article(s), ${created} nouveau(x) produit(s), stock mis à jour`);
    setPdfReview(null);
  };

  const importAchatsExcel = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        let products = [...db.products];
        let suppliers = [...db.suppliers];
        let newPurchases = [];
        let created = 0, matched = 0, skipped = 0;

        rows.forEach((r) => {
          const supplierName = String(r["Fournisseur"] || r["Supplier"] || "").trim();
          const productLabel = String(r["Produit"] || r["Product"] || r["SKU"] || "").trim();
          const qty = Number(r["Quantité"] || r["Quantite"] || r["Qty"] || 0);
          const unitCost = Number(r["Coût unitaire"] || r["Cout unitaire"] || r["Prix unitaire"] || r["UnitCost"] || 0);
          const paymentRaw = String(r["Paiement"] || r["Payment"] || "comptant").trim().toLowerCase();
          const payment = paymentRaw.includes("credit") || paymentRaw.includes("crédit") ? "credit" : "cash";

          if (!supplierName || !productLabel || !qty || !unitCost) { skipped++; return; }

          // Fournisseur : cherche ou crée
          let supplier = suppliers.find((s) => s.name.toLowerCase() === supplierName.toLowerCase());
          if (!supplier) {
            supplier = { id: uid(), name: supplierName, phone: "", balanceDue: 0 };
            suppliers.push(supplier);
          }

          // Produit : cherche par SKU ou nom, sinon crée
          let product = products.find((p) => p.sku.toLowerCase() === productLabel.toLowerCase() || p.name.toLowerCase() === productLabel.toLowerCase());
          if (product) {
            products = adjustStock(products, product.id, null, qty);
            products = products.map((p) => (p.id === product.id ? { ...p, costPrice: unitCost } : p));
            matched++;
          } else {
            product = { id: uid(), name: productLabel, sku: "SKU-" + uid().toUpperCase().slice(0, 5), barcode: uidBarcode(), category: "Général", price: Math.round(unitCost * 1.4), costPrice: unitCost, qty, minQty: 5, variants: [] };
            products.push(product);
            created++;
          }

          const total = qty * unitCost;
          if (payment === "credit") {
            suppliers = suppliers.map((s) => (s.id === supplier.id ? { ...s, balanceDue: (s.balanceDue || 0) + total } : s));
          }
          newPurchases.push({ id: uid(), date: today(), productName: product.name, supplier: supplier.name, supplierId: supplier.id, qty, unitCost, total, payment });
        });

        persist({ ...db, products, suppliers, purchases: [...db.purchases, ...newPurchases] });
        if (log) log("import_achats", "purchases", "-", { lignes: newPurchases.length, created, matched, skipped });
        notify(`Import terminé : ${newPurchases.length} achat(s) enregistré(s) (${created} nouveau(x) produit(s))${skipped ? `, ${skipped} ligne(s) ignorée(s)` : ""}`);
      } catch (e) {
        notify("Fichier Excel invalide ou illisible");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const submit = () => {
    const supplierLabel = form.supplierId
      ? db.suppliers.find((s) => s.id === form.supplierId)?.name
      : form.supplierName;
    if (!supplierLabel || !form.qty || !form.unitCost) return notify("Fournisseur, quantité et coût requis");
    if (needsVariant && !form.variantId) return notify("Choisissez la variante à réapprovisionner");
    let products = [...db.products];
    let productName = "";
    const qty = Number(form.qty);
    const unitCost = Number(form.unitCost);
    const total = qty * unitCost;

    if (useExisting) {
      const idx = products.findIndex((p) => p.id === form.productId);
      if (idx === -1) return notify("Produit introuvable");
      products = adjustStock(products, form.productId, needsVariant ? form.variantId : null, qty);
      products = products.map((p) => (p.id === form.productId ? { ...p, costPrice: unitCost } : p));
      productName = products.find((p) => p.id === form.productId).name;
      if (needsVariant) {
        const v = products.find((p) => p.id === form.productId).variants.find((x) => x.id === form.variantId);
        productName += ` — ${variantLabel(v)}`;
      }
    } else {
      if (!form.newName) return notify("Nom du nouveau produit requis");
      const p = { id: uid(), name: form.newName, sku: "SKU-" + uid().toUpperCase().slice(0, 5), barcode: uidBarcode(), category: "Général", price: Math.round(unitCost * 1.4), costPrice: unitCost, qty, minQty: 5, variants: [] };
      products.push(p);
      productName = p.name;
    }

    let suppliers = [...db.suppliers];
    let supplierId = form.supplierId;
    if (!supplierId && supplierLabel) {
      const newSupplier = { id: uid(), name: supplierLabel, phone: "", balanceDue: 0 };
      suppliers.push(newSupplier);
      supplierId = newSupplier.id;
    }
    if (form.payment === "credit" && supplierId) {
      suppliers = suppliers.map((s) => (s.id === supplierId ? { ...s, balanceDue: (s.balanceDue || 0) + total } : s));
    }

    const purchase = { id: uid(), date: today(), productName, supplier: supplierLabel, supplierId, qty, unitCost, total, payment: form.payment };
    persist({ ...db, products, suppliers, purchases: [...db.purchases, purchase] });
    setForm({ productId: "", variantId: "", newName: "", supplierId: "", supplierName: "", qty: "1", unitCost: "", payment: "cash" });
    notify("Achat enregistré, stock mis à jour");
  };

  return (
    <div>
      <SectionTitle eyebrow="Approvisionnement" title="Achats" />

      <div className="flex justify-end gap-2 mb-3 flex-wrap">
        <input
          type="file"
          ref={pdfInputRef}
          accept=".pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            handlePdfFile(e.target.files[0]);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => pdfInputRef.current && pdfInputRef.current.click()}
          disabled={pdfLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border"
          style={{ borderColor: C.border, color: C.ink, background: C.paperCard }}
        >
          <FileText size={14} /> {pdfLoading ? "Lecture en cours…" : "Importer facture fournisseur (PDF)"}
        </button>
        <input
          type="file"
          ref={importInputRef}
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={(e) => {
            importAchatsExcel(e.target.files[0]);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => importInputRef.current && importInputRef.current.click()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border"
          style={{ borderColor: C.border, color: C.ink, background: C.paperCard }}
        >
          <Upload size={14} /> Importer facture fournisseur (Excel)
        </button>
      </div>

      {pdfReview && (
        <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.accent, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-1">Vérifier avant import (lecture PDF)</div>
          <p className="text-xs mb-4" style={{ color: C.inkSoft }}>
            Lecture automatique du fichier — corrigez les désignations, quantités ou prix si besoin avant de confirmer. Rien n'est ajouté au stock tant que vous n'avez pas cliqué sur "Confirmer".
          </p>
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <Field label="Fournisseur existant">
              <select
                className={inputClass}
                style={inputStyle}
                value={pdfReview.supplierId}
                onChange={(e) => {
                  const sup = db.suppliers.find((x) => x.id === e.target.value);
                  setPdfReview((r) => ({ ...r, supplierId: e.target.value, supplierName: sup ? sup.name : r.supplierName }));
                }}
              >
                <option value="">— Nouveau fournisseur —</option>
                {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            {!pdfReview.supplierId && (
              <Field label="Nom du fournisseur">
                <input className={inputClass} style={inputStyle} value={pdfReview.supplierName} onChange={(e) => setPdfReview((r) => ({ ...r, supplierName: e.target.value }))} />
              </Field>
            )}
            <Field label="Paiement">
              <select className={inputClass} style={inputStyle} value={pdfReview.payment} onChange={(e) => setPdfReview((r) => ({ ...r, payment: e.target.value }))}>
                <option value="cash">Payé comptant</option>
                <option value="credit">À crédit (je dois au fournisseur)</option>
              </select>
            </Field>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest" style={{ ...monoFont, color: C.inkSoft }}>
              <span className="w-5"></span>
              <span className="flex-1">Désignation</span>
              <span className="w-20">Qté</span>
              <span className="w-24">Prix unit.</span>
              <span className="w-5"></span>
            </div>
            {pdfReview.lines.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input type="checkbox" checked={l.include} onChange={(e) => updatePdfLine(idx, "include", e.target.checked)} />
                <input className="flex-1 border rounded-md px-2 py-1.5 text-sm" style={inputStyle} value={l.designation} onChange={(e) => updatePdfLine(idx, "designation", e.target.value)} />
                <input type="number" className="w-20 border rounded-md px-2 py-1.5 text-sm" style={inputStyle} value={l.qty} onChange={(e) => updatePdfLine(idx, "qty", Number(e.target.value))} />
                <input type="number" className="w-24 border rounded-md px-2 py-1.5 text-sm" style={inputStyle} value={l.unitPrice} onChange={(e) => updatePdfLine(idx, "unitPrice", Number(e.target.value))} />
                <button onClick={() => removePdfLine(idx)}><X size={14} color={C.danger} /></button>
              </div>
            ))}
            {pdfReview.lines.length === 0 && (
              <p className="text-sm" style={{ color: C.inkSoft }}>Toutes les lignes ont été retirées.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={confirmPdfImport} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
              <CheckCircle2 size={14} /> Confirmer l'import
            </button>
            <button onClick={() => setPdfReview(null)} className="px-4 py-2 rounded-md text-sm border" style={{ borderColor: C.border, color: C.inkSoft }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouvel achat</div>
        <div className="grid md:grid-cols-6 gap-3">
          <Field label="Produit existant">
            <select className={inputClass} style={inputStyle} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, variantId: "" })}>
              <option value="">— Nouveau produit —</option>
              {db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          {needsVariant && (
            <Field label="Variante à réapprovisionner">
              <select className={inputClass} style={inputStyle} value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })}>
                <option value="">— Choisir —</option>
                {selectedProduct.variants.map((v) => (
                  <option key={v.id} value={v.id}>{variantLabel(v) || "Standard"} ({v.qty || 0} en stock)</option>
                ))}
              </select>
            </Field>
          )}
          {!useExisting && (
            <Field label="Nom du produit">
              <input className={inputClass} style={inputStyle} value={form.newName} onChange={(e) => setForm({ ...form, newName: e.target.value })} />
            </Field>
          )}
          <Field label="Fournisseur existant">
            <select className={inputClass} style={inputStyle} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">— Nouveau fournisseur —</option>
              {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {!form.supplierId && (
            <Field label="Nom du fournisseur">
              <input className={inputClass} style={inputStyle} value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
            </Field>
          )}
          <Field label="Quantité">
            <input type="number" className={inputClass} style={inputStyle} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </Field>
          <Field label="Coût unitaire (DHS)">
            <input type="number" className={inputClass} style={inputStyle} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
          </Field>
          <Field label="Paiement">
            <select className={inputClass} style={inputStyle} value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}>
              <option value="cash">Payé comptant</option>
              <option value="credit">À crédit (je dois au fournisseur)</option>
            </select>
          </Field>
        </div>
        <button onClick={submit} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <PackagePlus size={14} /> Enregistrer l'achat
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Date</td><td className="px-4 py-3">Produit</td><td className="px-4 py-3">Fournisseur</td>
              <td className="px-4 py-3">Qté</td><td className="px-4 py-3">Coût unit.</td><td className="px-4 py-3">Total</td><td className="px-4 py-3">Paiement</td>
            </tr>
          </thead>
          <tbody>
            {[...db.purchases].reverse().map((p) => (
              <tr key={p.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={monoFont}>{p.date}</td>
                <td className="px-4 py-3">{p.productName}</td>
                <td className="px-4 py-3" style={{ color: C.inkSoft }}>{p.supplier}</td>
                <td className="px-4 py-3" style={monoFont}>{p.qty}</td>
                <td className="px-4 py-3" style={monoFont}>{fmt(p.unitCost)}</td>
                <td className="px-4 py-3" style={monoFont}>{fmt(p.total)} DHS</td>
                <td className="px-4 py-3">
                  {p.payment === "credit" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: C.dangerSoft, color: C.danger }}>CRÉDIT</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: C.successSoft, color: C.success }}>COMPTANT</span>
                  )}
                </td>
              </tr>
            ))}
            {db.purchases.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun achat enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Ventes / PDV ----------
function Ventes({ db, persist, notify, session }) {
  const [cart, setCart] = useState([]);
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState("");
  const [payment, setPayment] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [channel, setChannel] = useState("Boutique");
  const [scan, setScan] = useState("");
  const [pickingProduct, setPickingProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const printThermalReceipt = (receipt) => {
    const company = db.company || {};
    const linesHtml = receipt.items
      .map(
        (i) => `<div class="line">
          <div class="name">${i.name}${i.qty > 1 ? ` × ${i.qty}` : ""}</div>
          <div class="amt">${fmt(i.price * i.qty)}</div>
        </div>`
      )
      .join("");
    const html = `
      <html>
        <head>
          <title>Reçu ${receipt.number}</title>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', monospace; width: 76mm; margin: 0 auto; padding: 6px 4px; font-size: 12px; color: #000; }
            .center { text-align: center; }
            h1 { font-size: 15px; margin: 0 0 2px; }
            .muted { font-size: 10px; color: #333; }
            hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
            .line { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
            .name { flex: 1; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="center">
            <h1>${company.name || "Electrolik"}</h1>
            <div class="muted">${company.address || ""}${company.phone ? " · " + company.phone : ""}</div>
            <div class="muted">${company.ice ? "ICE: " + company.ice : ""}</div>
          </div>
          <hr/>
          <div class="muted">Reçu : ${receipt.number}</div>
          <div class="muted">${receipt.date} · ${receipt.client}</div>
          <hr/>
          ${linesHtml}
          <hr/>
          ${receipt.discount > 0 ? `<div class="line"><div>Remise</div><div>-${fmt(receipt.discount)}</div></div>` : ""}
          ${receipt.tvaRate ? `<div class="line muted"><div>dont TVA ${receipt.tvaRate}%</div><div>${fmt(receipt.tvaAmount)}</div></div>` : ""}
          <div class="total-row"><div>TOTAL</div><div>${fmt(receipt.total)} DHS</div></div>
          <div class="muted" style="margin-top:2px;">Paiement : ${receipt.payment === "cash" ? "Comptant" : "Crédit"}</div>
          <hr/>
          <div class="center muted">Merci de votre confiance !</div>
        </body>
      </html>`;
    const w = window.open("", "_blank", "width=380,height=600");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const cartKey = (productId, variantId) => productId + "::" + (variantId || "");

  const addVariantToCart = (p, variant) => {
    const availableQty = variant ? variant.qty || 0 : productQty(p);
    if (availableQty <= 0) return notify("Rupture de stock");
    const key = cartKey(p.id, variant && variant.id);
    setCart((c) => {
      const existing = c.find((i) => cartKey(i.productId, i.variantId) === key);
      if (existing) {
        if (existing.qty >= availableQty) { notify("Stock insuffisant"); return c; }
        return c.map((i) => (cartKey(i.productId, i.variantId) === key ? { ...i, qty: i.qty + 1 } : i));
      }
      const name = variant ? `${p.name} — ${variantLabel(variant)}` : p.name;
      return [...c, { productId: p.id, variantId: variant ? variant.id : null, name, price: p.price, qty: 1 }];
    });
    setPickingProduct(null);
  };

  const addToCart = (p) => {
    if (p.variants && p.variants.length > 0) {
      setPickingProduct(p);
      return;
    }
    addVariantToCart(p, null);
  };

  const handleScan = (e) => {
    if (e.key !== "Enter") return;
    const code = scan.trim();
    setScan("");
    if (!code) return;
    const found = findByCode(db.products, code);
    if (!found) return notify("Aucun produit avec ce code");
    addVariantToCart(found.product, found.variant);
  };

  const handleCameraDetected = (code) => {
    setShowCamera(false);
    const found = findByCode(db.products, code);
    if (!found) return notify("Aucun produit avec ce code");
    addVariantToCart(found.product, found.variant);
  };

  const changeQty = (key, delta) =>
    setCart((c) => c.map((i) => (cartKey(i.productId, i.variantId) === key ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  const removeItem = (key) => setCart((c) => c.filter((i) => cartKey(i.productId, i.variantId) !== key));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmount = Math.min(subtotal, (subtotal * (Number(discount) || 0)) / 100);
  const total = subtotal - discountAmount;
  const tvaRate = (db.company && db.company.tvaRate) || 0;
  const totalHT = tvaRate ? total / (1 + tvaRate / 100) : total;
  const tvaAmount = total - totalHT;

  const checkout = () => {
    if (cart.length === 0) return notify("Panier vide");
    for (const item of cart) {
      const p = db.products.find((x) => x.id === item.productId);
      if (!p) return notify(`Produit introuvable pour ${item.name}`);
      const variant = item.variantId ? (p.variants || []).find((v) => v.id === item.variantId) : null;
      const available = variant ? variant.qty || 0 : productQty(p);
      if (available < item.qty) return notify(`Stock insuffisant pour ${item.name}`);
    }
    let products = [...db.products];
    for (const item of cart) {
      products = adjustStock(products, item.productId, item.variantId, -item.qty);
    }

    const clientName = client || "Client comptoir";
    let clients = [...db.clients];
    if (clientId) {
      clients = clients.map((c) =>
        c.id === clientId && payment === "credit" ? { ...c, balanceDue: (c.balanceDue || 0) + total } : c
      );
    }

    const soldBy = session ? session.userName : "—";
    const saleId = uid();
    const sale = { id: saleId, date: today(), items: cart, total, totalHT, tvaAmount, tvaRate, discount: discountAmount, client: clientName, clientId, payment, channel, soldBy };
    const invoiceNumber = "NG-" + db.nextInvoice;
    const invoice = {
      id: uid(),
      saleId,
      number: invoiceNumber,
      date: today(),
      client: clientName,
      clientId,
      total,
      totalHT,
      tvaAmount,
      tvaRate,
      status: payment === "cash" ? "paid" : "pending",
      items: cart,
      channel,
      soldBy,
    };

    persist({
      ...db,
      products,
      clients,
      sales: [...db.sales, sale],
      invoices: [...db.invoices, invoice],
      nextInvoice: db.nextInvoice + 1,
    });
    setCart([]); setClient(""); setClientId(""); setPayment("cash"); setDiscount("0"); setChannel("Boutique");
    setLastReceipt({ ...sale, number: invoiceNumber });
    notify(`Vente enregistrée — facture ${invoiceNumber}`);
  };

  return (
    <div>
      <SectionTitle eyebrow="Point de vente" title="Ventes / PDV" />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 max-w-sm flex-1" style={{ borderColor: C.accent, background: C.paperCard }}>
          <Barcode size={16} color={C.accent} />
          <input
            placeholder="Scanner ou taper un code-barres, puis Entrée…"
            className="w-full outline-none text-sm"
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={handleScan}
          />
        </div>
        <button
          onClick={() => setShowCamera(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white"
          style={{ background: C.accent }}
        >
          <Camera size={16} /> Scanner avec la caméra
        </button>
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 max-w-sm flex-1" style={{ borderColor: C.border, background: C.paperCard }}>
          <Search size={16} color={C.inkSoft} />
          <input
            placeholder="Rechercher par nom ou SKU…"
            className="w-full outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {showCamera && <CameraScanner onDetected={handleCameraDetected} onClose={() => setShowCamera(false)} />}

      {pickingProduct && (
        <div className="rounded-xl border p-4 mb-4" style={{ borderColor: C.accent, background: C.paperCard }}>
          <div className="flex items-center justify-between mb-3">
            <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest">
              Choisir une variante — {pickingProduct.name}
            </div>
            <button onClick={() => setPickingProduct(null)}><X size={14} color={C.inkSoft} /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(pickingProduct.variants || []).map((v) => (
              <button
                key={v.id}
                onClick={() => addVariantToCart(pickingProduct, v)}
                disabled={(v.qty || 0) <= 0}
                className="px-3 py-2 rounded-md border text-sm disabled:opacity-40"
                style={{ borderColor: C.border }}
              >
                {variantLabel(v) || "Standard"} <span style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }}>({v.qty || 0})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {db.products
              .filter((p) => (p.name + " " + p.sku).toLowerCase().includes(search.toLowerCase()))
              .map((p) => {
              const qty = productQty(p);
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={qty <= 0}
                  className="text-left rounded-xl border p-3 disabled:opacity-40 flex gap-3 items-center"
                  style={{ borderColor: C.border, background: C.paperCard }}
                >
                  <div className="w-12 h-12 rounded-md border flex items-center justify-center overflow-hidden shrink-0" style={{ borderColor: C.border, background: C.paper }}>
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} color={C.inkSoft} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm mb-1 truncate" style={{ color: C.ink }}>{p.name}</div>
                    <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }}>
                      {p.sku} · {qty} en stock{p.variants && p.variants.length > 0 ? ` · ${p.variants.length} variantes` : ""}
                    </div>
                    <div style={{ ...monoFont, color: C.accent }} className="mt-1 text-sm">{fmt(p.price)} DHS</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border p-5 h-fit sticky top-5" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Panier</div>
          {cart.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Cliquez sur un produit pour l'ajouter.</p>
          ) : (
            <ul className="space-y-3 mb-4">
              {cart.map((i) => {
                const key = cartKey(i.productId, i.variantId);
                return (
                  <li key={key} className="flex items-center justify-between text-sm gap-2">
                    <span style={{ color: C.ink }} className="flex-1">{i.name}</span>
                    <button onClick={() => changeQty(key, -1)} className="w-5 h-5 border rounded flex items-center justify-center" style={{ borderColor: C.border }}><Minus size={10} /></button>
                    <span style={monoFont}>{i.qty}</span>
                    <button onClick={() => changeQty(key, 1)} className="w-5 h-5 border rounded flex items-center justify-center" style={{ borderColor: C.border }}><Plus size={10} /></button>
                    <button onClick={() => removeItem(key)}><X size={13} color={C.danger} /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <Field label="Client">
            <select
              className={inputClass}
              style={{ ...inputStyle, marginBottom: 10 }}
              value={clientId}
              onChange={(e) => {
                const c = db.clients.find((x) => x.id === e.target.value);
                setClientId(e.target.value);
                setClient(c ? c.name : "");
              }}
            >
              <option value="">Client comptoir</option>
              {db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Remise (%)">
            <input type="number" min="0" max="100" className={inputClass} style={{ ...inputStyle, marginBottom: 10 }} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label="Paiement">
            <select className={inputClass} style={inputStyle} value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="cash">Comptant (payé)</option>
              <option value="credit">Crédit (en attente)</option>
            </select>
          </Field>
          <Field label="Canal de vente">
            <select className={inputClass} style={{ ...inputStyle, marginTop: 10 }} value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="Boutique">Boutique (magasin)</option>
              <option value="Site web">Site web</option>
              <option value="Facebook">Facebook</option>
              <option value="Instagram">Instagram</option>
              <option value="WhatsApp">WhatsApp</option>
            </select>
          </Field>
          <div className="flex justify-between text-sm mt-3">
            <span style={{ color: C.inkSoft }}>Sous-total</span>
            <span style={monoFont}>{fmt(subtotal)} DHS</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: C.inkSoft }}>Remise</span>
              <span style={{ ...monoFont, color: C.danger }}>−{fmt(discountAmount)} DHS</span>
            </div>
          )}
          {tvaRate > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span style={{ color: C.inkSoft }}>Total HT</span>
                <span style={monoFont}>{fmt(totalHT)} DHS</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: C.inkSoft }}>TVA ({tvaRate}%)</span>
                <span style={monoFont}>{fmt(tvaAmount)} DHS</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center my-4 pt-3 border-t" style={{ borderColor: C.border }}>
            <span style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }} className="uppercase">Total {tvaRate > 0 ? "TTC" : ""}</span>
            <span style={{ ...displayFont, color: C.ink }} className="text-2xl">{fmt(total)} DHS</span>
          </div>
          <button onClick={checkout} className="w-full py-2.5 rounded-md text-sm text-white flex items-center justify-center gap-2" style={{ background: C.accent }}>
            Valider la vente <ChevronRight size={14} />
          </button>
          {lastReceipt && (
            <button
              onClick={() => printThermalReceipt(lastReceipt)}
              className="w-full mt-2 py-2 rounded-md text-sm border flex items-center justify-center gap-2"
              style={{ borderColor: C.border, color: C.ink }}
            >
              <Printer size={14} /> Imprimer le reçu ({lastReceipt.number})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Facturation ----------
function Facturation({ db, persist, notify, log }) {
  const markPaid = (id) => {
    const inv = db.invoices.find((i) => i.id === id);
    const clients = inv && inv.clientId
      ? db.clients.map((c) => (c.id === inv.clientId ? { ...c, balanceDue: Math.max(0, (c.balanceDue || 0) - inv.total) } : c))
      : db.clients;
    persist({ ...db, clients, invoices: db.invoices.map((i) => (i.id === id ? { ...i, status: "paid" } : i)) });
    if (log && inv) log("mark_invoice_paid", "invoices", id, { number: inv.number, total: inv.total });
  };

  const processReturn = (inv) => {
    if (!confirm(`Traiter le retour complet de la facture ${inv.number} ? Les articles seront remis en stock.`)) return;
    const sale = db.sales.find((s) => s.id === inv.saleId);
    if (!sale) return notify("Vente d'origine introuvable, retour impossible");
    if (sale.returned) return notify("Cette vente a déjà été retournée");

    let products = [...db.products];
    (inv.items || []).forEach((item) => {
      products = adjustStock(products, item.productId, item.variantId, item.qty);
    });
    const clients = inv.clientId && inv.status === "pending"
      ? db.clients.map((c) => (c.id === inv.clientId ? { ...c, balanceDue: Math.max(0, (c.balanceDue || 0) - inv.total) } : c))
      : db.clients;
    const ret = { id: uid(), date: today(), invoiceNumber: inv.number, client: inv.client, total: inv.total };

    persist({
      ...db,
      products,
      clients,
      sales: db.sales.map((s) => (s.id === sale.id ? { ...s, returned: true } : s)),
      invoices: db.invoices.map((i) => (i.id === inv.id ? { ...i, status: "returned" } : i)),
      returns: [...(db.returns || []), ret],
    });
    if (log) log("process_return", "invoices", inv.id, { number: inv.number, total: inv.total });
    notify(`Retour traité pour ${inv.number}, stock remis à jour`);
  };

  const totalPending = db.invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.total, 0);

  const exportExcel = () => {
    const rows = db.invoices.map((inv) => ({
      Numéro: inv.number, Date: inv.date, Client: inv.client,
      Total: inv.total, Statut: inv.status === "paid" ? "Payé" : inv.status === "returned" ? "Retourné" : "En attente",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Factures");
    XLSX.writeFile(wb, "factures.xlsx");
    notify("Export Excel téléchargé");
  };

  const printInvoice = (inv) => {
    const rowsHtml = (inv.items || [])
      .map(
        (i) => `<tr>
          <td style="padding:8px 0;">${i.name}</td>
          <td style="padding:8px 0;text-align:center;">${i.qty}</td>
          <td style="padding:8px 0;text-align:right;">${fmt(i.price)} DHS</td>
          <td style="padding:8px 0;text-align:right;">${fmt(i.price * i.qty)} DHS</td>
        </tr>`
      )
      .join("");
    const company = db.company || {};
    const legalLine = [
      company.ice ? `ICE: ${company.ice}` : "",
      company.rc ? `RC: ${company.rc}` : "",
      company.patente ? `Patente: ${company.patente}` : "",
    ].filter(Boolean).join(" · ");
    const tvaRows = inv.tvaRate
      ? `
        <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:13px;color:#5B6274;">
          <span>Total HT</span><span>${fmt(inv.totalHT)} DHS</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#5B6274;">
          <span>TVA (${inv.tvaRate}%)</span><span>${fmt(inv.tvaAmount)} DHS</span>
        </div>`
      : "";
    const html = `
      <html>
        <head>
          <title>${inv.number}</title>
          <style>
            body { font-family: 'Inter', ui-sans-serif, sans-serif; color: #14161B; padding: 40px; max-width: 640px; margin: auto; }
            h1 { font-family: 'Space Grotesk', ui-sans-serif, sans-serif; font-weight: 700; margin-bottom: 0; letter-spacing: -0.01em; }
            .muted { color: #5B6274; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
            .legal { color: #5B6274; font-size: 11px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #5B6274; border-bottom: 1px solid #DBDFE7; padding-bottom: 6px; }
            th:nth-child(2) { text-align: center; }
            th:nth-child(3), th:nth-child(4) { text-align: right; }
            tr td { border-bottom: 1px solid #EEE; }
            .total { text-align: right; margin-top: 10px; font-size: 22px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; }
            .stamp { display: inline-block; margin-top: 10px; padding: 4px 12px; border: 2px solid ${inv.status === "paid" ? "#3F7859" : "#B4453A"}; color: ${inv.status === "paid" ? "#3F7859" : "#B4453A"}; border-radius: 999px; font-size: 11px; letter-spacing: 0.1em; transform: rotate(-2deg); }
          </style>
        </head>
        <body>
          <h1>${company.name || "Electrolik"}</h1>
          ${company.address || company.phone ? `<div class="legal">${[company.address, company.phone].filter(Boolean).join(" · ")}</div>` : ""}
          ${legalLine ? `<div class="legal">${legalLine}</div>` : ""}
          <div class="muted" style="margin-top:12px;">Facture ${inv.number}</div>
          <p>Client : ${inv.client}<br/>Date : ${inv.date}${inv.soldBy ? `<br/>Vendu par : ${inv.soldBy}` : ""}</p>
          <table>
            <thead><tr><th>Article</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${tvaRows}
          <div class="total">Total ${inv.tvaRate ? "TTC" : ""} : ${fmt(inv.total)} DHS</div>
          <div class="stamp">${inv.status === "paid" ? "PAYÉ" : inv.status === "returned" ? "RETOURNÉ" : "EN ATTENTE"}</div>
        </body>
      </html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div>
      <SectionTitle
        eyebrow="Registre"
        title="Facturation"
        action={
          <div className="flex items-center gap-4">
            <button onClick={exportExcel} className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border" style={{ borderColor: C.border, color: C.inkSoft }}>
              <Download size={13} /> Excel
            </button>
            <div className="text-right">
              <div style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest">En attente</div>
              <div style={{ ...displayFont, color: C.danger }} className="text-xl">{fmt(totalPending)} DHS</div>
            </div>
          </div>
        }
      />
      <div className="space-y-3">
        {[...db.invoices].reverse().map((inv) => (
          <div key={inv.id} className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: C.border, background: C.paperCard }}>
            <div>
              <div style={monoFont} className="text-sm">{inv.number}</div>
              <div style={{ color: C.inkSoft }} className="text-xs">{inv.client} · {inv.date}{inv.soldBy ? ` · ${inv.soldBy}` : ""}</div>
            </div>
            <div style={{ ...displayFont, color: inv.status === "returned" ? C.inkSoft : C.ink }} className="text-lg">{fmt(inv.total)} DHS</div>
            <Stamp status={inv.status} />
            <div className="flex gap-2">
              <button onClick={() => printInvoice(inv)} className="text-xs px-3 py-1.5 rounded-md border flex items-center gap-1" style={{ borderColor: C.border, color: C.inkSoft }}>
                <Printer size={12} /> Imprimer
              </button>
              {inv.status === "pending" && (
                <button onClick={() => markPaid(inv.id)} className="text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: C.success, color: C.success }}>
                  Marquer payée
                </button>
              )}
              {inv.status !== "returned" && (
                <button onClick={() => processReturn(inv)} className="text-xs px-3 py-1.5 rounded-md border flex items-center gap-1" style={{ borderColor: C.danger, color: C.danger }}>
                  <RotateCcw size={12} /> Retour
                </button>
              )}
            </div>
          </div>
        ))}
        {db.invoices.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: C.inkSoft }}>
            Aucune facture pour l'instant — elles sont créées automatiquement depuis le module Ventes.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Clients ----------
const PAYMENT_MODE_LABELS = { hebdo: "Chaque semaine", "10j": "Tous les 10 jours (sur colis livrés)", surplace: "Sur place" };

function Clients({ db, persist, notify, log }) {
  const [form, setForm] = useState({ name: "", phone: "", paymentMode: "surplace" });

  const addClient = () => {
    if (!form.name) return notify("Nom requis");
    persist({ ...db, clients: [...db.clients, { id: uid(), name: form.name, phone: form.phone, paymentMode: form.paymentMode, balanceDue: 0 }] });
    setForm({ name: "", phone: "", paymentMode: "surplace" });
    notify("Client ajouté");
  };

  const changePaymentMode = (id, mode) => {
    persist({ ...db, clients: db.clients.map((c) => (c.id === id ? { ...c, paymentMode: mode } : c)) });
  };

  const removeClient = (id) => {
    const c = db.clients.find((x) => x.id === id);
    const prevDb = db;
    persist({ ...db, clients: db.clients.filter((c) => c.id !== id) });
    if (log && c) log("delete_client", "clients", id, { name: c.name });
    if (c) notify(`Client "${c.name}" supprimé`, () => persist(prevDb));
  };

  const totalDue = db.clients.reduce((s, c) => s + (c.balanceDue || 0), 0);

  const whatsappReminder = (c) => {
    if (!c.phone) return notify("Ce client n'a pas de numéro de téléphone enregistré");
    let phone = c.phone.replace(/[\s.\-()]/g, "");
    if (phone.startsWith("0")) phone = "212" + phone.slice(1);
    else if (!phone.startsWith("212")) phone = "212" + phone;
    const msg =
      (c.balanceDue || 0) > 0
        ? `Bonjour ${c.name}, un rappel amical : votre solde dû chez Electrolik est de ${fmt(c.balanceDue)} DHS. Merci de bien vouloir régulariser. 🙏`
        : `Bonjour ${c.name}, merci pour votre confiance chez Electrolik ! N'hésitez pas à nous contacter pour toute commande. 😊`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div>
      <SectionTitle
        eyebrow="Registre"
        title="Clients"
        action={
          <div className="text-right">
            <div style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest">Total dû</div>
            <div style={{ ...displayFont, color: C.danger }} className="text-xl">{fmt(totalDue)} DHS</div>
          </div>
        }
      />
      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouveau client</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Nom"><input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputClass} style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Mode de paiement">
            <select className={inputClass} style={inputStyle} value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
              {Object.entries(PAYMENT_MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <button onClick={addClient} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <Plus size={14} /> Ajouter le client
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Client</td><td className="px-4 py-3">Téléphone</td><td className="px-4 py-3">Mode de paiement</td><td className="px-4 py-3">Solde dû</td><td className="px-4 py-3"></td>
            </tr>
          </thead>
          <tbody>
            {db.clients.map((c) => (
              <tr key={c.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={{ color: C.ink }}>{c.name}</td>
                <td className="px-4 py-3 flex items-center gap-1" style={{ color: C.inkSoft }}><Phone size={12} />{c.phone || "—"}</td>
                <td className="px-4 py-3">
                  <select
                    className="border rounded-md px-2 py-1 text-xs outline-none"
                    style={inputStyle}
                    value={c.paymentMode || "surplace"}
                    onChange={(e) => changePaymentMode(c.id, e.target.value)}
                  >
                    {Object.entries(PAYMENT_MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3" style={{ ...monoFont, color: c.balanceDue > 0 ? C.danger : C.success }}>{fmt(c.balanceDue || 0)} DHS</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => whatsappReminder(c)} title="Envoyer un message WhatsApp">
                      <MessageCircle size={15} color="#25D366" />
                    </button>
                    <button onClick={() => removeClient(c.id)}><Trash2 size={14} color={C.danger} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {db.clients.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun client enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Fournisseurs ----------
function Fournisseurs({ db, persist, notify, log }) {
  const [form, setForm] = useState({ name: "", phone: "" });
  const [payForm, setPayForm] = useState({ supplierId: "", amount: "" });
  const [debtForm, setDebtForm] = useState({ supplierId: "", amount: "", note: "" });

  const addSupplier = () => {
    if (!form.name) return notify("Nom requis");
    persist({ ...db, suppliers: [...db.suppliers, { id: uid(), name: form.name, phone: form.phone, balanceDue: 0 }] });
    setForm({ name: "", phone: "" });
    notify("Fournisseur ajouté");
  };

  const removeSupplier = (id) => {
    const s = db.suppliers.find((x) => x.id === id);
    const prevDb = db;
    persist({ ...db, suppliers: db.suppliers.filter((s) => s.id !== id) });
    if (log && s) log("delete_supplier", "suppliers", id, { name: s.name });
    if (s) notify(`Fournisseur "${s.name}" supprimé`, () => persist(prevDb));
  };

  const addExistingDebt = () => {
    const supplier = db.suppliers.find((s) => s.id === debtForm.supplierId);
    const amount = Number(debtForm.amount);
    if (!supplier || !amount || amount <= 0) return notify("Fournisseur et montant requis");
    const suppliers = db.suppliers.map((s) =>
      s.id === supplier.id ? { ...s, balanceDue: (s.balanceDue || 0) + amount } : s
    );
    const debt = { id: uid(), date: today(), supplierId: supplier.id, supplierName: supplier.name, amount, note: debtForm.note };
    persist({ ...db, suppliers, openingDebts: [...(db.openingDebts || []), debt] }); // ne touche ni au stock, ni aux achats — juste le solde dû
    if (log) log("add_opening_debt", "suppliers", supplier.id, { name: supplier.name, amount, note: debtForm.note });
    setDebtForm({ supplierId: "", amount: "", note: "" });
    notify(`Dette de ${fmt(amount)} DHS ajoutée pour ${supplier.name}`);
  };

  const recordPayment = () => {
    const supplier = db.suppliers.find((s) => s.id === payForm.supplierId);
    const amount = Number(payForm.amount);
    if (!supplier || !amount || amount <= 0) return notify("Fournisseur et montant requis");
    const suppliers = db.suppliers.map((s) =>
      s.id === supplier.id ? { ...s, balanceDue: Math.max(0, (s.balanceDue || 0) - amount) } : s
    );
    const payment = { id: uid(), date: today(), supplierId: supplier.id, supplierName: supplier.name, amount };
    persist({ ...db, suppliers, supplierPayments: [...(db.supplierPayments || []), payment] });
    if (log) log("pay_supplier", "suppliers", supplier.id, { name: supplier.name, amount });
    setPayForm({ supplierId: "", amount: "" });
    notify(`Paiement de ${fmt(amount)} DHS enregistré pour ${supplier.name}`);
  };

  const spentBySupplier = (name) => db.purchases.filter((p) => p.supplier === name).reduce((s, p) => s + p.total, 0);
  const totalDue = db.suppliers.reduce((s, x) => s + (x.balanceDue || 0), 0);

  // Construit la liste chronologique de toutes les transactions avec un fournisseur + solde cumulé
  const getSupplierStatement = (supplier) => {
    const rows = [];
    (db.openingDebts || []).filter((d) => d.supplierId === supplier.id).forEach((d) => {
      rows.push({ date: d.date, type: "Dette initiale", detail: d.note || "Solde de départ", montant: d.amount, sens: "+" });
    });
    db.purchases.filter((p) => p.supplierId === supplier.id).forEach((p) => {
      rows.push({
        date: p.date,
        type: p.payment === "credit" ? "Achat à crédit" : "Achat comptant",
        detail: `${p.productName} × ${p.qty}`,
        montant: p.total,
        sens: p.payment === "credit" ? "+" : "0",
      });
    });
    (db.supplierPayments || []).filter((pay) => pay.supplierId === supplier.id).forEach((pay) => {
      rows.push({ date: pay.date, type: "Paiement", detail: "Réglé au fournisseur", montant: pay.amount, sens: "-" });
    });
    rows.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
    let solde = 0;
    return rows.map((r) => {
      if (r.sens === "+") solde += r.montant;
      if (r.sens === "-") solde -= r.montant;
      return { ...r, solde };
    });
  };

  const printSupplierStatement = (supplier) => {
    const rows = getSupplierStatement(supplier);
    const company = db.company || {};
    const rowsHtml = rows
      .map(
        (r) => `<tr>
          <td style="padding:6px 0;">${r.date}</td>
          <td style="padding:6px 0;">${r.type}</td>
          <td style="padding:6px 0;color:#5B6274;">${r.detail}</td>
          <td style="padding:6px 0;text-align:right;color:${r.sens === "+" ? "#B4453A" : r.sens === "-" ? "#3F7859" : "#5B6274"};">${r.sens === "+" ? "+" : r.sens === "-" ? "−" : ""}${fmt(r.montant)} DHS</td>
          <td style="padding:6px 0;text-align:right;">${fmt(r.solde)} DHS</td>
        </tr>`
      )
      .join("");
    const html = `
      <html>
        <head>
          <title>Relevé — ${supplier.name}</title>
          <style>
            body { font-family: '''Inter''', ui-sans-serif, sans-serif; color: #14161B; padding: 40px; max-width: 760px; margin: auto; }
            h1 { font-family: '''Space Grotesk''', ui-sans-serif, sans-serif; font-weight: 700; margin-bottom: 0; letter-spacing: -0.01em; }
            .muted { color: #5B6274; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #5B6274; border-bottom: 1px solid #DBDFE7; padding-bottom: 6px; }
            th:nth-child(4), th:nth-child(5) { text-align: right; }
            tr td { border-bottom: 1px solid #EEE; }
            .total { text-align: right; margin-top: 14px; font-size: 22px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>${company.name || "Electrolik"}</h1>
          <div class="muted" style="margin-top:12px;">Relevé de compte — ${supplier.name}</div>
          <p>Téléphone : ${supplier.phone || "—"}<br/>Généré le : ${today()}</p>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Détail</th><th>Montant</th><th>Solde cumulé</th></tr></thead>
            <tbody>${rowsHtml || `<tr><td colspan="5" style="padding:12px 0;color:#5B6274;">Aucune transaction.</td></tr>`}</tbody>
          </table>
          <div class="total">Solde dû actuel : ${fmt(supplier.balanceDue || 0)} DHS</div>
        </body>
      </html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const exportSupplierStatementExcel = (supplier) => {
    const rows = getSupplierStatement(supplier);
    const data = rows.map((r) => ({
      Date: r.date,
      Type: r.type,
      Détail: r.detail,
      "Montant (DHS)": r.sens === "+" ? r.montant : r.sens === "-" ? -r.montant : r.montant,
      "Solde cumulé (DHS)": r.solde,
    }));
    data.push({ Date: "", Type: "", Détail: "SOLDE DÛ ACTUEL", "Montant (DHS)": "", "Solde cumulé (DHS)": supplier.balanceDue || 0 });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relevé");
    XLSX.writeFile(wb, `releve-${supplier.name.replace(/[^a-z0-9]+/gi, "-")}-${today()}.xlsx`);
    notify("Relevé Excel téléchargé");
  };

  return (
    <div>
      <SectionTitle
        eyebrow="Registre"
        title="Fournisseurs"
        action={
          <div className="text-right">
            <div style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest">Total dû aux fournisseurs</div>
            <div style={{ ...displayFont, color: C.danger }} className="text-xl">{fmt(totalDue)} DHS</div>
          </div>
        }
      />
      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouveau fournisseur</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Nom"><input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputClass} style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <button onClick={addSupplier} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <Plus size={14} /> Ajouter le fournisseur
        </button>
      </div>

      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.accent, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-1">Dette déjà existante (solde de départ)</div>
        <p className="text-xs mb-4" style={{ color: C.inkSoft }}>
          Pour enregistrer un montant que vous devez déjà à un fournisseur (avant d'utiliser cette application). Cela n'affecte ni le stock ni les achats — uniquement le solde dû.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Fournisseur">
            <select className={inputClass} style={inputStyle} value={debtForm.supplierId} onChange={(e) => setDebtForm({ ...debtForm, supplierId: e.target.value })}>
              <option value="">— Choisir —</option>
              {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Montant dû (DHS)">
            <input type="number" className={inputClass} style={inputStyle} value={debtForm.amount} onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })} />
          </Field>
          <Field label="Note (optionnel)">
            <input className={inputClass} style={inputStyle} value={debtForm.note} onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })} placeholder="Ex. solde avant l'application" />
          </Field>
        </div>
        <button onClick={addExistingDebt} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <Plus size={14} /> Ajouter cette dette
        </button>
      </div>

      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Enregistrer un paiement</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Fournisseur">
            <select className={inputClass} style={inputStyle} value={payForm.supplierId} onChange={(e) => setPayForm({ ...payForm, supplierId: e.target.value })}>
              <option value="">— Choisir —</option>
              {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({fmt(s.balanceDue || 0)} DHS dû)</option>)}
            </select>
          </Field>
          <Field label="Montant payé (DHS)">
            <input type="number" className={inputClass} style={inputStyle} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </Field>
        </div>
        <button onClick={recordPayment} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border" style={{ borderColor: C.success, color: C.success }}>
          <Save size={14} /> Enregistrer le paiement
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Fournisseur</td><td className="px-4 py-3">Téléphone</td><td className="px-4 py-3">Total achats</td><td className="px-4 py-3">Solde dû</td><td className="px-4 py-3">Relevé</td><td className="px-4 py-3"></td>
            </tr>
          </thead>
          <tbody>
            {db.suppliers.map((s) => (
              <tr key={s.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={{ color: C.ink }}>{s.name}</td>
                <td className="px-4 py-3 flex items-center gap-1" style={{ color: C.inkSoft }}><Phone size={12} />{s.phone || "—"}</td>
                <td className="px-4 py-3" style={monoFont}>{fmt(spentBySupplier(s.name))} DHS</td>
                <td className="px-4 py-3" style={{ ...monoFont, color: (s.balanceDue || 0) > 0 ? C.danger : C.success }}>{fmt(s.balanceDue || 0)} DHS</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => printSupplierStatement(s)} title="Télécharger en PDF" className="text-xs px-2 py-1 rounded-md border flex items-center gap-1" style={{ borderColor: C.border, color: C.inkSoft }}>
                      <Printer size={12} /> PDF
                    </button>
                    <button onClick={() => exportSupplierStatementExcel(s)} title="Télécharger en Excel" className="text-xs px-2 py-1 rounded-md border flex items-center gap-1" style={{ borderColor: C.border, color: C.inkSoft }}>
                      <Download size={12} /> Excel
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right"><button onClick={() => removeSupplier(s.id)}><Trash2 size={14} color={C.danger} /></button></td>
              </tr>
            ))}
            {db.suppliers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun fournisseur enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-3">Historique des paiements</div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Date</td><td className="px-4 py-3">Fournisseur</td><td className="px-4 py-3">Montant</td>
            </tr>
          </thead>
          <tbody>
            {[...(db.supplierPayments || [])].reverse().map((p) => (
              <tr key={p.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={monoFont}>{p.date}</td>
                <td className="px-4 py-3">{p.supplierName}</td>
                <td className="px-4 py-3" style={{ ...monoFont, color: C.success }}>{fmt(p.amount)} DHS</td>
              </tr>
            ))}
            {(!db.supplierPayments || db.supplierPayments.length === 0) && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun paiement enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Chèques ----------
function Cheques({ db, persist, notify, log }) {
  const [form, setForm] = useState({ type: "received", number: "", bank: "", party: "", amount: "", dueDate: today() });

  const addCheque = () => {
    if (!form.number || !form.amount || !form.party) return notify("Numéro, montant et nom requis");
    const cheque = { id: uid(), ...form, amount: Number(form.amount), status: "pending" };
    persist({ ...db, cheques: [...db.cheques, cheque] });
    setForm({ type: "received", number: "", bank: "", party: "", amount: "", dueDate: today() });
    notify("Chèque enregistré");
  };

  const toggleStatus = (id) => {
    const c = db.cheques.find((x) => x.id === id);
    const newStatus = c && c.status === "pending" ? "cashed" : "pending";
    persist({
      ...db,
      cheques: db.cheques.map((c) => (c.id === id ? { ...c, status: c.status === "pending" ? "cashed" : "pending" } : c)),
    });
    if (log && c) log("update_cheque_status", "cheques", id, { number: c.number, newStatus });
  };

  const removeCheque = (id) => {
    const c = db.cheques.find((x) => x.id === id);
    const prevDb = db;
    persist({ ...db, cheques: db.cheques.filter((c) => c.id !== id) });
    if (log && c) log("delete_cheque", "cheques", id, { number: c.number });
    if (c) notify(`Chèque "${c.number}" supprimé`, () => persist(prevDb));
  };

  return (
    <div>
      <SectionTitle eyebrow="Trésorerie" title="Chèques" />
      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouveau chèque</div>
        <div className="grid md:grid-cols-6 gap-3">
          <Field label="Type">
            <select className={inputClass} style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="received">Reçu (client)</option>
              <option value="issued">Émis (fournisseur)</option>
            </select>
          </Field>
          <Field label="N° chèque"><input className={inputClass} style={inputStyle} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
          <Field label="Banque"><input className={inputClass} style={inputStyle} value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} /></Field>
          <Field label={form.type === "received" ? "Client" : "Fournisseur"}><input className={inputClass} style={inputStyle} value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} /></Field>
          <Field label="Montant (DHS)"><input type="number" className={inputClass} style={inputStyle} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Échéance"><input type="date" className={inputClass} style={inputStyle} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
        </div>
        <button onClick={addCheque} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <Plus size={14} /> Enregistrer le chèque
        </button>
      </div>

      <div className="space-y-3">
        {[...db.cheques].reverse().map((c) => (
          <div key={c.id} className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: C.border, background: C.paperCard }}>
            <div>
              <div className="flex items-center gap-2">
                <span style={monoFont} className="text-sm">{c.number}</span>
                <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: C.border, color: C.inkSoft }}>
                  {c.type === "received" ? "Reçu" : "Émis"}
                </span>
              </div>
              <div style={{ color: C.inkSoft }} className="text-xs">{c.party} · {c.bank || "—"} · échéance {c.dueDate}</div>
            </div>
            <div style={{ ...displayFont, color: C.ink }} className="text-lg">{fmt(c.amount)} DHS</div>
            <Stamp status={c.status === "cashed" ? "paid" : "pending"} labels={["ENCAISSÉ", "EN ATTENTE"]} />
            <div className="flex gap-2">
              <button onClick={() => toggleStatus(c.id)} className="text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: C.success, color: C.success }}>
                {c.status === "pending" ? "Marquer encaissé" : "Marquer en attente"}
              </button>
              <button onClick={() => removeCheque(c.id)}><Trash2 size={14} color={C.danger} /></button>
            </div>
          </div>
        ))}
        {db.cheques.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: C.inkSoft }}>Aucun chèque enregistré.</div>
        )}
      </div>
    </div>
  );
}

// ---------- Devis ----------
function Devis({ db, persist, notify, log, session }) {
  const [cart, setCart] = useState([]);
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState("");

  const addToCart = (p) => {
    setCart((c) => {
      const existing = c.find((i) => i.productId === p.id);
      if (existing) return c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { productId: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };
  const changeQty = (id, delta) =>
    setCart((c) => c.map((i) => (i.productId === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  const removeItem = (id) => setCart((c) => c.filter((i) => i.productId !== id));
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const saveQuote = () => {
    if (cart.length === 0) return notify("Panier vide");
    const number = "DEV-" + db.nextQuote;
    const quote = { id: uid(), number, date: today(), client: client || "Client comptoir", clientId, items: cart, total, status: "draft" };
    persist({ ...db, quotes: [...db.quotes, quote], nextQuote: db.nextQuote + 1 });
    if (log) log("create_quote", "quotes", quote.id, { number, total });
    setCart([]); setClient(""); setClientId("");
    notify(`Devis ${number} enregistré`);
  };

  const convertToInvoice = (q) => {
    for (const item of q.items) {
      const prod = db.products.find((p) => p.id === item.productId);
      if (!prod || productQty(prod) < item.qty) return notify(`Stock insuffisant pour ${item.name}`);
    }
    let products = [...db.products];
    q.items.forEach((item) => {
      products = adjustStock(products, item.productId, item.variantId, -item.qty);
    });
    const soldBy = session ? session.userName : "—";
    const saleId = uid();
    const sale = { id: saleId, date: today(), items: q.items, total: q.total, discount: 0, client: q.client, clientId: q.clientId, payment: "cash", soldBy };
    const invoiceNumber = "NG-" + db.nextInvoice;
    const invoice = { id: uid(), saleId, number: invoiceNumber, date: today(), client: q.client, clientId: q.clientId, total: q.total, status: "paid", items: q.items, soldBy };
    persist({
      ...db,
      products,
      sales: [...db.sales, sale],
      invoices: [...db.invoices, invoice],
      nextInvoice: db.nextInvoice + 1,
      quotes: db.quotes.map((x) => (x.id === q.id ? { ...x, status: "converted" } : x)),
    });
    if (log) log("convert_quote", "quotes", q.id, { invoiceNumber });
    notify(`Devis converti en facture ${invoiceNumber}`);
  };

  return (
    <div>
      <SectionTitle eyebrow="Avant-vente" title="Devis" />
      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {db.products.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="text-left rounded-xl border p-4" style={{ borderColor: C.border, background: C.paperCard }}>
                <div className="text-sm mb-1" style={{ color: C.ink }}>{p.name}</div>
                <div style={{ ...monoFont, color: C.accent }} className="text-sm">{fmt(p.price)} DHS</div>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-5 h-fit" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouveau devis</div>
          {cart.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Cliquez sur un produit pour l'ajouter.</p>
          ) : (
            <ul className="space-y-3 mb-4">
              {cart.map((i) => (
                <li key={i.productId} className="flex items-center justify-between text-sm gap-2">
                  <span style={{ color: C.ink }} className="flex-1">{i.name}</span>
                  <button onClick={() => changeQty(i.productId, -1)} className="w-5 h-5 border rounded flex items-center justify-center" style={{ borderColor: C.border }}><Minus size={10} /></button>
                  <span style={monoFont}>{i.qty}</span>
                  <button onClick={() => changeQty(i.productId, 1)} className="w-5 h-5 border rounded flex items-center justify-center" style={{ borderColor: C.border }}><Plus size={10} /></button>
                  <button onClick={() => removeItem(i.productId)}><X size={13} color={C.danger} /></button>
                </li>
              ))}
            </ul>
          )}
          <Field label="Client">
            <select className={inputClass} style={{ ...inputStyle, marginBottom: 10 }} value={clientId} onChange={(e) => {
              const c = db.clients.find((x) => x.id === e.target.value);
              setClientId(e.target.value); setClient(c ? c.name : "");
            }}>
              <option value="">Client comptoir</option>
              {db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="flex justify-between items-center my-4 pt-3 border-t" style={{ borderColor: C.border }}>
            <span style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }} className="uppercase">Total</span>
            <span style={{ ...displayFont, color: C.ink }} className="text-2xl">{fmt(total)} DHS</span>
          </div>
          <button onClick={saveQuote} className="w-full py-2.5 rounded-md text-sm text-white flex items-center justify-center gap-2" style={{ background: C.accent }}>
            Enregistrer le devis <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {[...db.quotes].reverse().map((q) => (
          <div key={q.id} className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: C.border, background: C.paperCard }}>
            <div>
              <div style={monoFont} className="text-sm">{q.number}</div>
              <div style={{ color: C.inkSoft }} className="text-xs">{q.client} · {q.date}</div>
            </div>
            <div style={{ ...displayFont, color: C.ink }} className="text-lg">{fmt(q.total)} DHS</div>
            <Stamp status={q.status === "converted" ? "paid" : "pending"} labels={["CONVERTI", "BROUILLON"]} />
            {q.status !== "converted" && (
              <button onClick={() => convertToInvoice(q)} className="text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: C.success, color: C.success }}>
                Convertir en facture
              </button>
            )}
          </div>
        ))}
        {db.quotes.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: C.inkSoft }}>Aucun devis pour l'instant.</div>
        )}
      </div>
    </div>
  );
}

// ---------- Bons de livraison ----------
function Livraison({ db, persist, notify, log }) {
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState("");
  const [items, setItems] = useState([]);
  const [payAmounts, setPayAmounts] = useState({});

  const addToCart = (p) => {
    setItems((c) => {
      const existing = c.find((i) => i.productId === p.id);
      if (existing) return c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { productId: p.id, name: p.name, qty: 1, unitPrice: p.price || 0 }];
    });
  };
  const changeQty = (id, delta) =>
    setItems((c) => c.map((i) => (i.productId === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  const changePrice = (id, val) =>
    setItems((c) => c.map((i) => (i.productId === id ? { ...i, unitPrice: Number(val) || 0 } : i)));
  const removeItem = (id) => setItems((c) => c.filter((i) => i.productId !== id));

  const cartMontant = items.reduce((s, i) => s + i.qty * (i.unitPrice || 0), 0);

  const createBL = () => {
    if (items.length === 0) return notify("Aucun article sélectionné");
    const number = "BL-" + db.nextBL;
    const montant = cartMontant;
    const bl = { id: uid(), number, date: today(), client: client || "Client comptoir", clientId, items, montant, status: "attente" };
    persist({ ...db, deliveryNotes: [...db.deliveryNotes, bl], nextBL: db.nextBL + 1 });
    if (log) log("create_bl", "deliveryNotes", bl.id, { number, montant });
    setItems([]); setClient(""); setClientId("");
    notify(`Colis ${number} créé`);
  };

  // Colis livré : le montant s'ajoute au solde dû du client (paiement selon son mode : semaine / 10j / sur place)
  const markDelivered = (id) => {
    const bl = db.deliveryNotes.find((b) => b.id === id);
    if (!bl) return;
    const clients = bl.clientId
      ? db.clients.map((c) => (c.id === bl.clientId ? { ...c, balanceDue: (c.balanceDue || 0) + (bl.montant || 0) } : c))
      : db.clients;
    persist({ ...db, clients, deliveryNotes: db.deliveryNotes.map((b) => (b.id === id ? { ...b, status: "livre", deliveredAt: today() } : b)) });
    if (log) log("mark_delivered", "deliveryNotes", id, { number: bl.number, montant: bl.montant });
    notify(`${bl.number} marqué livré`);
  };

  // Échec de livraison : le colis revient, le stock est remis automatiquement, aucun montant dû
  const markEchec = (id) => {
    const bl = db.deliveryNotes.find((b) => b.id === id);
    if (!bl) return;
    let products = db.products;
    bl.items.forEach((i) => {
      products = adjustStock(products, i.productId, i.variantId || null, i.qty);
    });
    persist({ ...db, products, deliveryNotes: db.deliveryNotes.map((b) => (b.id === id ? { ...b, status: "echec" } : b)) });
    if (log) log("echec_livraison", "deliveryNotes", id, { number: bl.number });
    notify(`${bl.number} : échec de livraison, colis remis en stock`);
  };

  // Encaissement d'un paiement client (cycle semaine / 10 jours / sur place)
  const encaisser = (c) => {
    const amount = Number(payAmounts[c.id]);
    if (!amount || amount <= 0) return notify("Montant invalide");
    persist({ ...db, clients: db.clients.map((x) => (x.id === c.id ? { ...x, balanceDue: Math.max(0, (x.balanceDue || 0) - amount) } : x)) });
    if (log) log("encaissement_client", "clients", c.id, { name: c.name, amount });
    setPayAmounts((p) => ({ ...p, [c.id]: "" }));
    notify(`Paiement de ${fmt(amount)} DHS encaissé pour ${c.name}`);
  };

  const clientsAvecColis = db.clients.filter((c) => db.deliveryNotes.some((b) => b.clientId === c.id));

  return (
    <div>
      <SectionTitle eyebrow="Logistique" title="Colis & Bons de livraison" />
      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {db.products.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="text-left rounded-xl border p-4" style={{ borderColor: C.border, background: C.paperCard }}>
                <div className="text-sm" style={{ color: C.ink }}>{p.name}</div>
                <div style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }}>{p.sku} · {fmt(p.price)} DHS</div>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-5 h-fit" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouveau colis</div>
          {items.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Cliquez sur un produit pour l'ajouter.</p>
          ) : (
            <ul className="space-y-3 mb-4">
              {items.map((i) => (
                <li key={i.productId} className="flex items-center justify-between text-sm gap-2">
                  <span style={{ color: C.ink }} className="flex-1">{i.name}</span>
                  <button onClick={() => changeQty(i.productId, -1)} className="w-5 h-5 border rounded flex items-center justify-center" style={{ borderColor: C.border }}><Minus size={10} /></button>
                  <span style={monoFont}>{i.qty}</span>
                  <button onClick={() => changeQty(i.productId, 1)} className="w-5 h-5 border rounded flex items-center justify-center" style={{ borderColor: C.border }}><Plus size={10} /></button>
                  <input
                    type="number"
                    value={i.unitPrice}
                    onChange={(e) => changePrice(i.productId, e.target.value)}
                    className="w-16 border rounded px-1 py-0.5 text-xs"
                    style={inputStyle}
                    title="Prix unitaire"
                  />
                  <button onClick={() => removeItem(i.productId)}><X size={13} color={C.danger} /></button>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 && (
            <div className="flex items-center justify-between text-sm mb-4" style={{ color: C.ink }}>
              <span>Montant du colis</span>
              <span style={monoFont}>{fmt(cartMontant)} DHS</span>
            </div>
          )}
          <Field label="Client / destinataire">
            <select className={inputClass} style={{ ...inputStyle, marginBottom: 10 }} value={clientId} onChange={(e) => {
              const c = db.clients.find((x) => x.id === e.target.value);
              setClientId(e.target.value); setClient(c ? c.name : "");
            }}>
              <option value="">Client comptoir</option>
              {db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <button onClick={createBL} className="w-full py-2.5 rounded-md text-sm text-white flex items-center justify-center gap-2" style={{ background: C.accent }}>
            Créer le colis <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Suivi de colis */}
      <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-3">Suivi de colis</div>
      <div className="space-y-3 mb-10">
        {[...db.deliveryNotes].reverse().map((b) => {
          const c = b.clientId ? db.clients.find((x) => x.id === b.clientId) : null;
          return (
            <div key={b.id} className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: C.border, background: C.paperCard }}>
              <div>
                <div style={monoFont} className="text-sm">{b.number}</div>
                <div style={{ color: C.inkSoft }} className="text-xs">
                  {b.client} · {b.date} · {b.items.length} article(s) · {fmt(b.montant || 0)} DHS
                  {c && <> · {PAYMENT_MODE_LABELS[c.paymentMode || "surplace"]}</>}
                </div>
              </div>
              <Stamp
                status={b.status === "livre" ? "paid" : b.status === "echec" ? "returned" : "pending"}
                labels={["LIVRÉ", "EN ATTENTE"]}
              />
              {b.status === "attente" && (
                <div className="flex gap-2">
                  <button onClick={() => markDelivered(b.id)} className="text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: C.success, color: C.success }}>
                    Marquer livré
                  </button>
                  <button onClick={() => markEchec(b.id)} className="text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: C.danger, color: C.danger }}>
                    Échec de livraison
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {db.deliveryNotes.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: C.inkSoft }}>Aucun colis pour l'instant.</div>
        )}
      </div>

      {/* Totaux par client, selon leur mode de paiement */}
      <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-3">Total dû par client</div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Client</td>
              <td className="px-4 py-3">Mode de paiement</td>
              <td className="px-4 py-3">Solde dû</td>
              <td className="px-4 py-3">Encaisser</td>
            </tr>
          </thead>
          <tbody>
            {clientsAvecColis.map((c) => (
              <tr key={c.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={{ color: C.ink }}>{c.name}</td>
                <td className="px-4 py-3 text-xs" style={{ color: C.inkSoft }}>{PAYMENT_MODE_LABELS[c.paymentMode || "surplace"]}</td>
                <td className="px-4 py-3" style={{ ...monoFont, color: (c.balanceDue || 0) > 0 ? C.danger : C.success }}>{fmt(c.balanceDue || 0)} DHS</td>
                <td className="px-4 py-3">
                  {(c.balanceDue || 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="Montant"
                        value={payAmounts[c.id] || ""}
                        onChange={(e) => setPayAmounts((p) => ({ ...p, [c.id]: e.target.value }))}
                        className="w-24 border rounded px-2 py-1 text-xs"
                        style={inputStyle}
                      />
                      <button onClick={() => encaisser(c)} className="text-xs px-2 py-1 rounded-md border" style={{ borderColor: C.accent, color: C.accent }}>
                        OK
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {clientsAvecColis.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun client avec des colis pour l'instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Équipe ----------
function Equipe({ session, notify, log }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setProfiles(await sbFetchAllProfiles(session));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (p, role) => {
    if (p.id === session.userId && role !== "admin") {
      return notify("Vous ne pouvez pas retirer votre propre accès admin");
    }
    const ok = await sbUpdateRole(session, p.id, role);
    if (ok) {
      notify(`${p.full_name} est maintenant ${role === "admin" ? "Admin" : "Vendeur"}`);
      if (log) log("update_role", "profiles", p.id, { name: p.full_name, role });
      load();
    } else {
      notify("Échec de la mise à jour");
    }
  };

  return (
    <div>
      <SectionTitle eyebrow="Sécurité" title="Équipe" />
      <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Nom</td><td className="px-4 py-3">Rôle</td><td className="px-4 py-3">Membre depuis</td>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={{ color: C.ink }}>{p.full_name}</td>
                <td className="px-4 py-3">
                  <select
                    className={inputClass}
                    style={{ ...inputStyle, width: 140 }}
                    value={p.role}
                    onChange={(e) => changeRole(p, e.target.value)}
                  >
                    <option value="vendeur">Vendeur</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3" style={{ ...monoFont, color: C.inkSoft }}>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR") : "—"}
                </td>
              </tr>
            ))}
            {!loading && profiles.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun membre trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-2">Ajouter un membre</div>
        <p className="text-sm" style={{ color: C.inkSoft }}>
          Pour des raisons de sécurité, la création de nouveaux comptes se fait depuis Supabase :
          Authentication → Users → Add user. Le nouveau membre reçoit automatiquement le rôle "Vendeur",
          que vous pouvez changer ici ensuite.
        </p>
      </div>
    </div>
  );
}

// ---------- Charges ----------
function Charges({ db, persist, notify, log }) {
  const [form, setForm] = useState({ label: "", category: "Loyer", amount: "", date: today() });

  const categories = ["Loyer", "Électricité / Eau", "Salaires", "Transport", "Marketing", "Internet / Téléphone", "Autre"];

  const addCharge = () => {
    if (!form.label || !form.amount) return notify("Description et montant requis");
    const charge = { id: uid(), date: form.date, label: form.label, category: form.category, amount: Number(form.amount) };
    persist({ ...db, charges: [...(db.charges || []), charge] });
    if (log) log("create_charge", "charges", charge.id, { label: charge.label, amount: charge.amount });
    setForm({ label: "", category: "Loyer", amount: "", date: today() });
    notify("Charge enregistrée");
  };

  const removeCharge = (id) => {
    const c = (db.charges || []).find((x) => x.id === id);
    const prevDb = db;
    persist({ ...db, charges: db.charges.filter((c) => c.id !== id) });
    if (log && c) log("delete_charge", "charges", id, { label: c.label });
    if (c) notify(`Charge "${c.label}" supprimée`, () => persist(prevDb));
  };

  const total = (db.charges || []).reduce((s, c) => s + c.amount, 0);
  const byCategory = useMemo(() => {
    const map = {};
    (db.charges || []).forEach((c) => { map[c.category] = (map[c.category] || 0) + c.amount; });
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [db.charges]);

  return (
    <div>
      <SectionTitle
        eyebrow="Dépenses"
        title="Charges"
        action={
          <div className="text-right">
            <div style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest">Total des charges</div>
            <div style={{ ...displayFont, color: C.danger }} className="text-xl">{fmt(total)} DHS</div>
          </div>
        }
      />

      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouvelle charge</div>
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Description">
            <input className={inputClass} style={inputStyle} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex. Loyer du mois" />
          </Field>
          <Field label="Catégorie">
            <select className={inputClass} style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Montant (DHS)">
            <input type="number" className={inputClass} style={inputStyle} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Date">
            <input type="date" className={inputClass} style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        </div>
        <button onClick={addCharge} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <Plus size={14} /> Ajouter la charge
        </button>
      </div>

      {byCategory.length > 0 && (
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {byCategory.map((c) => (
            <div key={c.name} className="rounded-md border p-3" style={{ borderColor: C.border, background: C.paperCard }}>
              <div style={{ color: C.inkSoft }} className="text-xs mb-1">{c.name}</div>
              <div style={{ ...displayFont, color: C.ink }} className="text-lg">{fmt(c.total)} DHS</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.paperCard }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Date</td><td className="px-4 py-3">Description</td><td className="px-4 py-3">Catégorie</td>
              <td className="px-4 py-3">Montant</td><td className="px-4 py-3"></td>
            </tr>
          </thead>
          <tbody>
            {[...(db.charges || [])].reverse().map((c) => (
              <tr key={c.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={monoFont}>{c.date}</td>
                <td className="px-4 py-3" style={{ color: C.ink }}>{c.label}</td>
                <td className="px-4 py-3" style={{ color: C.inkSoft }}>{c.category}</td>
                <td className="px-4 py-3" style={monoFont}>{fmt(c.amount)} DHS</td>
                <td className="px-4 py-3 text-right"><button onClick={() => removeCharge(c.id)}><Trash2 size={14} color={C.danger} /></button></td>
              </tr>
            ))}
            {(!db.charges || db.charges.length === 0) && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucune charge enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Finance / Comptabilité ----------
function Finance({ db, persist, notify, log, session }) {
  const [capitalInput, setCapitalInput] = useState(String(db.capital || 0));
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [company, setCompany] = useState(db.company || { name: "", ice: "", rc: "", patente: "", address: "", phone: "", tvaRate: 20 });

  const saveCompany = () => {
    persist({ ...db, company });
    if (log) log("update_company", "settings", "company", {});
    notify("Informations de l'entreprise mises à jour");
  };

  useEffect(() => {
    (async () => {
      const list = await sbListBackups(session);
      setBackups(list);
      setBackupsLoading(false);
    })();
  }, []);

  const backupNow = async () => {
    await sbSaveBackup(session, db);
    notify("Sauvegarde cloud effectuée");
    setBackups(await sbListBackups(session));
  };

  const restore = async (date) => {
    if (!confirm(`Restaurer les données du ${date} ? Ceci remplacera les données actuelles.`)) return;
    const data = await sbRestoreBackup(session, date);
    if (!data) return notify("Sauvegarde introuvable");
    persist(data);
    if (log) log("restore_backup", "backups", date, {});
    notify(`Données restaurées depuis le ${date}`);
  };

  const saveCapital = () => {
    const amount = Number(capitalInput) || 0;
    persist({ ...db, capital: amount });
    if (log) log("update_capital", "settings", "capital", { amount });
    notify("Capital initial mis à jour");
  };

  const totalRevenue = db.sales.filter((x) => !x.returned).reduce((s, x) => s + x.total, 0);
  const totalCosts = db.purchases.reduce((s, x) => s + x.total, 0);
  const totalCharges = (db.charges || []).reduce((s, x) => s + x.amount, 0);
  const stockValue = db.products.reduce((s, p) => s + p.price * productQty(p), 0); // valeur au prix de vente
  const stockValueAtCost = db.products.reduce((s, p) => s + (p.costPrice || 0) * productQty(p), 0); // valeur au coût d'achat
  const cashProfit = totalRevenue - totalCosts - totalCharges; // bénéfice réel : ventes moins achats moins charges (loyer, salaires...)
  const currentCapital = (db.capital || 0) + cashProfit + stockValueAtCost; // patrimoine total : capital de départ + bénéfice encaissé + valeur de la marchandise encore en stock (au coût)

  // group by year
  const years = useMemo(() => {
    const map = {};
    db.sales.filter((s) => !s.returned).forEach((s) => {
      const y = s.date.slice(0, 4);
      map[y] = map[y] || { revenue: 0, costs: 0 };
      map[y].revenue += s.total;
    });
    db.purchases.forEach((p) => {
      const y = p.date.slice(0, 4);
      map[y] = map[y] || { revenue: 0, costs: 0 };
      map[y].costs += p.total;
    });
    return Object.entries(map)
      .map(([year, v]) => ({ year, ...v, profit: v.revenue - v.costs }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [db.sales, db.purchases]);

  return (
    <div>
      <SectionTitle eyebrow="Finances" title="Comptabilité & capital" />

      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4 flex items-center gap-2">
          <Settings size={14} /> Informations de l'entreprise (facture)
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Nom de l'entreprise">
            <input className={inputClass} style={inputStyle} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
          </Field>
          <Field label="ICE">
            <input className={inputClass} style={inputStyle} value={company.ice} onChange={(e) => setCompany({ ...company, ice: e.target.value })} />
          </Field>
          <Field label="RC">
            <input className={inputClass} style={inputStyle} value={company.rc} onChange={(e) => setCompany({ ...company, rc: e.target.value })} />
          </Field>
          <Field label="Patente">
            <input className={inputClass} style={inputStyle} value={company.patente} onChange={(e) => setCompany({ ...company, patente: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <input className={inputClass} style={inputStyle} value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
          </Field>
          <Field label="Taux de TVA (%)">
            <input type="number" className={inputClass} style={inputStyle} value={company.tvaRate} onChange={(e) => setCompany({ ...company, tvaRate: Number(e.target.value) })} />
          </Field>
          <Field label="Adresse">
            <input className={inputClass} style={inputStyle} value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
          </Field>
        </div>
        <button onClick={saveCompany} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <Save size={14} /> Enregistrer
        </button>
        <p className="text-xs mt-3" style={{ color: C.inkSoft }}>
          Ces informations apparaissent sur les factures imprimées. Mettez 0 dans "Taux de TVA" si vous ne facturez pas la TVA.
        </p>
      </div>

      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">
          Capital initial
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="Montant (DHS)">
            <input
              type="number"
              className={inputClass}
              style={{ ...inputStyle, width: 220 }}
              value={capitalInput}
              onChange={(e) => setCapitalInput(e.target.value)}
            />
          </Field>
          <button onClick={saveCapital} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
            <Save size={14} /> Enregistrer
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: C.inkSoft }}>
          Le montant que vous avez investi au départ pour lancer l'activité.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
        <StatCard label="Capital initial" value={fmt(db.capital || 0) + " DHS"} icon={Wallet} />
        <StatCard label="Charges" value={fmt(totalCharges) + " DHS"} icon={Receipt} tone={totalCharges > 0 ? "danger" : "default"} />
        <StatCard label="Bénéfice net (après charges)" value={fmt(cashProfit) + " DHS"} icon={TrendingUp} tone={cashProfit >= 0 ? "success" : "danger"} />
        <StatCard label="Stock (au coût)" value={fmt(stockValueAtCost) + " DHS"} icon={Boxes} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatCard label="Capital actuel (patrimoine total)" value={fmt(currentCapital) + " DHS"} icon={PiggyBank} tone="success" />
        <StatCard label="Stock (valeur de revente)" value={fmt(stockValue) + " DHS"} icon={Boxes} />
      </div>
      <p className="text-xs -mt-5 mb-8" style={{ color: C.inkSoft }}>
        Bénéfice net = Ventes − Achats − Charges (loyer, salaires, etc.). Capital actuel = Capital initial + Bénéfice net + Valeur du stock encore en magasin (au coût d'achat).
      </p>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-1">Créances clients (à recevoir)</div>
          <div style={{ ...displayFont, color: C.success }} className="text-2xl">{fmt(db.clients.reduce((s, c) => s + (c.balanceDue || 0), 0))} DHS</div>
          <p className="text-xs mt-1" style={{ color: C.inkSoft }}>Argent que vos clients vous doivent (ventes à crédit).</p>
        </div>
        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-1">Dettes fournisseurs (à payer)</div>
          <div style={{ ...displayFont, color: C.danger }} className="text-2xl">{fmt(db.suppliers.reduce((s, x) => s + (x.balanceDue || 0), 0))} DHS</div>
          <p className="text-xs mt-1" style={{ color: C.inkSoft }}>Argent que vous devez à vos fournisseurs (achats à crédit).</p>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: C.border, background: C.paperCard }}>
        <div className="px-4 py-3 border-b" style={{ ...monoFont, fontSize: 11, color: C.inkSoft, borderColor: C.border }} >
          BILAN ANNUEL
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Année</td>
              <td className="px-4 py-3">Chiffre d'affaires</td>
              <td className="px-4 py-3">Achats / coûts</td>
              <td className="px-4 py-3">Bénéfice</td>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={displayFont}>{y.year}</td>
                <td className="px-4 py-3" style={monoFont}>{fmt(y.revenue)} DHS</td>
                <td className="px-4 py-3" style={monoFont}>{fmt(y.costs)} DHS</td>
                <td className="px-4 py-3" style={{ ...monoFont, color: y.profit >= 0 ? C.success : C.danger }}>
                  {fmt(y.profit)} DHS
                </td>
              </tr>
            ))}
            {years.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>
                Aucune donnée pour l'instant — enregistrez des ventes ou des achats.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs mb-8" style={{ color: C.inkSoft }}>
        Bénéfice = chiffre d'affaires des ventes − coûts des achats, pour chaque année. Le capital actuel additionne le capital initial et le bénéfice net cumulé sur toute la période.
      </p>

      <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: C.paperCard }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Sauvegarde des données</div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={backupNow}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border"
            style={{ borderColor: C.success, color: C.success }}
          >
            <Save size={14} /> Sauvegarder sur le cloud maintenant
          </button>
        </div>
        <p className="text-xs mt-3 mb-6" style={{ color: C.inkSoft }}>
          Une sauvegarde automatique vers Supabase se fait à chaque modification et à chaque connexion — une ligne par jour, toujours à jour.
        </p>

        <div className="mb-6">
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-3">Historique des sauvegardes cloud</div>
          {backupsLoading ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Chargement…</p>
          ) : backups.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Aucune sauvegarde cloud pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {backups.map((b) => (
                <li key={b.backup_date} className="flex items-center justify-between text-sm border rounded-md px-3 py-2" style={{ borderColor: C.border }}>
                  <span style={monoFont}>{b.backup_date}</span>
                  <span style={{ color: C.inkSoft }} className="text-xs">par {b.updated_by || "—"}</span>
                  <button onClick={() => restore(b.backup_date)} className="text-xs px-3 py-1 rounded-md border" style={{ borderColor: C.accent, color: C.accent }}>
                    Restaurer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Sauvegarde manuelle (fichier)</div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `negoce-sauvegarde-${today()}.json`; a.click();
              URL.revokeObjectURL(url);
              notify("Sauvegarde téléchargée");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border"
            style={{ borderColor: C.border, color: C.ink }}
          >
            <Download size={14} /> Exporter (JSON)
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border cursor-pointer" style={{ borderColor: C.border, color: C.ink }}>
            <Upload size={14} /> Importer
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const imported = JSON.parse(evt.target.result);
                    persist({ ...DEFAULT_DB, ...imported });
                    notify("Données importées avec succès");
                  } catch {
                    notify("Fichier invalide");
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
          </label>

          <button
            onClick={() => {
              const ws = XLSX.utils.json_to_sheet(db.products.map((p) => ({
                Produit: p.name,
                SKU: p.sku,
                "Code-barres": p.barcode || "",
                Catégorie: p.category,
                "Coût d'achat": p.costPrice || 0,
                "Prix de vente": p.price,
                "Marge (DHS)": p.price - (p.costPrice || 0),
                "Marge (%)": p.price ? Math.round(((p.price - (p.costPrice || 0)) / p.price) * 100) : 0,
                Quantité: p.qty,
                "Seuil min.": p.minQty,
                "Valeur stock (coût)": (p.costPrice || 0) * p.qty,
                "Valeur stock (vente)": p.price * p.qty,
                Statut: p.qty <= 0 ? "Rupture" : p.qty <= p.minQty ? "Stock bas" : "OK",
              })));
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Stock");
              XLSX.writeFile(wb, `stock-complet-${today()}.xlsx`);
              notify("Export Excel téléchargé");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border"
            style={{ borderColor: C.border, color: C.ink }}
          >
            <Download size={14} /> Stock (Excel)
          </button>

          <button
            onClick={() => {
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.products.map((p) => ({
                Produit: p.name,
                SKU: p.sku,
                "Code-barres": p.barcode || "",
                Catégorie: p.category,
                "Coût d'achat": p.costPrice || 0,
                "Prix de vente": p.price,
                "Marge (DHS)": p.price - (p.costPrice || 0),
                "Marge (%)": p.price ? Math.round(((p.price - (p.costPrice || 0)) / p.price) * 100) : 0,
                Quantité: p.qty,
                "Seuil min.": p.minQty,
                "Valeur stock (coût)": (p.costPrice || 0) * p.qty,
                "Valeur stock (vente)": p.price * p.qty,
                Statut: p.qty <= 0 ? "Rupture" : p.qty <= p.minQty ? "Stock bas" : "OK",
              }))), "Stock");
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.purchases.map((p) => ({
                Date: p.date, Produit: p.productName, Fournisseur: p.supplier, Quantité: p.qty, "Coût unitaire": p.unitCost, Total: p.total,
              }))), "Achats");
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.sales.map((s) => ({
                Date: s.date, Client: s.client, Total: s.total, Remise: s.discount || 0, Paiement: s.payment,
              }))), "Ventes");
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.invoices.map((i) => ({
                Numéro: i.number, Date: i.date, Client: i.client, Total: i.total, Statut: i.status === "paid" ? "Payé" : "En attente",
              }))), "Factures");
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.clients.map((c) => ({
                Client: c.name, Téléphone: c.phone, "Solde dû": c.balanceDue || 0,
              }))), "Clients");
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.suppliers.map((s) => ({
                Fournisseur: s.name, Téléphone: s.phone,
              }))), "Fournisseurs");
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.cheques.map((c) => ({
                Type: c.type === "received" ? "Reçu" : "Émis", Numéro: c.number, Banque: c.bank,
                Partie: c.party, Montant: c.amount, Échéance: c.dueDate, Statut: c.status === "cashed" ? "Encaissé" : "En attente",
              }))), "Chèques");
              XLSX.writeFile(wb, `negoce-sauvegarde-complete-${today()}.xlsx`);
              notify("Sauvegarde complète (Excel) téléchargée");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white"
            style={{ background: C.accent }}
          >
            <Download size={14} /> Sauvegarde complète (Excel, toutes les feuilles)
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: C.inkSoft }}>
          Exportez régulièrement une sauvegarde JSON pour ne jamais perdre vos données.
        </p>
      </div>
    </div>
  );
}
