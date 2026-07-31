import { useEffect, useState } from "react";
import { hasPwaInstallPrompt, isPwaStandalone, promptPwaInstall, subscribeToPwaInstall } from "../pwaInstall";

const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function PwaInstall() {
  const [installAvailable, setInstallAvailable] = useState(hasPwaInstallPrompt);
  const [showHelp, setShowHelp] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => subscribeToPwaInstall(setInstallAvailable), []);

  if (isPwaStandalone()) return null;
  const install = async () => {
    setMessage("");
    if (ios()) { setShowHelp(true); return; }
    if (!installAvailable) { setShowHelp(true); setMessage("The browser has not offered installation yet, or the dashboard is already installed."); return; }
    const result = await promptPwaInstall();
    if (result.outcome === "accepted") setMessage("Installation accepted. The Super Admin app will appear with your installed apps.");
    else if (result.outcome === "unavailable") setShowHelp(true);
    else setMessage("Installation was not completed. Click again when you are ready.");
  };

  return (
    <aside style={panelStyle} aria-label="Install Super Admin Dashboard">
      <div><strong>Smart M Hub - Super Admin</strong><div style={textStyle}>Install this dashboard for direct access from your device.</div></div>
      <button type="button" style={buttonStyle} onClick={install}>Install Super Admin Now</button>
      {showHelp && <div style={helpStyle}>{ios() ? "Tap Share, then Add to Home Screen." : "In Chrome or Edge, open the browser menu and choose Install Smart M Hub or Install app. Installation requires HTTPS and is hidden when already installed."}</div>}
      {message && <div style={messageStyle}>{message}</div>}
    </aside>
  );
}

const panelStyle = { position: "fixed", right: 16, bottom: 16, zIndex: 1000, maxWidth: 340, display: "grid", gap: 10, padding: 14, borderRadius: 10, border: "1px solid #334155", background: "#101827", color: "#f8fafc", boxShadow: "0 14px 40px rgba(0,0,0,.35)" };
const textStyle = { marginTop: 4, color: "#94a3b8", fontSize: 12, lineHeight: 1.5 };
const buttonStyle = { border: 0, borderRadius: 8, padding: "9px 12px", background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" };
const helpStyle = { color: "#cbd5e1", fontSize: 12 };
const messageStyle = { color: "#f8fafc", fontSize: 12 };
