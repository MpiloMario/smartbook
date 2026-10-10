importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyAjZq5bYvnHY_ETwViusNK-Qr3MaXlZN-c",
    authDomain: "smartbook-59f75.firebaseapp.com",
    projectId: "smartbook-59f75",
    storageBucket: "smartbook-59f75.appspot.com",
    messagingSenderId: "409462885633",
    appId: "1:409462885633:web:e05e326aa3b5abdb419f00"
});

const messaging = firebase.messaging();

// ℹ️ Notification messages (payload contains `notification`) are displayed
// AUTOMATICALLY by the FCM SDK when the app is in the background — using the
// icon/badge/link from the `webpush` config sent by the cloud function.
// onBackgroundMessage only fires for data-only messages, so no duplicates.
messaging.onBackgroundMessage((payload) => {
    console.log("Background message received:", payload);

    const n = payload.notification || {};
    if (!n.title) return;

    self.registration.showNotification(n.title, {
        body: n.body || "",
        icon: "/icons/icon-256.png",
        badge: "/icons/icon-72.png",
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: payload.data || {}
    });
});
