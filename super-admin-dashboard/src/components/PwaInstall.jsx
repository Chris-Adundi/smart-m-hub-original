import { useEffect, useState } from "react";

const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function PwaInstall() {
  const [prompt, setPrompt] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const ready = (event) => { event.preventDefault(); setPrompt(event); };
    const installed = () => { setPrompt(null); setShowHelp(false); };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (standalone()) return null;
  const install = async () => {
    if (ios()) { setShowHelp(true); return; }
    if (!prompt) { setShowHelp(true); return; }
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  return (
    <aside style={panelStyle} aria-label="Install Super Admin Dashboard">
      <div><strong>Smart M Hub - Super Admin</strong><div style={textStyle}>Install this dashboard for direct access from your device.</div></div>
      <button type="button" style={buttonStyle} onClick={install}>Install Smart M Hub</button>
      {showHelp && <div style={helpStyle}>{ios() ? "Tap Share, then Add to Home Screen." : "Use your browser menu and choose Install app when available."}</div>}
    </aside>
  );
}

const panelStyle = { position: "fixed", right: 16, bottom: 16, zIndex: 1000, maxWidth: 340, display: "grid", gap: 10, padding: 14, borderRadius: 10, border: "1px solid #334155", background: "#101827", color: "#f8fafc", boxShadow: "0 14px 40px rgba(0,0,0,.35)" };
const textStyle = { marginTop: 4, color: "#94a3b8", fontSize: 12, lineHeight: 1.5 };
const buttonStyle = { border: 0, borderRadius: 8, padding: "9px 12px", background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" };
const helpStyle = { color: "#cbd5e1", fontSize: 12 };
