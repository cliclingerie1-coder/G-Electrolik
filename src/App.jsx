import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, PackagePlus, ShoppingCart, Boxes, Receipt,
  Plus, Trash2, X, Search, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, Minus, ChevronRight, Wallet, PiggyBank, Save,
  Users, Truck, Landmark, Download, Upload, Phone, LogOut, ShieldCheck, Lock, Printer,
  FileText, ClipboardList, UserCog, Barcode
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import * as XLSX from "xlsx";
import JsBarcode from "jsbarcode";

// ---- Design tokens ----
const C = {
  ink: "#161B26",
  inkSoft: "#5B6274",
  paper: "#EFF1F5",
  paperCard: "#FFFFFF",
  sidebar: "#12182B",
  sidebarAlt: "#1B2340",
  sidebarText: "#AEB4CC",
  accent: "#C97B3D",
  accentSoft: "#F3E1CC",
  success: "#3F7859",
  successSoft: "#DCEAE2",
  danger: "#B4453A",
  dangerSoft: "#F5DEDB",
  border: "#DBDFE7",
};

const displayFont = { fontFamily: "'Newsreader', Georgia, serif" };
const monoFont = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

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
  cheques: [],
  quotes: [],
  nextQuote: 1,
  deliveryNotes: [],
  nextBL: 1,
};

