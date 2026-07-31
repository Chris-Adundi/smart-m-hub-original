import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { hasPwaInstallPrompt, isPwaStandalone, promptPwaInstall, subscribeToPwaInstall } from "@/pwaInstall";

export function usePwaInstallAvailability() {
  const [available, setAvailable] = useState(hasPwaInstallPrompt);
  useEffect(() => subscribeToPwaInstall(setAvailable), []);
  return available;
}

export default function InstallSmartMHub() {
  const installAvailable = usePwaInstallAvailability();
  const [message, setMessage] = useState("");
  if (isPwaStandalone()) return null;
  const install = async () => {
    if (!installAvailable) {
      setMessage("Chrome/Edge has not offered installation yet, or this app is already installed. Use the browser menu > Install Smart M Hub. On iPhone/iPad, tap Share > Add to Home Screen.");
      return;
    }
    const result = await promptPwaInstall();
    setMessage(result.outcome === "accepted" ? "Installation accepted. Smart M Hub will appear with your installed apps." : "Installation was not completed. Click Install again when you are ready.");
  };
  return (
    <aside className="h-fit rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-slate-200">
      <Download className="h-7 w-7 text-emerald-300" />
      <h2 className="mt-3 text-lg font-semibold text-white">Install Smart M Hub</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Install Smart M Hub on your phone or computer for easier access. Once installed, you can open it directly from your device without searching for the Smart M Hub link every time.
      </p>
      <button type="button" onClick={install} className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
        Install Smart M Hub Now
      </button>
      {!installAvailable && <p className="mt-3 text-xs leading-5 text-amber-200">Click the button for installation help. Chrome or Edge will show the native prompt as soon as the app is eligible.</p>}
      <p className="mt-3 text-xs leading-5 text-slate-400">On iPhone or iPad Safari: Tap Share, then Add to Home Screen.</p>
      {message && <p className="mt-3 text-xs leading-5 text-white">{message}</p>}
    </aside>
  );
}
