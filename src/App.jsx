import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, PackagePlus, ShoppingCart, Boxes, Receipt,
  Plus, Trash2, X, Search, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, Minus, ChevronRight, Wallet, PiggyBank, Save,
  Users, Truck, Landmark, Download, Upload, Phone, LogOut, ShieldCheck, Lock, Printer,
  FileText, ClipboardList, UserCog, Barcode, BarChart3, Receipt as Receipt2, RotateCcw, Settings, Pencil, Layers,
  Image as ImageIcon, Camera, Sun, Moon, MessageCircle, TrendingDown, AlertCircle, ClipboardCheck, Calculator, QrCode, Sunrise, Bell, Globe, Star, Tag, Check, Filter
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// ---- Design tokens : identité Electrolik Premium ----
const LIGHT_THEME = {
  ink: "#0F172A",
  inkSoft: "#64748B",
  paper: "#F8FAFC",
  paperCard: "#FFFFFF",
  sidebar: "#090D16",
  sidebarAlt: "#131B2E",
  sidebarText: "#94A3B8",
  accent: "#F2B705",
  accentSoft: "#FEF9C3",
  success: "#10B981",
  successSoft: "#D1FAE5",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  border: "#E2E8F0",
};
const DARK_THEME = {
  ink: "#F8FAFC",
  inkSoft: "#94A3B8",
  paper: "#090D16",
  paperCard: "#111827",
  sidebar: "#040711",
  sidebarAlt: "#0E1526",
  sidebarText: "#94A3B8",
  accent: "#F2B705",
  accentSoft: "#362B0A",
  success: "#10B981",
  successSoft: "#064E3B",
  danger: "#EF4444",
  dangerSoft: "#450A0A",
  border: "#1E293B",
};

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
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);

    if (document.getElementById("electrolik-global-style")) return;
    const style = document.createElement("style");
    style.id = "electrolik-global-style";
    style.textContent = `
      * { box-sizing: border-box; }
      body { -webkit-font-smoothing: antialiased; }
      ::selection { background: ${C.accent}; color: #000; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #94A3B840; border-radius: 99px; }
      ::-webkit-scrollbar-thumb:hover { background: #94A3B880; }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      button, input, select, textarea { transition: all 0.15s ease; }
      button:active { transform: scale(0.98); }
      .card-modern {
        background: ${C.paperCard};
        border: 1px solid ${C.border};
        border-radius: 16px;
        box-shadow: 0 4px 20px -4px rgba(0,0,0,0.03);
      }
    `;
    document.head.appendChild(style);
  }, []);
}

function uidBarcode() {
  let code = "200";
  for (let i = 0; i < 9; i++) code += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return code + check;
}

const uid = () => Math.random().toString(36).slice(2, 10);

