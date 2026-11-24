import { type ToastManager, Toast as ToastPrimitive } from "@base-ui/react/toast";

// One manager and one duration for every notification in the app. app.tsx renders its Toaster, and
// feature modules only add or close toasts through this module.
const toastTimeoutMs = 5000;

const appToastManager: ToastManager = ToastPrimitive.createToastManager();

const notifyError = (title: string, id?: string): void => {
    appToastManager.add({ id, title, type: "error" });
};

const notifySuccess = (title: string): void => {
    appToastManager.add({ title, type: "success" });
};

export { appToastManager, notifyError, notifySuccess, toastTimeoutMs };
