import { useCallback, useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

const DISMISSED_KEY = "smart_m_hub_install_prompt_dismissed";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

const isIosSafari = () => {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [open, setOpen] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  const presentInstall = useCallback(() => {
    if (isStandalone()) return;
    if (isIosSafari()) {
      setShowIosHelp(true);
      setOpen(true);
      return;
    }
    setShowIosHelp(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    const captureInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      if (!localStorage.getItem(DISMISSED_KEY) && !isStandalone()) {
        window.setTimeout(() => setOpen(true), 1800);
      }
    };
    const manualInstall = () => presentInstall();
    const installed = () => {
      setOpen(false);
      setInstallEvent(null);
      localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("smart-m-hub:install", manualInstall);
    window.addEventListener("appinstalled", installed);

    if (isIosSafari() && !localStorage.getItem(DISMISSED_KEY) && !isStandalone()) {
      const timer = window.setTimeout(() => {
        setShowIosHelp(true);
        setOpen(true);
      }, 1800);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", captureInstall);
        window.removeEventListener("smart-m-hub:install", manualInstall);
        window.removeEventListener("appinstalled", installed);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstall);
      window.removeEventListener("smart-m-hub:install", manualInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, [presentInstall]);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setOpen(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setOpen(false);
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
            {!showIosHelp && installEvent && <button type="button" onClick={install} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Install Smart M Hub</button>}
            {!showIosHelp && !installEvent && <p className="text-xs leading-5 text-slate-400">Use your browser menu and choose Install app or Add to Home Screen when available.</p>}
            <button type="button" onClick={dismiss} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5">{showIosHelp ? "Got It" : "Not Now"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