export default function App() {
  const [db, setDb] = useState(DEFAULT_DB);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

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
    sbSaveBackup(s, db); // assure une sauvegarde du jour dès la connexion
  };

  const nav = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "devis", label: "Devis", icon: FileText },
    { id: "achats", label: "Achats", icon: PackagePlus },
    { id: "ventes", label: "Ventes / PDV", icon: ShoppingCart },
    { id: "livraison", label: "Bons de livraison", icon: ClipboardList },
    { id: "stock", label: "Stock", icon: Boxes },
    { id: "clients", label: "Clients", icon: Users },
    { id: "fournisseurs", label: "Fournisseurs", icon: Truck },
    { id: "cheques", label: "Chèques", icon: Landmark },
    { id: "facturation", label: "Facturation", icon: Receipt },
    ...(session && session.role === "admin"
      ? [
          { id: "finance", label: "Comptabilité", icon: PiggyBank },
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
      <div style={{ background: C.paper, minHeight: "100vh" }} className="flex items-center justify-center">
        <div style={{ ...monoFont, color: C.inkSoft }} className="text-sm tracking-widest uppercase">
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }} className="flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside style={{ background: C.sidebar }} className="md:w-64 w-full flex md:flex-col shrink-0">
        <div className="p-6 hidden md:block">
          <div style={{ ...displayFont, color: "#fff" }} className="text-2xl italic">Négoce</div>
          <div style={{ ...monoFont, color: C.sidebarText }} className="text-[10px] tracking-[0.2em] uppercase mt-1">
            Registre de commerce
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
                className="flex items-center gap-3 px-4 md:px-3 py-3 md:py-2.5 md:rounded-md whitespace-nowrap"
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
            <button onClick={() => setSession(null)} title="Déconnexion">
              <LogOut size={16} color={C.sidebarText} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-5 md:p-10 max-w-6xl">
        {tab === "dashboard" && <Dashboard db={db} />}
        {tab === "devis" && <Devis db={db} persist={persist} notify={notify} log={log} />}
        {tab === "achats" && <Achats db={db} persist={persist} notify={notify} />}
        {tab === "ventes" && <Ventes db={db} persist={persist} notify={notify} />}
        {tab === "livraison" && <Livraison db={db} persist={persist} notify={notify} log={log} />}
        {tab === "stock" && <Stock db={db} persist={persist} notify={notify} log={log} />}
        {tab === "clients" && <Clients db={db} persist={persist} notify={notify} log={log} />}
        {tab === "fournisseurs" && <Fournisseurs db={db} persist={persist} notify={notify} log={log} />}
        {tab === "cheques" && <Cheques db={db} persist={persist} notify={notify} log={log} />}
        {tab === "facturation" && <Facturation db={db} persist={persist} notify={notify} log={log} />}
        {tab === "finance" && session.role === "admin" && <Finance db={db} persist={persist} notify={notify} log={log} session={session} />}
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
    <div style={{ background: C.sidebar, minHeight: "100vh" }} className="flex items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-lg p-8" style={{ background: "#fff" }}>
        <div style={{ ...displayFont, color: C.ink }} className="text-3xl italic mb-1">Négoce</div>
        <div style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }} className="uppercase tracking-[0.2em] mb-6">
          Connexion sécurisée
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
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border, background: "#fff" }}>
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
  const bg = tone === "danger" ? C.dangerSoft : tone === "success" ? C.successSoft : "#fff";
  const iconColor = tone === "danger" ? C.danger : tone === "success" ? C.success : C.accent;
  return (
    <div className="rounded-lg p-5 border" style={{ background: bg, borderColor: C.border }}>
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
  const color = paid ? C.success : C.danger;
  const text = labels ? (paid ? labels[0] : labels[1]) : paid ? "PAYÉ" : "EN ATTENTE";
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border-2"
      style={{ ...monoFont, fontSize: 10, letterSpacing: "0.12em", color, borderColor: color, transform: "rotate(-2deg)" }}
    >
      {paid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
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
        <h1 style={{ ...displayFont, color: C.ink }} className="text-3xl italic">{title}</h1>
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
  const stockValue = db.products.reduce((s, p) => s + p.price * p.qty, 0);
  const rupture = db.products.filter((p) => p.qty <= 0);
  const lowStock = db.products.filter((p) => p.qty > 0 && p.qty <= p.minQty);
  const revenue = db.sales.reduce((s, sale) => s + sale.total, 0);
  const pendingInvoices = db.invoices.filter((i) => i.status === "pending");
  const grossMargin = db.sales.reduce((s, sale) => {
    const saleMargin = (sale.items || []).reduce((sm, item) => {
      const prod = db.products.find((p) => p.id === item.productId);
      const cost = prod ? prod.costPrice || 0 : 0;
      return sm + (item.price - cost) * item.qty;
    }, 0);
    return s + saleMargin;
  }, 0);

  const trend = useMemo(() => {
    const map = {};
    db.sales.forEach((s) => {
      map[s.date] = (map[s.date] || 0) + s.total;
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, total]) => ({ date: date.slice(5), total }));
  }, [db.sales]);

  const topProducts = useMemo(() => {
    const map = {};
    db.sales.forEach((s) =>
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
    db.sales.forEach((s) => {
      const ch = s.channel || "Boutique";
      map[ch] = (map[ch] || 0) + s.total;
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [db.sales]);

  return (
    <div>
      <SectionTitle eyebrow="Vue d'ensemble" title="Tableau de bord" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Chiffre d'affaires" value={fmt(revenue) + " DHS"} icon={TrendingUp} />
        <StatCard label="Marge brute" value={fmt(grossMargin) + " DHS"} icon={PiggyBank} tone={grossMargin >= 0 ? "success" : "danger"} />
        <StatCard label="Valeur du stock" value={fmt(stockValue) + " DHS"} icon={Boxes} />
        <StatCard label="Ruptures de stock" value={rupture.length} icon={AlertTriangle} tone={rupture.length ? "danger" : "success"} />
        <StatCard label="Stock bas" value={lowStock.length} icon={AlertTriangle} tone={lowStock.length ? "danger" : "success"} />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg border p-5" style={{ borderColor: C.border, background: "#fff" }}>
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

        <div className="rounded-lg border p-5" style={{ borderColor: C.border, background: "#fff" }}>
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

      <div className="rounded-lg border p-5 mb-8" style={{ borderColor: C.border, background: "#fff" }}>
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

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-5" style={{ borderColor: C.border, background: "#fff" }}>
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

        <div className="rounded-lg border p-5" style={{ borderColor: C.border, background: "#fff" }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Dernières ventes</div>
          {db.sales.length === 0 ? (
            <p className="text-sm" style={{ color: C.inkSoft }}>Aucune vente enregistrée pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {[...db.sales].reverse().slice(0, 5).map((s) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span style={{ color: C.ink }}>{s.client || "Client comptoir"}</span>
                  <span style={monoFont}>{fmt(s.total)} DHS</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Stock ----------
function Stock({ db, persist, notify, log }) {
  const [form, setForm] = useState({ name: "", sku: "", barcode: "", category: "", price: "", costPrice: "", qty: "", minQty: "5" });
  const [q, setQ] = useState("");

  const addProduct = () => {
    if (!form.name || !form.price) return notify("Nom et prix requis");
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
    };
    persist({ ...db, products: [...db.products, p] });
    setForm({ name: "", sku: "", barcode: "", category: "", price: "", costPrice: "", qty: "", minQty: "5" });
    notify("Produit ajouté");
  };

  const printLabel = (p) => {
    const w = window.open("", "_blank", "width=420,height=320");
    w.document.write(`
      <html><head><title>Étiquette ${p.sku}</title>
      <style>
        body { font-family: Inter, sans-serif; text-align: center; padding: 16px; }
        h3 { margin: 4px 0; }
        .price { font-size: 20px; font-weight: bold; margin-top: 4px; }
      </style></head>
      <body>
        <h3>${p.name}</h3>
        <svg id="bc"></svg>
        <div class="price">${fmt(p.price)} DHS</div>
      </body></html>
    `);
    w.document.close();
    w.onload = () => {
      JsBarcode(w.document.getElementById("bc"), p.barcode, { format: "EAN13", width: 2, height: 60, fontSize: 14 });
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

  const filtered = db.products.filter((p) =>
    (p.name + p.sku + p.category + (p.barcode || "")).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <SectionTitle eyebrow="Catalogue" title="Stock & produits" />

      <div className="rounded-lg border p-5 mb-6" style={{ borderColor: C.border, background: "#fff" }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">
          Nouveau produit
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
            <input type="number" className={inputClass} style={inputStyle} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </Field>
          <Field label="Seuil min.">
            <input type="number" className={inputClass} style={inputStyle} value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} />
          </Field>
        </div>
        <button onClick={addProduct} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <Plus size={14} /> Ajouter au catalogue
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3 border rounded-md px-3 py-2 max-w-sm" style={{ borderColor: C.border, background: "#fff" }}>
        <Search size={14} color={C.inkSoft} />
        <input placeholder="Rechercher un produit…" className="w-full outline-none text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border, background: "#fff" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b" >
              <td className="px-4 py-3" style={{ borderColor: C.border }}>Produit</td>
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
              const margin = p.price - (p.costPrice || 0);
              const marginPct = p.price ? Math.round((margin / p.price) * 100) : 0;
              const rupture = p.qty <= 0;
              const low = !rupture && p.qty <= p.minQty;
              return (
                <tr key={p.id} className="border-b" style={{ borderColor: C.border }}>
                  <td className="px-4 py-3" style={{ color: C.ink }}>{p.name}</td>
                  <td className="px-4 py-3">
                    <div style={monoFont}>{p.sku}</div>
                    <div style={{ ...monoFont, color: C.inkSoft, fontSize: 10 }}>{p.barcode}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: C.inkSoft }}>{p.category}</td>
                  <td className="px-4 py-3" style={{ ...monoFont, color: C.inkSoft }}>{fmt(p.costPrice || 0)} DHS</td>
                  <td className="px-4 py-3" style={monoFont}>{fmt(p.price)} DHS</td>
                  <td className="px-4 py-3" style={{ ...monoFont, color: margin >= 0 ? C.success : C.danger }}>{fmt(margin)} DHS · {marginPct}%</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(p.id, -1)} className="w-6 h-6 rounded border flex items-center justify-center" style={{ borderColor: C.border }}><Minus size={12} /></button>
                      <span style={{ ...monoFont, color: rupture ? C.danger : low ? "#B4813A" : C.ink }}>{p.qty}</span>
                      <button onClick={() => updateQty(p.id, 1)} className="w-6 h-6 rounded border flex items-center justify-center" style={{ borderColor: C.border }}><Plus size={12} /></button>
                      {rupture && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.dangerSoft, color: C.danger }}>RUPTURE</span>}
                      {low && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#F5E7D3", color: "#B4813A" }}>BAS</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => printLabel(p)} title="Imprimer l'étiquette"><Printer size={14} color={C.inkSoft} /></button>
                      <button onClick={() => removeProduct(p.id)}><Trash2 size={14} color={C.danger} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun produit trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Achats ----------
function Achats({ db, persist, notify }) {
  const [form, setForm] = useState({ productId: "", newName: "", supplierId: "", supplierName: "", qty: "1", unitCost: "" });
  const useExisting = form.productId !== "";

  const submit = () => {
    const supplierLabel = form.supplierId
      ? db.suppliers.find((s) => s.id === form.supplierId)?.name
      : form.supplierName;
    if (!supplierLabel || !form.qty || !form.unitCost) return notify("Fournisseur, quantité et coût requis");
    let products = [...db.products];
    let productName = "";
    const qty = Number(form.qty);
    const unitCost = Number(form.unitCost);

    if (useExisting) {
      const idx = products.findIndex((p) => p.id === form.productId);
      if (idx === -1) return notify("Produit introuvable");
      products[idx] = { ...products[idx], qty: products[idx].qty + qty, costPrice: unitCost };
      productName = products[idx].name;
    } else {
      if (!form.newName) return notify("Nom du nouveau produit requis");
      const p = { id: uid(), name: form.newName, sku: "SKU-" + uid().toUpperCase().slice(0, 5), category: "Général", price: Math.round(unitCost * 1.4), costPrice: unitCost, qty, minQty: 5 };
      products.push(p);
      productName = p.name;
    }

    let suppliers = [...db.suppliers];
    if (!form.supplierId && supplierLabel) {
      suppliers.push({ id: uid(), name: supplierLabel, phone: "" });
    }

    const purchase = { id: uid(), date: today(), productName, supplier: supplierLabel, qty, unitCost, total: qty * unitCost };
    persist({ ...db, products, suppliers, purchases: [...db.purchases, purchase] });
    setForm({ productId: "", newName: "", supplierId: "", supplierName: "", qty: "1", unitCost: "" });
    notify("Achat enregistré, stock mis à jour");
  };

  return (
    <div>
      <SectionTitle eyebrow="Approvisionnement" title="Achats" />

      <div className="rounded-lg border p-5 mb-6" style={{ borderColor: C.border, background: "#fff" }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouvel achat</div>
        <div className="grid md:grid-cols-5 gap-3">
          <Field label="Produit existant">
            <select className={inputClass} style={inputStyle} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">— Nouveau produit —</option>
              {db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
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
        </div>
        <button onClick={submit} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <PackagePlus size={14} /> Enregistrer l'achat
        </button>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border, background: "#fff" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Date</td><td className="px-4 py-3">Produit</td><td className="px-4 py-3">Fournisseur</td>
              <td className="px-4 py-3">Qté</td><td className="px-4 py-3">Coût unit.</td><td className="px-4 py-3">Total</td>
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
              </tr>
            ))}
            {db.purchases.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun achat enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Ventes / PDV ----------
function Ventes({ db, persist, notify }) {
  const [cart, setCart] = useState([]);
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState("");
  const [payment, setPayment] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [channel, setChannel] = useState("Boutique");
  const [scan, setScan] = useState("");

  const addToCart = (p) => {
    if (p.qty <= 0) return notify("Rupture de stock");
    setCart((c) => {
      const existing = c.find((i) => i.productId === p.id);
      if (existing) {
        if (existing.qty >= p.qty) { notify("Stock insuffisant"); return c; }
        return c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...c, { productId: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const handleScan = (e) => {
    if (e.key !== "Enter") return;
    const code = scan.trim();
    setScan("");
    if (!code) return;
    const p = db.products.find((x) => x.barcode === code || x.sku === code);
    if (!p) return notify("Aucun produit avec ce code");
    addToCart(p);
  };

  const changeQty = (id, delta) =>
    setCart((c) => c.map((i) => (i.productId === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  const removeItem = (id) => setCart((c) => c.filter((i) => i.productId !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmount = Math.min(subtotal, (subtotal * (Number(discount) || 0)) / 100);
  const total = subtotal - discountAmount;

  const checkout = () => {
    if (cart.length === 0) return notify("Panier vide");
    let products = [...db.products];
    for (const item of cart) {
      const idx = products.findIndex((p) => p.id === item.productId);
      if (idx === -1 || products[idx].qty < item.qty) return notify(`Stock insuffisant pour ${item.name}`);
    }
    products = products.map((p) => {
      const item = cart.find((i) => i.productId === p.id);
      return item ? { ...p, qty: p.qty - item.qty } : p;
    });

    const clientName = client || "Client comptoir";
    let clients = [...db.clients];
    if (clientId) {
      clients = clients.map((c) =>
        c.id === clientId && payment === "credit" ? { ...c, balanceDue: (c.balanceDue || 0) + total } : c
      );
    }

    const sale = { id: uid(), date: today(), items: cart, total, discount: discountAmount, client: clientName, clientId, payment, channel };
    const invoiceNumber = "NG-" + db.nextInvoice;
    const invoice = {
      id: uid(),
      number: invoiceNumber,
      date: today(),
      client: clientName,
      clientId,
      total,
      status: payment === "cash" ? "paid" : "pending",
      items: cart,
      channel,
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
    notify(`Vente enregistrée — facture ${invoiceNumber}`);
  };

  return (
    <div>
      <SectionTitle eyebrow="Point de vente" title="Ventes / PDV" />
      <div className="flex items-center gap-2 mb-4 border rounded-md px-3 py-2 max-w-sm" style={{ borderColor: C.accent, background: "#fff" }}>
        <Barcode size={16} color={C.accent} />
        <input
          placeholder="Scanner ou taper un code-barres, puis Entrée…"
          className="w-full outline-none text-sm"
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={handleScan}
        />
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {db.products.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.qty <= 0}
                className="text-left rounded-lg border p-4 disabled:opacity-40"
                style={{ borderColor: C.border, background: "#fff" }}
              >
                <div className="text-sm mb-1" style={{ color: C.ink }}>{p.name}</div>
                <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }}>{p.sku} · {p.qty} en stock</div>
                <div style={{ ...monoFont, color: C.accent }} className="mt-2 text-sm">{fmt(p.price)} DHS</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-5 h-fit sticky top-5" style={{ borderColor: C.border, background: "#fff" }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Panier</div>
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
          <div className="flex justify-between items-center my-4 pt-3 border-t" style={{ borderColor: C.border }}>
            <span style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }} className="uppercase">Total</span>
            <span style={{ ...displayFont, color: C.ink }} className="text-2xl">{fmt(total)} DHS</span>
          </div>
          <button onClick={checkout} className="w-full py-2.5 rounded-md text-sm text-white flex items-center justify-center gap-2" style={{ background: C.accent }}>
            Valider la vente <ChevronRight size={14} />
          </button>
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

  const totalPending = db.invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.total, 0);

  const exportExcel = () => {
    const rows = db.invoices.map((inv) => ({
      Numéro: inv.number, Date: inv.date, Client: inv.client,
      Total: inv.total, Statut: inv.status === "paid" ? "Payé" : "En attente",
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
    const html = `
      <html>
        <head>
          <title>${inv.number}</title>
          <style>
            body { font-family: Georgia, serif; color: #161B26; padding: 40px; max-width: 640px; margin: auto; }
            h1 { font-style: italic; margin-bottom: 0; }
            .muted { color: #5B6274; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #5B6274; border-bottom: 1px solid #DBDFE7; padding-bottom: 6px; }
            th:nth-child(2) { text-align: center; }
            th:nth-child(3), th:nth-child(4) { text-align: right; }
            tr td { border-bottom: 1px solid #EEE; }
            .total { text-align: right; margin-top: 20px; font-size: 22px; font-style: italic; }
            .stamp { display: inline-block; margin-top: 6px; padding: 4px 12px; border: 2px solid ${inv.status === "paid" ? "#3F7859" : "#B4453A"}; color: ${inv.status === "paid" ? "#3F7859" : "#B4453A"}; border-radius: 999px; font-size: 11px; letter-spacing: 0.1em; transform: rotate(-2deg); }
          </style>
        </head>
        <body>
          <h1>Négoce</h1>
          <div class="muted">Facture ${inv.number}</div>
          <p>Client : ${inv.client}<br/>Date : ${inv.date}</p>
          <table>
            <thead><tr><th>Article</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="total">Total : ${fmt(inv.total)} DHS</div>
          <div class="stamp">${inv.status === "paid" ? "PAYÉ" : "EN ATTENTE"}</div>
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
          <div key={inv.id} className="rounded-lg border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: C.border, background: "#fff" }}>
            <div>
              <div style={monoFont} className="text-sm">{inv.number}</div>
              <div style={{ color: C.inkSoft }} className="text-xs">{inv.client} · {inv.date}</div>
            </div>
            <div style={{ ...displayFont, color: C.ink }} className="text-lg">{fmt(inv.total)} DHS</div>
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
function Clients({ db, persist, notify, log }) {
  const [form, setForm] = useState({ name: "", phone: "" });

  const addClient = () => {
    if (!form.name) return notify("Nom requis");
    persist({ ...db, clients: [...db.clients, { id: uid(), name: form.name, phone: form.phone, balanceDue: 0 }] });
    setForm({ name: "", phone: "" });
    notify("Client ajouté");
  };

  const removeClient = (id) => {
    const c = db.clients.find((x) => x.id === id);
    const prevDb = db;
    persist({ ...db, clients: db.clients.filter((c) => c.id !== id) });
    if (log && c) log("delete_client", "clients", id, { name: c.name });
    if (c) notify(`Client "${c.name}" supprimé`, () => persist(prevDb));
  };

  const totalDue = db.clients.reduce((s, c) => s + (c.balanceDue || 0), 0);

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
      <div className="rounded-lg border p-5 mb-6" style={{ borderColor: C.border, background: "#fff" }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouveau client</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Nom"><input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputClass} style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <button onClick={addClient} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <Plus size={14} /> Ajouter le client
        </button>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border, background: "#fff" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Client</td><td className="px-4 py-3">Téléphone</td><td className="px-4 py-3">Solde dû</td><td className="px-4 py-3"></td>
            </tr>
          </thead>
          <tbody>
            {db.clients.map((c) => (
              <tr key={c.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={{ color: C.ink }}>{c.name}</td>
                <td className="px-4 py-3 flex items-center gap-1" style={{ color: C.inkSoft }}><Phone size={12} />{c.phone || "—"}</td>
                <td className="px-4 py-3" style={{ ...monoFont, color: c.balanceDue > 0 ? C.danger : C.success }}>{fmt(c.balanceDue || 0)} DHS</td>
                <td className="px-4 py-3 text-right"><button onClick={() => removeClient(c.id)}><Trash2 size={14} color={C.danger} /></button></td>
              </tr>
            ))}
            {db.clients.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun client enregistré.</td></tr>
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

  const addSupplier = () => {
    if (!form.name) return notify("Nom requis");
    persist({ ...db, suppliers: [...db.suppliers, { id: uid(), name: form.name, phone: form.phone }] });
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

  const spentBySupplier = (name) => db.purchases.filter((p) => p.supplier === name).reduce((s, p) => s + p.total, 0);

  return (
    <div>
      <SectionTitle eyebrow="Registre" title="Fournisseurs" />
      <div className="rounded-lg border p-5 mb-6" style={{ borderColor: C.border, background: "#fff" }}>
        <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouveau fournisseur</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Nom"><input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputClass} style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <button onClick={addSupplier} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white" style={{ background: C.accent }}>
          <Plus size={14} /> Ajouter le fournisseur
        </button>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border, background: "#fff" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ ...monoFont, fontSize: 10, color: C.inkSoft }} className="uppercase tracking-widest border-b">
              <td className="px-4 py-3">Fournisseur</td><td className="px-4 py-3">Téléphone</td><td className="px-4 py-3">Total achats</td><td className="px-4 py-3"></td>
            </tr>
          </thead>
          <tbody>
            {db.suppliers.map((s) => (
              <tr key={s.id} className="border-b" style={{ borderColor: C.border }}>
                <td className="px-4 py-3" style={{ color: C.ink }}>{s.name}</td>
                <td className="px-4 py-3 flex items-center gap-1" style={{ color: C.inkSoft }}><Phone size={12} />{s.phone || "—"}</td>
                <td className="px-4 py-3" style={monoFont}>{fmt(spentBySupplier(s.name))} DHS</td>
                <td className="px-4 py-3 text-right"><button onClick={() => removeSupplier(s.id)}><Trash2 size={14} color={C.danger} /></button></td>
              </tr>
            ))}
            {db.suppliers.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: C.inkSoft }}>Aucun fournisseur enregistré.</td></tr>
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
      <div className="rounded-lg border p-5 mb-6" style={{ borderColor: C.border, background: "#fff" }}>
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
          <div key={c.id} className="rounded-lg border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: C.border, background: "#fff" }}>
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
function Devis({ db, persist, notify, log }) {
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
      if (!prod || prod.qty < item.qty) return notify(`Stock insuffisant pour ${item.name}`);
    }
    const products = db.products.map((p) => {
      const item = q.items.find((i) => i.productId === p.id);
      return item ? { ...p, qty: p.qty - item.qty } : p;
    });
    const sale = { id: uid(), date: today(), items: q.items, total: q.total, discount: 0, client: q.client, clientId: q.clientId, payment: "cash" };
    const invoiceNumber = "NG-" + db.nextInvoice;
    const invoice = { id: uid(), number: invoiceNumber, date: today(), client: q.client, clientId: q.clientId, total: q.total, status: "paid", items: q.items };
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
              <button key={p.id} onClick={() => addToCart(p)} className="text-left rounded-lg border p-4" style={{ borderColor: C.border, background: "#fff" }}>
                <div className="text-sm mb-1" style={{ color: C.ink }}>{p.name}</div>
                <div style={{ ...monoFont, color: C.accent }} className="text-sm">{fmt(p.price)} DHS</div>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-5 h-fit" style={{ borderColor: C.border, background: "#fff" }}>
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
          <div key={q.id} className="rounded-lg border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: C.border, background: "#fff" }}>
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

  const addToCart = (p) => {
    setItems((c) => {
      const existing = c.find((i) => i.productId === p.id);
      if (existing) return c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { productId: p.id, name: p.name, qty: 1 }];
    });
  };
  const changeQty = (id, delta) =>
    setItems((c) => c.map((i) => (i.productId === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  const removeItem = (id) => setItems((c) => c.filter((i) => i.productId !== id));

  const createBL = () => {
    if (items.length === 0) return notify("Aucun article sélectionné");
    const number = "BL-" + db.nextBL;
    const bl = { id: uid(), number, date: today(), client: client || "Client comptoir", clientId, items, status: "pending" };
    persist({ ...db, deliveryNotes: [...db.deliveryNotes, bl], nextBL: db.nextBL + 1 });
    if (log) log("create_bl", "deliveryNotes", bl.id, { number });
    setItems([]); setClient(""); setClientId("");
    notify(`Bon de livraison ${number} créé`);
  };

  const markDelivered = (id) => {
    const bl = db.deliveryNotes.find((b) => b.id === id);
    persist({ ...db, deliveryNotes: db.deliveryNotes.map((b) => (b.id === id ? { ...b, status: "delivered" } : b)) });
    if (log && bl) log("mark_delivered", "deliveryNotes", id, { number: bl.number });
  };

  return (
    <div>
      <SectionTitle eyebrow="Logistique" title="Bons de livraison" />
      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {db.products.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="text-left rounded-lg border p-4" style={{ borderColor: C.border, background: "#fff" }}>
                <div className="text-sm" style={{ color: C.ink }}>{p.name}</div>
                <div style={{ ...monoFont, color: C.inkSoft, fontSize: 11 }}>{p.sku}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-5 h-fit" style={{ borderColor: C.border, background: "#fff" }}>
          <div style={{ ...monoFont, fontSize: 11, color: C.inkSoft }} className="uppercase tracking-widest mb-4">Nouveau bon</div>
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
                  <button onClick={() => removeItem(i.productId)}><X size={13} color={C.danger} /></button>
                </li>
              ))}
            </ul>
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
            Créer le bon <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {[...db.deliveryNotes].reverse().map((b) => (
          <div key={b.id} className="rounded-lg border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: C.border, background: "#fff" }}>
            <div>
              <div style={monoFont} className="text-sm">{b.number}</div>
              <div style={{ color: C.inkSoft }} className="text-xs">{b.client} · {b.date} · {b.items.length} article(s)</div>
            </div>
            <Stamp status={b.status === "delivered" ? "paid" : "pending"} labels={["LIVRÉ", "EN PRÉPARATION"]} />
            {b.status !== "delivered" && (
              <button onClick={() => markDelivered(b.id)} className="text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: C.success, color: C.success }}>
                Marquer livré
              </button>
            )}
          </div>
        ))}
        {db.deliveryNotes.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: C.inkSoft }}>Aucun bon de livraison pour l'instant.</div>
        )}
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
      <div className="rounded-lg border overflow-hidden mb-6" style={{ borderColor: C.border, background: "#fff" }}>
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
      <div className="rounded-lg border p-5" style={{ borderColor: C.border, background: "#fff" }}>
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

// ---------- Finance / Comptabilité ----------
function Finance({ db, persist, notify, log, session }) {
  const [capitalInput, setCapitalInput] = useState(String(db.capital || 0));
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(true);

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

  const totalRevenue = db.sales.reduce((s, x) => s + x.total, 0);
  const totalCosts = db.purchases.reduce((s, x) => s + x.total, 0);
  const stockValue = db.products.reduce((s, p) => s + p.price * p.qty, 0); // valeur au prix de vente
  const stockValueAtCost = db.products.reduce((s, p) => s + (p.costPrice || 0) * p.qty, 0); // valeur au coût d'achat
  const cashProfit = totalRevenue - totalCosts; // bénéfice "caisse" : ce qui est déjà encaissé moins tout ce qui a été acheté
  const currentCapital = (db.capital || 0) + cashProfit + stockValueAtCost; // patrimoine total : capital de départ + bénéfice encaissé + valeur de la marchandise encore en stock (au coût)

  // group by year
  const years = useMemo(() => {
    const map = {};
    db.sales.forEach((s) => {
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

      <div className="rounded-lg border p-5 mb-6" style={{ borderColor: C.border, background: "#fff" }}>
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
        <StatCard label="Capital initial" value={fmt(db.capital || 0) + " DHS"} icon={Wallet} />
        <StatCard label="Bénéfice encaissé" value={fmt(cashProfit) + " DHS"} icon={TrendingUp} tone={cashProfit >= 0 ? "success" : "danger"} />
        <StatCard label="Stock (au coût)" value={fmt(stockValueAtCost) + " DHS"} icon={Boxes} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatCard label="Capital actuel (patrimoine total)" value={fmt(currentCapital) + " DHS"} icon={PiggyBank} tone="success" />
        <StatCard label="Stock (valeur de revente)" value={fmt(stockValue) + " DHS"} icon={Boxes} />
      </div>
      <p className="text-xs -mt-5 mb-8" style={{ color: C.inkSoft }}>
        Capital actuel = Capital initial + Bénéfice encaissé + Valeur de la marchandise encore en stock (comptée au coût d'achat, pas au prix de vente, car elle n'est pas encore vendue).
      </p>

      <div className="rounded-lg border overflow-hidden mb-6" style={{ borderColor: C.border, background: "#fff" }}>
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

      <div className="rounded-lg border p-5" style={{ borderColor: C.border, background: "#fff" }}>
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
                Produit: p.name, SKU: p.sku, Catégorie: p.category, Prix: p.price, Quantité: p.qty,
              })));
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Stock");
              XLSX.writeFile(wb, "stock.xlsx");
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
                Produit: p.name, SKU: p.sku, Catégorie: p.category, Prix: p.price, Quantité: p.qty,
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
