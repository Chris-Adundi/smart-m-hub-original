import { useCallback, useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { hasPwaInstallPrompt, isPwaStandalone, promptPwaInstall, subscribeToPwaInstall } from "@/pwaInstall";

const DISMISSED_KEY = "smart_m_hub_install_prompt_dismissed";

const isIosSafari = () => {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

export default function PwaInstallPrompt() {
  const [installAvailable, setInstallAvailable] = useState(hasPwaInstallPrompt);
  const [open, setOpen] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const directInstallLink = new URLSearchParams(window.location.search).get("install") === "1";

  const presentInstall = useCallback(() => {
    if (isPwaStandalone()) return;
    if (isIosSafari()) {
      setShowIosHelp(true);
      setOpen(true);
      return;
    }
    setShowIosHelp(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToPwaInstall((available) => {
      setInstallAvailable(available);
      if (available) setStatusMessage("");
      if (available && (directInstallLink || !localStorage.getItem(DISMISSED_KEY)) && !isPwaStandalone()) {
        window.setTimeout(() => setOpen(true), 1800);
      }
    });
    const manualInstall = async () => {
      if (!isIosSafari() && hasPwaInstallPrompt()) {
        const result = await promptPwaInstall();
        if (result.outcome !== "unavailable") {
          setOpen(false);
          return;
        }
      }
      presentInstall();
    };
    const installed = () => {
      setOpen(false);
      setInstallAvailable(false);
      localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("smart-m-hub:install", manualInstall);
    window.addEventListener("appinstalled", installed);

    if (directInstallLink && !isPwaStandalone()) {
      presentInstall();
    }

    if (isIosSafari() && (directInstallLink || !localStorage.getItem(DISMISSED_KEY)) && !isPwaStandalone()) {
      const timer = window.setTimeout(() => {
        setShowIosHelp(true);
        setOpen(true);
      }, 1800);
      return () => {
        window.clearTimeout(timer);
        unsubscribe();
        window.removeEventListener("smart-m-hub:install", manualInstall);
        window.removeEventListener("appinstalled", installed);
      };
    }

    return () => {
      unsubscribe();
      window.removeEventListener("smart-m-hub:install", manualInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, [directInstallLink, presentInstall]);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setOpen(false);
  };

  const install = async () => {
    setStatusMessage("");
    const result = await promptPwaInstall();
    if (result.outcome === "accepted" || result.outcome === "installed") {
      setOpen(false);
      return;
    }
    if (result.outcome === "dismissed") {
      setStatusMessage("Installation was cancelled. Reload this page and click Install when you are ready.");
      return;
    }
    setStatusMessage("Chrome could not open its native install dialog. Click the install icon at the right side of the address bar, or open Chrome menu (three dots) > Cast, save and share > Install Smart M Hub.");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-md rounded-2xl border border-slate-700 bg-[#111c31] p-5 text-slate-100 shadow-2xl" role="dialog" aria-labelledby="pwa-install-title">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-emerald-500/15 p-3 text-emerald-400">
          {showIosHelp ? <Share className="h-6 w-6" /> : <Download className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="pwa-install-title" className="font-semibold text-white">Install Smart M Hub</h2>
          {showIosHelp ? (
            <p className="mt-1 text-sm leading-6 text-slate-400">Tap <strong className="text-slate-200">Share</strong>, then <strong className="text-slate-200">Add to Home Screen</strong>.</p>
          ) : (
            <p className="mt-1 text-sm leading-6 text-slate-400">Install Smart M Hub on your phone or computer for easier access. Once installed, you can open it directly from your device without searching for the Smart M Hub link every time.</p>
          )}
          <div className="mt-4 flex gap-3">
            {!showIosHelp && installAvailable && <button type="button" onClick={install} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Install Smart M Hub</button>}
            {!showIosHelp && !installAvailable && <p className="text-xs leading-5 text-slate-400">In Chrome or Edge, open the browser menu and choose <strong>Install Smart M Hub</strong> or <strong>Install app</strong>. Installation requires HTTPS and is hidden when the app is already installed.</p>}
            <button type="button" onClick={dismiss} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5">{showIosHelp ? "Got It" : "Not Now"}</button>
          </div>
          {statusMessage && <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">{statusMessage}</p>}
        </div>
      </div>
    </div>
  );
}
