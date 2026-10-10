  // Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyAjZq5bYvnHY_ETwViusNK-Qr3MaXlZN-c",
    authDomain: "smartbook-59f75.firebaseapp.com",
    projectId: "smartbook-59f75",
    storageBucket: "smartbook-59f75.firebasestorage.app",
    messagingSenderId: "409462885633",
    appId: "1:409462885633:web:e05e326aa3b5abdb419f00",
    measurementId: "G-38DK51GCXV"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
// Services
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function registerUser(email, password,username, room) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    const user = userCredential.user;

    // 🔥 Save user in Firestore
    await setDoc(doc(db, "users",user.uid), {
        uid: user.uid,
        email: user.email,
        username: username,
        roomNumber: room
    });

    return userCredential;
}
export async function loginUser(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
}

// 📌 SAVE BOOKING
export async function saveBooking(formData) {
    try {
        const user = auth.currentUser;

        if (!user) throw new Error("User not logged in");

        await addDoc(collection(db, "bookings"), {
            ...formData,
            userId: user.uid,          // ✅ FIXED
            email: user.email,         // ✅ store email
        });

        console.log("Booking saved!");
    } catch (error) {
        console.error("Error saving booking:", error);
        throw error;
    }
}

// 📌 LOAD BOOKINGS
export async function getBookings(user) {
    const querySnapshot = await getDocs(collection(db, "bookings"));
    const bookings = [];

    querySnapshot.forEach(doc => {
        const data = doc.data();

        bookings.push({
            id: doc.id,
            ...data
        });
    });

    return bookings;
}
export async function getBookingsByDate(date) {
    const q = query(
        collection(db, "bookings"),
        where("date", "==", date)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data());
}

// CHECK CONFLICT
export async function isSlotAvailable(newBooking) {
    const q = query(
        collection(db, "bookings"),
        where("date", "==", newBooking.date),
        where("floor", "==", newBooking.floor),
    );

    const snapshot = await getDocs(q);

    let isAvailable = true;

    snapshot.forEach(doc => {
        const existing = doc.data();

        // 🧺 Only bookings on the same machine conflict —
        // "Both" blocks every machine, otherwise services must match.
        // (Same logic as updateAvailableSlots in booking.js)
        const isSameMachine =
            newBooking.service === "Both" ||
            existing.service === "Both" ||
            existing.service === newBooking.service;

        if (!isSameMachine) return;

        const existingStart = new Date(existing.startTime);
        const existingEnd = new Date(existing.endTime);

        const newStart = new Date(newBooking.startTime);
        const newEnd = new Date(newBooking.endTime);

        // ⛔ OVERLAP CHECK
        const overlap =
            newStart < existingEnd &&
            newEnd > existingStart;

        if (overlap) {
            isAvailable = false;
        }
    });

    return isAvailable;
}
export async function getUsers() {
    const snapshot = await getDocs(collection(db, "users"));
    const users = {};

    snapshot.forEach(doc => {
        const data = doc.data();
        users[data.uid] = data.username;
    });

    return users;
}
export async function getUserData(uid){
    const docRef = doc(db, "users", uid);
    const snapshot = await getDoc(docRef);
    if(snapshot.exists()){
        return snapshot.data();
    }else{
        return null;
    }
}
export async function deleteBooking(id) {
    await deleteDoc(doc(db,"bookings",id));
    
}

// ⏱ EXTEND A BOOKING'S DURATION (used by the dashboard alert modal)
export async function extendBookingTime(id, minutes) {
    const ref = doc(db, "bookings", id);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) throw new Error("Booking not found");

    const currentEnd = new Date(snapshot.data().endTime).getTime();

    await updateDoc(ref, {
        endTime: new Date(currentEnd + minutes * 60000).toISOString()
    });
}

export async function saveUserToken(token) {
    const user = auth.currentUser;
    if (!user || !token) return;

    await setDoc(doc(db, "users", user.uid), {
        fcmTokens: {
            [token]: true
        }
    }, { merge: true });

    console.log("✅ FCM token saved for user:", user.uid);
}
export function showToast(message) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(15, 23, 42, 0.92);
        color: #e2e8f0;
        border: 1px solid rgba(139, 92, 246, 0.45);
        box-shadow: 0 12px 40px -8px rgba(139, 92, 246, 0.45);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: 14px 20px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        transition: opacity 0.4s ease;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    }, 6000);
}

// 🔔 Show a notification through the service worker — REQUIRED on Android,
// where `new Notification()` is an illegal constructor. Falls back to the
// constructor on desktop browsers without a service worker.
export async function showAppNotification(title, options = {}) {
    const defaults = {
        icon: "/icons/icon-256.png",
        badge: "/icons/icon-72.png",
        vibrate: [200, 100, 200]
    };

    try {
        if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();

            if (registration) {
                await registration.showNotification(title, { ...defaults, ...options });
                return;
            }
        }

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(title, { ...defaults, ...options });
        }
    } catch (error) {
        console.warn("Notification failed:", error);
    }
}