function productQty(p) {
  return p.variants && p.variants.length > 0
    ? p.variants.reduce((s, v) => s + (v.qty || 0), 0)
    : p.qty || 0;
}
function variantLabel(v) {
  return [v.color, v.size, v.length].filter(Boolean).join(" / ");
}
function findByCode(products, code) {
  const norm = (s) => String(s || "").trim().toLowerCase();
  const raw = norm(code);
  if (!raw) return null;
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  const candidates = [raw, "0" + raw, raw.replace(/^0/, ""), digitsOnly, "0" + digitsOnly, digitsOnly.replace(/^0/, "")];
  for (const target of candidates) {
    if (!target) continue;
    for (const p of products) {
      if (norm(p.barcode) === target || norm(p.sku) === target) return { product: p, variant: null };
      if (p.variants) {
        const v = p.variants.find((x) => norm(x.barcode) === target || norm(x.sku) === target);
        if (v) return { product: p, variant: v };
      }
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
  return data;
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function sbSaveBackup(session, db) {
  if (!session) return { ok: false, error: "no-session" };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/backups?on_conflict=backup_date`, {
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
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: errText || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
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
      `${SUPABASE_URL}/rest/v1/backups?select=data,backup_date,updated_at&order=updated_at.desc&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows && rows[0] ? { data: rows[0].data, updatedAt: rows[0].updated_at } : null;
  } catch (e) {
    return null;
  }
}

async function sbSyncPublicProducts(session, products, sales, onlineOrders) {
  const soldQty = {};
  (sales || []).forEach((s) => {
    if (s.returned) return;
    (s.items || []).forEach((i) => {
      soldQty[i.productId] = (soldQty[i.productId] || 0) + i.qty;
    });
  });
  const reservedQty = {};
  (onlineOrders || []).forEach((o) => {
    if (o.status === "annulee" || o.status === "expediee") return;
    (o.items || []).forEach((i) => {
      reservedQty[i.product_id] = (reservedQty[i.product_id] || 0) + i.qty;
    });
  });
  const rows = (products || [])
    .filter((p) => p.publishedOnline)
    .map((p) => {
      const available = Math.max(0, productQty(p) - (reservedQty[p.id] || 0));
      return {
        id: p.id,
        name: p.name,
        category: p.category || "",
        price: p.price || 0,
        image_url: p.image || (p.images && p.images[0]) || "",
        images: p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : [],
        in_stock: available > 0,
        available_qty: available,
        sales_count: soldQty[p.id] || 0,
        updated_at: new Date().toISOString(),
      };
    });
  if (rows.length === 0) return { ok: true };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/public_products?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function sbFetchOnlineOrders(session) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/online_orders?select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function sbUpdateOrderStatus(session, orderId, status) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/online_orders?id=eq.${orderId}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status }),
    });
  } catch (e) {}
}

