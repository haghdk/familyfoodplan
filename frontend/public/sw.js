/*
 * Service worker for Family Food Planner push notifications.
 *
 * A push message can arrive while no tab is open, so the browser needs a worker
 * registered at the root scope to receive it. This file only handles
 * notifications — it deliberately does not cache or intercept any requests.
 */

const DEFAULT_NOTIFICATION = {
  title: "Family Food Planner",
  body: "Open the app to see today's plan.",
  url: "/",
};

self.addEventListener("install", () => {
  // Take over straight away so turning reminders on works without a reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const readPushPayload = (event) => {
  if (!event.data) {
    return DEFAULT_NOTIFICATION;
  }

  try {
    const payload = event.data.json();

    return {
      title: payload.title || DEFAULT_NOTIFICATION.title,
      body: payload.body || DEFAULT_NOTIFICATION.body,
      url: payload.url || DEFAULT_NOTIFICATION.url,
      tag: payload.tag,
    };
  } catch (_error) {
    return {
      ...DEFAULT_NOTIFICATION,
      body: event.data.text() || DEFAULT_NOTIFICATION.body,
    };
  }
};

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      // A tagged notification replaces an earlier one silently by default; the
      // reminder is the only notification of its day, so make it announce itself.
      renotify: Boolean(payload.tag),
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const existingClient = clientList.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );

        if (existingClient) {
          return existingClient.focus().then((focusedClient) => {
            if (focusedClient && "navigate" in focusedClient) {
              return focusedClient.navigate(targetUrl);
            }

            return focusedClient;
          });
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
