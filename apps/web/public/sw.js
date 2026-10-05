/**
 * The service worker: only for notifications (W4b), no offline cache. A push
 * carries {title, body, tag, url}; it is shown unless the game is open and in
 * front (the game shows its own toast then). A tap focuses the game, or opens it,
 * on the notification's url (a report card).
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const note = event.data ? event.data.json() : null;
  if (!note) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.some((client) => client.focused)) return undefined;
      return self.registration.showNotification(note.title, {
        body: note.body,
        tag: note.tag,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: note.url || "/" },
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => client.url.startsWith(self.location.origin));
      if (open) return open.focus().then((client) => client.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