async function sbFetchAllReviews(session) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/product_reviews?select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function sbDeleteReview(session, reviewId) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/product_reviews?id=eq.${reviewId}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` },
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function sbFetchPromoCodes(session) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function sbCreatePromoCode(session, promo) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(promo),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function sbUpdatePromoCode(session, id, patch) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    });
  } catch (e) {}
}

const DEFAULT_DB = {
  products: [
    { id: uid(), name: "Casque Gaming Pro RGB", sku: "CAS-001", barcode: uidBarcode(), category: "Audio", price: 290, costPrice: 180, qty: 14, minQty: 4 },
    { id: uid(), name: "Clavier Mécanique RGB", sku: "CLAV-002", barcode: uidBarcode(), category: "Périphérique", price: 380, costPrice: 240, qty: 8, minQty: 3 },
    { id: uid(), name: "Ventilateur Téléphone Gaming", sku: "VENT-003", barcode: uidBarcode(), category: "Mobile", price: 120, costPrice: 70, qty: 25, minQty: 6 },
  ],
  purchases: [],
  sales: [],
  invoices: [],
  nextInvoice: 1001,
  capital: 0,
  clients: [],
  clientPayments: [],
  inventories: [],
  marketplaceSettings: { commissionRate: 15.73, serviceFee: 180 },
  supplierReturns: [],
  cashRegister: [],
  suppliers: [],
  supplierPayments: [],
  openingDebts: [],
  cheques: [],
  quotes: [],
  nextQuote: 1,
  deliveryNotes: [],
  nextBL: 1,
  company: { name: "Electrolik", ice: "", rc: "", patente: "", address: "", phone: "", tvaRate: 20, monthlyTarget: 0 },
  charges: [],
  recurringCharges: [],
  returns: [],
};

// ==========================================
// CAMERA SCANNER OPTIMISÉ POUR SMARTPHONE
// ==========================================
function CameraScanner({ onDetected, onClose }) {
  const containerId = useRef("scanner-" + Math.random().toString(36).substring(2, 9)).current;
  const scannerRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const html5QrCode = new Html5Qrcode(containerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    });
    scannerRef.current = html5QrCode;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 160 }, // Fixed size stable
      aspectRatio: 1.0,
      videoConstraints: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 }, // 720p limit anti-freeze
        height: { ideal: 720 }
      }
    };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        if (!isMounted) return;
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
          onDetected(decodedText.trim());
        }).catch(() => {
          onDetected(decodedText.trim());
        });
      },
      () => {}
    ).then(() => {
      if (isMounted) setReady(true);
    }).catch((err) => {
      if (isMounted) {
        setError("Impossible d'activer la caméra. Vérifiez vos permissions de navigateur.");
      }
    });

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
        } else {
          scannerRef.current.clear();
        }
      }
    };
  }, [containerId, onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(9, 13, 22, 0.8)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-3xl p-6 border shadow-2xl" style={{ background: C.paperCard, borderColor: C.border }}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest font-semibold">
            Scanner Code-barres
          </span>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-500/10">
            <X size={18} color={C.inkSoft} />
          </button>
        </div>

        {error ? (
          <div className="text-center py-6">
            <AlertCircle size={32} className="mx-auto mb-2 text-rose-500" />
            <p className="text-sm mb-4" style={{ color: C.danger }}>{error}</p>
            <button onClick={onClose} className="px-5 py-2 text-xs rounded-xl border font-medium" style={{ borderColor: C.border, color: C.ink }}>
              Fermer
            </button>
          </div>
        ) : (
          <div>
            {!ready && (
              <div className="py-14 text-center text-sm" style={{ color: C.inkSoft }}>
                <RotateCcw size={22} className="animate-spin mx-auto mb-3 text-[#F2B705]" />
                Connexion à la caméra...
              </div>
            )}
            <div 
              id={containerId} 
              className="overflow-hidden rounded-2xl bg-black shadow-inner"
              style={{ width: "100%", minHeight: ready ? "240px" : "0", display: ready ? "block" : "none" }}
            />
            <p className="text-xs text-center mt-4" style={{ color: C.inkSoft }}>
              Pointez la caméra vers le code-barres du produit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// COMPOSANTS UI MODERNES
// ==========================================
function StatCard({ label, value, icon: Icon, tone = "default" }) {
  const isDanger = tone === "danger";
  const isSuccess = tone === "success";

  const iconBg = isDanger
    ? "bg-rose-500/10 text-rose-500"
    : isSuccess
    ? "bg-emerald-500/10 text-emerald-500"
    : "bg-amber-500/10 text-amber-500";

  return (
    <div
      className="card-modern relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
      style={{ background: C.paperCard, borderColor: C.border }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }} className="uppercase tracking-wider font-medium">
          {label}
        </span>
        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${iconBg}`}>
          <Icon size={18} />
        </div>
      </div>
      <div style={{ ...displayFont, color: C.ink }} className="text-2xl font-bold tracking-tight">
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
      <div>
        <div style={{ ...monoFont, color: C.accent, fontSize: 11 }} className="uppercase tracking-widest font-semibold mb-1">
          {eyebrow}
        </div>
        <h1 style={{ ...displayFont, color: C.ink }} className="text-3xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span style={{ ...monoFont, color: C.inkSoft, fontSize: 10 }} className="uppercase tracking-wider font-semibold block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
const inputStyle = { borderColor: C.border, color: C.ink, background: C.paperCard };
const inputClass = "w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F2B705]/20 focus:border-[#F2B705]";

function Stamp({ status, labels }) {
  const paid = status === "paid";
  const returned = status === "returned";
  const color = returned ? C.inkSoft : paid ? C.success : C.danger;
  const text = returned ? "RETOURNÉ" : labels ? (paid ? labels[0] : labels[1]) : paid ? "PAYÉ" : "EN ATTENTE";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase border"
      style={{ ...monoFont, color, borderColor: color + "40", background: color + "10" }}
    >
      {returned ? <RotateCcw size={11} /> : paid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
      {text}
    </span>
  );
}

