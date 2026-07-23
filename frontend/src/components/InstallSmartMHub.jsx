import { Download } from "lucide-react";

export default function InstallSmartMHub() {
  return (
    <aside className="h-fit rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-slate-200">
      <Download className="h-7 w-7 text-emerald-300" />
      <h2 className="mt-3 text-lg font-semibold text-white">Install Smart M Hub</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Install Smart M Hub on your phone or computer for easier access. Once installed, you can open it directly from your device without searching for the Smart M Hub link every time.
      </p>
      <button type="button" onClick={() => window.dispatchEvent(new Event("smart-m-hub:install"))} className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
        Install Smart M Hub
      </button>
      <p className="mt-3 text-xs leading-5 text-slate-400">On iPhone or iPad Safari: Tap Share, then Add to Home Screen.</p>
    </aside>
  );
}
