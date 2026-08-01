let deferredInstallPrompt = null;
const subscribers = new Set();

export const isPwaStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

const notify = () => {
  const available = Boolean(deferredInstallPrompt) && !isPwaStandalone();
  window.__smartMHubInstallAvailable = available;
  subscribers.forEach((subscriber) => subscriber(available));
};

// Register at module evaluation time so Chromium's one-shot event cannot be
// missed while React is mounting or remounting components in Strict Mode.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  notify();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  notify();
});

export const hasPwaInstallPrompt = () => Boolean(deferredInstallPrompt) && !isPwaStandalone();

export const subscribeToPwaInstall = (subscriber) => {
  subscribers.add(subscriber);
  subscriber(hasPwaInstallPrompt());
  return () => subscribers.delete(subscriber);
};

export const promptPwaInstall = async () => {
  if (isPwaStandalone()) return { outcome: "installed" };
  if (!deferredInstallPrompt) return { outcome: "unavailable" };

  const prompt = deferredInstallPrompt;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferredInstallPrompt = null;
    notify();
    return choice;
  } catch (error) {
    deferredInstallPrompt = null;
    notify();
    return { outcome: "error", error };
  }
};
