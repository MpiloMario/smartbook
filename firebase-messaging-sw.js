importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyAjZq5bYvnHY_ETwViusNK-Qr3MaXlZN-c",
    authDomain: "smartbook-59f75.firebaseapp.com",
    projectId: "smartbook-59f75",
    storageBucket: "smartbook-59f75.appspot.com",  // ✅ add this
    messagingSenderId: "409462885633",
    appId: "1:409462885633:web:e05e326aa3b5abdb419f00"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log("Background message received:", payload);

    self.registration.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: "/icons/icon-144.png",   // ✅ leading slash
        badge: "/icons/icon-72.png",   // ✅ add badge for Android status bar
        vibrate: [200, 100, 200],      // ✅ vibration pattern for mobile
        requireInteraction: true       // ✅ keeps notification visible until user taps it
    });
});