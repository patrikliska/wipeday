/**
 * Web Push on this device (W4b): whether it can work here, and turning it on
 * or off. The service worker (`public/sw.js`) shows the notifications and
 * opens the game when one is tapped. iPhones only allow push for a site added
 * to the Home Screen and opened from there.
 */
import type { Backend, DeviceSubscription } from "./backend";

export type PushSupport = "ok" | "ios_home_screen" | "unsupported" | "denied";

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function standalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupport(): PushSupport {
  const capable =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!capable) return isIos() && !standalone() ? "ios_home_screen" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

/** Registers the service worker (once per page load is enough; the browser keeps it). */
export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/** This device's subscription, if notifications are on here. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await registerWorker();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`;
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Asks for permission (on the player's tap), subscribes and tells the server. */
export async function enablePush(backend: Backend, publicKey: string): Promise<boolean> {
  const registration = await registerWorker();
  if (!registration) return false;
  if ((await Notification.requestPermission()) !== "granted") return false;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  await backend.pushSubscribe(subscription.toJSON() as DeviceSubscription);
  return true;
}

export async function disablePush(backend: Backend): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await backend.pushUnsubscribe(subscription.endpoint);
  await subscription.unsubscribe();
}