// ==========================================
// APPLICATION PRINCIPALE
// ==========================================
export default function App() {
  useGoogleFonts();
  const [db, setDb] = useState(DEFAULT_DB);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ek-theme") : null;
    return saved || "light";
  });
  applyTheme(theme);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("ek-theme", next); } catch (e) {}
  };

  const [searchOpen, setSearchOpen] = useState(false);
  const [deepLinkClientId, setDeepLinkClientId] = useState(null);
  const [deepLinkQuery, setDeepLinkQuery] = useState("");
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem("ek-notif-enabled") === "1");
  const [locked, setLocked] = useState(false);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState(false);
  const [newOrdersBadge, setNewOrdersBadge] = useState(0);

  const getLockPin = () => {
    try { return localStorage.getItem("ek-lock-pin") || ""; } catch (e) { return ""; }
  };
  const tryUnlock = () => {
    if (unlockInput === getLockPin()) {
      setLocked(false);
      setUnlockInput("");
      setUnlockError(false);
    } else {
      setUnlockError(true);
      setUnlockInput("");
    }
  };

  const toggleNotifications = async () => {
    if (!("Notification" in window)) return;
    if (!notifEnabled) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotifEnabled(true);
        localStorage.setItem("ek-notif-enabled", "1");
        new Notification("Electrolik Gestion Pro", { body: "Notifications activées ✅" });
      }
    } else {
      setNotifEnabled(false);
      localStorage.setItem("ek-notif-enabled", "0");
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setDb(JSON.parse(raw)); } catch (e) {}
    }
    setLoading(false);
  }, []);

  const lastKnownTimestampRef = useRef(null);
  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);

  const [syncStatus, setSyncStatus] = useState("synced");
  const syncingRef = useRef(false);
  const latestDbRef = useRef(db);

  const attemptSync = async (attempt = 0) => {
    if (!session || syncingRef.current) return;
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return;
    }
    syncingRef.current = true;
    setSyncStatus("syncing");
    const next = latestDbRef.current;
    const [backupResult] = await Promise.all([
      sbSaveBackup(session, next),
      sbSyncPublicProducts(session, next.products, next.sales),
    ]);
    syncingRef.current = false;

    if (backupResult.ok) {
      if (latestDbRef.current === next) {
        try { localStorage.removeItem("ek-sync-pending"); } catch (e) {}
        setSyncStatus("synced");
      } else {
        attemptSync();
      }
    } else {
      setSyncStatus(navigator.onLine ? "error" : "offline");
      const delay = Math.min(30000, 2000 * Math.pow(2, attempt));
      setTimeout(() => attemptSync(attempt + 1), delay);
    }
  };

  const persist = async (next) => {
    setDb(next);
    latestDbRef.current = next;
    lastKnownTimestampRef.current = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {}
    if (session) {
      try { localStorage.setItem("ek-sync-pending", "1"); } catch (e) {}
      attemptSync();
    }
  };

  const notify = (msg, undo) => {
    setToast({ msg, undo });
    setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), undo ? 6000 : 2500);
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
    const cloudBackup = await sbLoadLatestBackup(s);
    if (cloudBackup) {
      setDb(cloudBackup.data);
      lastKnownTimestampRef.current = cloudBackup.updatedAt;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudBackup.data)); } catch (e) {}
    }
  };

  useEffect(() => {
    if (!session) return;
    const t = setInterval(async () => {
      const result = await sbLoadLatestBackup(session);
      if (result && (!lastKnownTimestampRef.current || result.updatedAt > lastKnownTimestampRef.current)) {
        setDb(result.data);
        lastKnownTimestampRef.current = result.updatedAt;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data)); } catch (e) {}
      }
    }, 20000);
    return () => clearInterval(t);
  }, [session]);

  const nav = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "aujourdhui", label: "Aujourd'hui", icon: Sunrise },
    { id: "rapports", label: "Rapports", icon: BarChart3 },
    { id: "devis", label: "Devis", icon: FileText },
    { id: "achats", label: "Achats", icon: PackagePlus },
    { id: "ventes", label: "Ventes / PDV", icon: ShoppingCart },
    { id: "livraison", label: "Colis & Livraison", icon: ClipboardList },
    { id: "stock", label: "Stock", icon: Boxes },
    { id: "inventaire", label: "Inventaire", icon: ClipboardCheck },
    { id: "caisse", label: "Caisse", icon: Wallet },
    { id: "commandes", label: "Commandes en ligne", icon: Globe },
    { id: "avis", label: "Avis clients", icon: Star },
    { id: "promos", label: "Codes promo", icon: Tag },
    { id: "calculateur", label: "Calculateur marketplace", icon: Calculator },
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
        <div className="flex flex-col items-center gap-3">
          <RotateCcw size={28} className="animate-spin text-[#F2B705]" />
          <span style={{ ...monoFont, color: C.inkSoft }} className="text-xs uppercase tracking-widest">
            Chargement de l'application...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh", ...bodyFont }} className="flex flex-col md:flex-row antialiased">
      {/* Sidebar Moderne SaaS */}
      <aside
        style={{ background: "#090D16", borderColor: "rgba(255,255,255,0.06)" }}
        className="md:w-64 w-full flex md:flex-col shrink-0 border-r select-none z-30"
      >
        <div className="p-5 hidden md:block">
          <div className="flex items-center gap-3 mb-1">
            <img src="/logo.png" alt="Electrolik" className="h-7 w-auto object-contain" />
            <div>
              <div className="text-xs font-bold text-white tracking-wide" style={displayFont}>ELECTROLIK</div>
              <div style={{ ...monoFont, color: "#64748B", fontSize: 9 }} className="tracking-widest uppercase">
                Gestion Pro
              </div>
            </div>
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            className="mt-5 w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all border border-white/5 hover:border-white/15 bg-white/[0.03] text-gray-400 hover:text-white"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Recherche globale...</span>
            <kbd style={{ ...monoFont, fontSize: 9 }} className="px-1.5 py-0.5 rounded bg-white/10 text-gray-300">⌘K</kbd>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex md:flex-col flex-1 p-2 md:px-3 md:pb-4 gap-1 overflow-x-auto no-scrollbar">
          {nav.map((n, i) => {
            const active = tab === n.id;
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  active
                    ? "bg-[#F2B705]/15 text-[#F2B705] shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                <Icon size={16} className={active ? "text-[#F2B705]" : "text-slate-400"} />
                <span className="flex-1 text-left tracking-wide">{n.label}</span>

                {n.id === "commandes" && newOrdersBadge > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center justify-center animate-pulse"
                    style={{ background: C.danger, color: "#fff", ...monoFont }}
                  >
                    {newOrdersBadge}
                  </span>
                )}
                {active && (
                  <span className="absolute right-0 w-1 h-4 rounded-l-full bg-[#F2B705] hidden md:block" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer & Compte */}
        <div className="p-3 md:p-4 border-t border-white/5 hidden md:block">
          <div className="flex items-center gap-2 mb-3 px-1 text-[11px] text-slate-400">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${syncStatus === "syncing" ? "animate-ping" : ""}`}
              style={{
                background:
                  syncStatus === "synced" ? C.success :
                  syncStatus === "syncing" ? C.accent :
                  syncStatus === "offline" ? C.inkSoft : C.danger,
              }}
            />
            <span className="truncate">
              {syncStatus === "synced" && "Synchronisé"}
              {syncStatus === "syncing" && "Synchronisation..."}
              {syncStatus === "pending" && "En attente..."}
              {syncStatus === "offline" && "Hors ligne"}
              {syncStatus === "error" && "Erreur sync"}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-white truncate">{session.userName}</div>
              <div style={{ ...monoFont, fontSize: 9 }} className="text-[#F2B705] uppercase tracking-wider font-semibold">
                {session.role === "admin" ? "Admin" : "Vendeur"}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {getLockPin() && (
                <button onClick={() => setLocked(true)} title="Verrouiller" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                  <Lock size={14} />
                </button>
              )}
              <button onClick={toggleNotifications} title="Notifications" className="p-1.5 rounded-lg hover:bg-white/10">
                <Bell size={14} color={notifEnabled ? C.accent : "#94A3B8"} />
              </button>
              <button onClick={toggleTheme} title="Thème" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <button onClick={() => setSession(null)} title="Déconnexion" className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 p-5 md:p-8 max-w-7xl mx-auto w-full">
        {tab === "dashboard" && <Dashboard db={db} session={session} />}
        {tab === "aujourdhui" && <Aujourdhui db={db} setTab={setTab} session={session} />}
        {tab === "rapports" && <Rapports db={db} session={session} />}
        {tab === "devis" && <Devis db={db} persist={persist} notify={notify} log={log} session={session} />}
        {tab === "achats" && <Achats db={db} persist={persist} notify={notify} log={log} />}
        {tab === "ventes" && <Ventes db={db} persist={persist} notify={notify} session={session} />}
        {tab === "livraison" && <Livraison db={db} persist={persist} notify={notify} log={log} />}
        {tab === "stock" && <Stock db={db} persist={persist} notify={notify} log={log} session={session} initialQuery={deepLinkQuery} />}
        {tab === "inventaire" && <Inventaire db={db} persist={persist} notify={notify} log={log} />}
        {tab === "caisse" && <Caisse db={db} persist={persist} notify={notify} log={log} />}
        {tab === "commandes" && <CommandesEnLigne db={db} persist={persist} notify={notify} log={log} session={session} />}
        {tab === "avis" && <AvisClients db={db} notify={notify} log={log} session={session} />}
        {tab === "promos" && <CodesPromo db={db} notify={notify} log={log} session={session} />}
        {tab === "calculateur" && <MarketplaceCalculator db={db} persist={persist} notify={notify} />}
        {tab === "clients" && <Clients db={db} persist={persist} notify={notify} log={log} initialClientId={deepLinkClientId} />}
        {tab === "fournisseurs" && <Fournisseurs db={db} persist={persist} notify={notify} log={log} />}
        {tab === "cheques" && <Cheques db={db} persist={persist} notify={notify} log={log} />}
        {tab === "facturation" && <Facturation db={db} persist={persist} notify={notify} log={log} />}
        {tab === "finance" && session.role === "admin" && <Finance db={db} persist={persist} notify={notify} log={log} session={session} />}
        {tab === "charges" && session.role === "admin" && <Charges db={db} persist={persist} notify={notify} log={log} />}
        {tab === "equipe" && session.role === "admin" && <Equipe session={session} notify={notify} log={log} />}
        {tab === "audit" && session.role === "admin" && <AuditLog session={session} />}
      </main>

      {/* Global Search Modal */}
      {searchOpen && (
        <GlobalSearch
          db={db}
          onSelect={(result) => {
            setSearchOpen(false);
            if (result.type === "client") {
              setDeepLinkClientId(result.id);
              setTab("clients");
            } else if (result.type === "product") {
              setDeepLinkQuery(result.label);
              setTab("stock");
            } else if (result.type === "supplier") {
              setTab("fournisseurs");
            } else if (result.type === "invoice") {
              setTab("facturation");
            } else if (result.type === "colis") {
              setTab("livraison");
            }
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* Lock Screen */}
      {locked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-xs text-center p-8 rounded-3xl border border-white/10 bg-[#090D16] shadow-2xl">
            <img src="/logo.png" alt="Electrolik" className="h-9 w-auto mx-auto mb-6" />
            <div style={{ ...monoFont, color: "#94A3B8", fontSize: 11 }} className="uppercase tracking-widest mb-4">
              Entrez votre code PIN
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={unlockInput}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setUnlockInput(v);
                setUnlockError(false);
                if (v.length === 4) setTimeout(() => tryUnlock(), 50);
              }}
              onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
              className="w-full text-center text-3xl py-3 rounded-2xl outline-none mb-3 bg-white/[0.05] text-white border"
              style={{ letterSpacing: "0.6em", borderColor: unlockError ? C.danger : "rgba(255,255,255,0.1)" }}
            />
            {unlockError && <p className="text-xs mb-3 text-rose-500 font-medium">Code incorrect</p>}
            <button onClick={() => setSession(null)} className="text-xs text-slate-400 hover:text-white">
              Déconnexion
            </button>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 px-4 py-3 rounded-2xl shadow-2xl text-sm flex items-center gap-4 z-50 border border-white/10 animate-bounce"
          style={{ background: "#0F172A", color: "#fff" }}
        >
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={() => { toast.undo(); setToast(null); }}
              className="px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: C.accent, color: "#000" }}
            >
              Annuler
            </button>
          )}
        </div>
      )}
    </div>
  );
}
