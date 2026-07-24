import { useEffect, useState } from "react";
import { Download } from "lucide-react";

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

export function usePwaInstallAvailability() {
  const [available, setAvailable] = useState(() => Boolean(window.__smartMHubInstallAvailable) && !isStandalone());
  useEffect(() => {
    const update = (event) => setAvailable(Boolean(event.detail?.available) && !isStandalone());
    const installed = () => setAvailable(false);
    window.addEventListener("smart-m-hub:install-availability", update);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("smart-m-hub:install-availability", update);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return available;
}

export default function InstallSmartMHub() {
  const installAvailable = usePwaInstallAvailability();
  if (isStandalone()) return null;
  return (
    <aside className="h-fit rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-slate-200">
      <Download className="h-7 w-7 text-emerald-300" />
      <h2 className="mt-3 text-lg font-semibold text-white">Install Smart M Hub</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Install Smart M Hub on your phone or computer for easier access. Once installed, you can open it directly from your device without searching for the Smart M Hub link every time.
      </p>
      <button type="button" disabled={!installAvailable} onClick={() => window.dispatchEvent(new Event("smart-m-hub:install"))} className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
        Install Smart M Hub
      </button>
      {!installAvailable && <p className="mt-3 text-xs leading-5 text-amber-200">Installation is not currently available. In Chrome or Edge, use the browser menu and choose Install Smart M Hub when offered.</p>}
      <p className="mt-3 text-xs leading-5 text-slate-400">On iPhone or iPad Safari: Tap Share, then Add to Home Screen.</p>
    </aside>
  );
}
