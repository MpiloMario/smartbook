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

export async function saveUserToken(token) {
    const user = auth.currentUser;
    if (!user) return;

    await setDoc(doc(db, "users", user.uid), {
        fcmToken: token
    }, { merge: true });
}