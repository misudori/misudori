import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Save, LogIn, LogOut, ShieldCheck, RefreshCw, X, KeyRound } from "lucide-react";

// ---------- 定数 ----------
const RANKS = [
  "未確認",
  "No Rank",
  "アイアン",
  "ブロンズ",
  "シルバー",
  "ゴールド",
  "プラチナ",
  "ダイヤ",
  "アセ",
  "イモ",
  "レディ",
];
const RANK_COLORS = {
  "未確認": "#475569",
  "No Rank": "#6b7280",
  "アイアン": "#8b8d91",
  "ブロンズ": "#b08968",
  "シルバー": "#9ca3af",
  "ゴールド": "#eab308",
  "プラチナ": "#67e8f9",
  "ダイヤ": "#a78bfa",
  "アセ": "#34d399",
  "イモ": "#a3a861",
  "レディ": "#f472b6",
};
const STORAGE_KEY = "nfa_accounts_v1";
const SESSION_KEY = "nfa_session_v1";
// パスコードは平文で保持しない。SHA-256ハッシュ値のみを保持し、入力値をハッシュ化して比較する。
const ADMIN_PASSCODE_HASH =
  "7cc520290970883d48d2a0cd6d33751ce3beb482ca4244e433c170b24ccb06b";

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const emptyDraft = () => ({
  username: "",
  rank: "未確認",
  status: "未使用",
  user: "",
  releaseDate: "",
});

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [booting, setBooting] = useState(true);

  const [accounts, setAccounts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [borrowModalId, setBorrowModalId] = useState(null);
  const [borrowName, setBorrowName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // ---------- 初期化：セッション復元 ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(SESSION_KEY, false);
        if (res && res.value === "1") {
          setLoggedIn(true);
        }
      } catch (e) {
        // セッションなし
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // ---------- データ読み込み ----------
  const loadAccounts = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await window.storage.get(STORAGE_KEY, true);
      if (res && res.value) {
        setAccounts(JSON.parse(res.value));
      } else {
        setAccounts([]);
      }
    } catch (e) {
      setAccounts([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) loadAccounts();
  }, [loggedIn, loadAccounts]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  };

  const persist = async (next) => {
    setSaving(true);
    try {
      const result = await window.storage.set(STORAGE_KEY, JSON.stringify(next), true);
      if (!result) throw new Error("保存に失敗しました");
      setAccounts(next);
    } catch (e) {
      showToast("保存に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  };

  // ---------- ログイン ----------
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const inputHash = await sha256Hex(passInput);
      if (inputHash === ADMIN_PASSCODE_HASH) {
        setLoginError("");
        setLoggedIn(true);
        try {
          await window.storage.set(SESSION_KEY, "1", false);
        } catch (e) {}
      } else {
        setLoginError("パスコードが正しくありません");
      }
    } catch (e) {
      setLoginError("認証に失敗しました。もう一度お試しください");
    }
  };

  const handleLogout = async () => {
    setLoggedIn(false);
    setPassInput("");
    try {
      await window.storage.delete(SESSION_KEY, false);
    } catch (e) {}
  };

  // ---------- アカウント操作 ----------
  const handleAddAccount = async () => {
    if (!draft.username.trim()) {
      showToast("ユーザー名を入力してください", "error");
      return;
    }
    const newAcc = {
      id: uid(),
      username: draft.username.trim(),
      rank: draft.rank,
      status: "未使用",
      user: "",
      releaseDate: "",
    };
    await persist([newAcc, ...accounts]);
    setShowAddModal(false);
    setDraft(emptyDraft());
    showToast("アカウントを追加しました");
  };

  const handleRankChange = (id, rank) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, rank } : a)));
  };

  const handleSaveRank = async (id) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    await persist(accounts.map((a) => (a.id === id ? acc : a)));
    showToast("ランクを保存しました");
  };

  const handleDelete = async (id) => {
    await persist(accounts.filter((a) => a.id !== id));
    setConfirmDeleteId(null);
    showToast("アカウントを削除しました");
  };

  const openBorrow = (id) => {
    setBorrowModalId(id);
    setBorrowName("");
  };

  const confirmBorrow = async () => {
    if (!borrowName.trim()) {
      showToast("借用者名を入力してください", "error");
      return;
    }
    const next = accounts.map((a) =>
      a.id === borrowModalId
        ? { ...a, status: "使用中", user: borrowName.trim(), releaseDate: "" }
        : a
    );
    await persist(next);
    setBorrowModalId(null);
    showToast("借用を記録しました");
  };

  const handleReturn = async (id) => {
    const next = accounts.map((a) =>
      a.id === id ? { ...a, status: "未使用", user: "", releaseDate: todayStr() } : a
    );
    await persist(next);
    showToast("返却を記録しました");
  };

  // ---------- ローディング画面 ----------
  if (booting) {
    return (
      <div style={styles.page}>
        <div style={styles.bootCenter}>
          <RefreshCw size={28} style={{ color: "#5b8def", animation: "spin 1s linear infinite" }} />
        </div>
        <style>{spinKeyframes}</style>
      </div>
    );
  }

  // ---------- ログイン画面 ----------
  if (!loggedIn) {
    return (
      <div style={styles.page}>
        <div style={styles.loginWrap}>
          <div style={styles.loginCard}>
            <div style={styles.loginIconWrap}>
              <KeyRound size={26} style={{ color: "#5b8def" }} />
            </div>
            <h1 style={styles.loginTitle}>NFA</h1>
            <p style={styles.loginSub}>続けるにはパスコードを入力してください</p>
            <form onSubmit={handleLogin} style={{ width: "100%" }}>
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="パスコード"
                style={styles.loginInput}
                autoFocus
              />
              {loginError && <div style={styles.loginError}>{loginError}</div>}
              <button type="submit" style={styles.loginButton}>
                <LogIn size={16} style={{ marginRight: 6 }} />
                ログイン
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---------- メイン画面 ----------
  return (
    <div style={styles.page}>
      <style>{spinKeyframes}</style>

      {/* ヘッダー */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <h1 style={styles.title}>NFA</h1>
          <div style={styles.headerButtons}>
            <button style={{ ...styles.navBtn, ...styles.navBtnBlue }} onClick={() => showToast("マイページは準備中です", "error")}>
              マイページ
            </button>
            <button style={{ ...styles.navBtn, ...styles.navBtnGreen }} onClick={() => setShowAddModal(true)}>
              <Plus size={15} style={{ marginRight: 4 }} />
              アカウント登録
            </button>
            <button style={{ ...styles.navBtn, ...styles.navBtnPurple }} onClick={() => showToast("承認依頼を送信しました")}>
              <ShieldCheck size={15} style={{ marginRight: 4 }} />
              承認依頼
            </button>
            <button style={styles.logoutBtn} onClick={handleLogout} title="ログアウト">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>在庫一覧</h2>
          {saving && (
            <span style={styles.savingTag}>
              <RefreshCw size={13} style={{ marginRight: 4, animation: "spin 1s linear infinite" }} />
              保存中…
            </span>
          )}
        </div>

        {loadingData ? (
          <div style={styles.emptyState}>読み込み中です…</div>
        ) : accounts.length === 0 ? (
          <div style={styles.emptyState}>
            まだアカウントが登録されていません。「アカウント登録」から追加してください。
          </div>
        ) : (
          <div style={styles.grid}>
            {accounts.map((acc) => (
              <div key={acc.id} style={styles.card}>
                <Row label="USERNAME" value={acc.username} bold />
                <Row label="ランク" value={acc.rank} bold color={RANK_COLORS[acc.rank]} />
                <Row
                  label="状況"
                  value={acc.status}
                  bold
                  color={acc.status === "未使用" ? "#34d399" : "#f87171"}
                />
                <Row label="ユーザー" value={acc.user || "−"} />
                <Row label="払出日" value={acc.releaseDate || "−"} />

                <div style={styles.rankRow}>
                  <select
                    value={acc.rank}
                    onChange={(e) => handleRankChange(acc.id, e.target.value)}
                    style={styles.select}
                  >
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button style={styles.saveBtn} onClick={() => handleSaveRank(acc.id)}>
                    <Save size={13} style={{ marginRight: 4 }} />
                    保存
                  </button>
                </div>

                <div style={styles.actionRow}>
                  {confirmDeleteId === acc.id ? (
                    <div style={styles.confirmRow}>
                      <span style={styles.confirmText}>削除しますか？</span>
                      <button style={styles.confirmYes} onClick={() => handleDelete(acc.id)}>
                        はい
                      </button>
                      <button style={styles.confirmNo} onClick={() => setConfirmDeleteId(null)}>
                        いいえ
                      </button>
                    </div>
                  ) : (
                    <button style={styles.deleteBtn} onClick={() => setConfirmDeleteId(acc.id)}>
                      <Trash2 size={14} style={{ marginRight: 4 }} />
                      削除
                    </button>
                  )}

                  {acc.status === "未使用" ? (
                    <button style={styles.borrowBtn} onClick={() => openBorrow(acc.id)}>
                      借りる
                    </button>
                  ) : (
                    <button style={styles.returnBtn} onClick={() => handleReturn(acc.id)}>
                      返却する
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 追加モーダル */}
      {showAddModal && (
        <ModalOverlay onClose={() => setShowAddModal(false)}>
          <h3 style={styles.modalTitle}>アカウント登録</h3>
          <label style={styles.modalLabel}>ユーザー名</label>
          <input
            style={styles.modalInput}
            value={draft.username}
            onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
            placeholder="例：skhasan624"
            autoFocus
          />
          <label style={styles.modalLabel}>ランク</label>
          <select
            style={styles.modalInput}
            value={draft.rank}
            onChange={(e) => setDraft((d) => ({ ...d, rank: e.target.value }))}
          >
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div style={styles.modalActions}>
            <button style={styles.modalCancel} onClick={() => setShowAddModal(false)}>
              キャンセル
            </button>
            <button style={styles.modalConfirm} onClick={handleAddAccount}>
              登録する
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* 借りるモーダル */}
      {borrowModalId && (
        <ModalOverlay onClose={() => setBorrowModalId(null)}>
          <h3 style={styles.modalTitle}>アカウントを借りる</h3>
          <label style={styles.modalLabel}>借用者名</label>
          <input
            style={styles.modalInput}
            value={borrowName}
            onChange={(e) => setBorrowName(e.target.value)}
            placeholder="あなたの名前"
            autoFocus
          />
          <div style={styles.modalActions}>
            <button style={styles.modalCancel} onClick={() => setBorrowModalId(null)}>
              キャンセル
            </button>
            <button style={styles.modalConfirm} onClick={confirmBorrow}>
              借りる
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* トースト */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            background: toast.type === "error" ? "#7f1d1d" : "#14532d",
            borderColor: toast.type === "error" ? "#dc2626" : "#16a34a",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span
        style={{
          ...styles.rowValue,
          fontWeight: bold ? 700 : 400,
          color: color || "#e5e7eb",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ModalOverlay({ children, onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onClose}>
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

const spinKeyframes = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0b1220",
    color: "#e5e7eb",
    fontFamily:
      "'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', -apple-system, sans-serif",
  },
  bootCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },

  // ログイン画面
  loginWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: 24,
  },
  loginCard: {
    background: "#121a2e",
    border: "1px solid #1f2a44",
    borderRadius: 16,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },
  loginIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: "#1b2640",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  loginTitle: { fontSize: 20, fontWeight: 800, margin: 0, color: "#fff", textAlign: "center" },
  loginSub: { fontSize: 13, color: "#94a3b8", marginTop: 8, marginBottom: 22, textAlign: "center" },
  loginInput: {
    width: "100%",
    boxSizing: "border-box",
    background: "#0b1220",
    border: "1px solid #2a3656",
    borderRadius: 10,
    padding: "11px 14px",
    fontSize: 14,
    color: "#fff",
    outline: "none",
    marginBottom: 8,
  },
  loginError: { color: "#f87171", fontSize: 12.5, marginBottom: 10 },
  loginButton: {
    width: "100%",
    background: "#3b6fe0",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "11px 0",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  loginHint: { fontSize: 11.5, color: "#475569", marginTop: 18 },

  // ヘッダー
  header: { borderBottom: "1px solid #1c2740", background: "#0d1526" },
  headerInner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "18px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    background: "linear-gradient(90deg, #5b8def, #93c5fd)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: 0,
  },
  headerButtons: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  navBtn: {
    border: "none",
    borderRadius: 9,
    padding: "9px 16px",
    fontSize: 13.5,
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  navBtnBlue: { background: "#3b6fe0" },
  navBtnGreen: { background: "#1f9d62" },
  navBtnPurple: { background: "#6d4fd1" },
  logoutBtn: {
    background: "#1b2640",
    border: "1px solid #2a3656",
    color: "#cbd5e1",
    borderRadius: 9,
    padding: "9px 11px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },

  main: { maxWidth: 1100, margin: "0 auto", padding: "28px 28px 60px" },
  sectionHeader: { display: "flex", alignItems: "center", gap: 14, marginBottom: 18 },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: "#f1f5f9", margin: 0 },
  savingTag: { fontSize: 12, color: "#93c5fd", display: "flex", alignItems: "center" },

  emptyState: {
    border: "1px dashed #2a3656",
    borderRadius: 12,
    padding: "40px 20px",
    textAlign: "center",
    color: "#64748b",
    fontSize: 13.5,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: 20,
  },
  card: {
    background: "#121a2e",
    border: "1px solid #1f2a44",
    borderRadius: 14,
    padding: "20px 22px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "7px 0",
    borderBottom: "1px solid #19223a",
    fontSize: 14,
  },
  rowLabel: { color: "#8794ad" },
  rowValue: {},

  rankRow: { display: "flex", gap: 8, marginTop: 16, marginBottom: 14 },
  select: {
    flex: 1,
    background: "#0b1220",
    border: "1px solid #2a3656",
    borderRadius: 8,
    color: "#e5e7eb",
    padding: "8px 10px",
    fontSize: 13,
  },
  saveBtn: {
    background: "#3b6fe0",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },

  actionRow: { display: "flex", gap: 10 },
  deleteBtn: {
    flex: 1,
    background: "#b14848",
    border: "none",
    color: "#fff",
    borderRadius: 9,
    padding: "10px 0",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  borrowBtn: {
    flex: 1,
    background: "#3b6fe0",
    border: "none",
    color: "#fff",
    borderRadius: 9,
    padding: "10px 0",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  returnBtn: {
    flex: 1,
    background: "#1f9d62",
    border: "none",
    color: "#fff",
    borderRadius: 9,
    padding: "10px 0",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  confirmRow: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#1b2640",
    borderRadius: 9,
    padding: "6px 10px",
  },
  confirmText: { fontSize: 12.5, color: "#cbd5e1", flex: 1 },
  confirmYes: {
    background: "#b14848",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  confirmNo: {
    background: "#374151",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },

  // モーダル
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: 20,
  },
  modal: {
    background: "#121a2e",
    border: "1px solid #1f2a44",
    borderRadius: 14,
    padding: "26px 24px",
    width: "100%",
    maxWidth: 380,
    position: "relative",
  },
  modalClose: {
    position: "absolute",
    top: 14,
    right: 14,
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
  },
  modalTitle: { fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 18px" },
  modalLabel: { fontSize: 12.5, color: "#94a3b8", marginBottom: 6, display: "block" },
  modalInput: {
    width: "100%",
    boxSizing: "border-box",
    background: "#0b1220",
    border: "1px solid #2a3656",
    borderRadius: 9,
    padding: "10px 12px",
    fontSize: 14,
    color: "#fff",
    marginBottom: 16,
    outline: "none",
  },
  modalActions: { display: "flex", gap: 10, marginTop: 6 },
  modalCancel: {
    flex: 1,
    background: "#1b2640",
    border: "1px solid #2a3656",
    color: "#cbd5e1",
    borderRadius: 9,
    padding: "10px 0",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  modalConfirm: {
    flex: 1,
    background: "#3b6fe0",
    border: "none",
    color: "#fff",
    borderRadius: 9,
    padding: "10px 0",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
  },

  toast: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "12px 22px",
    borderRadius: 10,
    border: "1px solid",
    fontSize: 13.5,
    fontWeight: 600,
    color: "#fff",
    zIndex: 100,
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  },
};
