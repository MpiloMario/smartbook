import { auth, saveBooking, isSlotAvailable, getUserData,getBookingsByDate,saveUserToken,showToast } from "./database.js";
import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getMessaging, getToken, onMessage } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

lucide.createIcons();

const allTimeSlots = [
"00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30",
"04:00","04:30","05:00","05:30","06:00","06:30","07:00","07:30",
"08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
"12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
"16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
"20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"
];

const maintenanceSlots = [
"08:00","08:30","09:00","09:30","10:00","10:30",
"11:00","11:30","12:00","12:30","13:00","13:30",
"14:00","14:30","15:00","15:30","16:00","16:30","17:00"
];
let resolveUserReady;
const userReady = new Promise(resolve =>{
    resolveUserReady = resolve;
});
let currentUser = null;
let currentUserData = null;

// 🔐 AUTH
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        currentUser = user;
        currentUserData = await getUserData(user.uid);
        console.log("User is logged in:", currentUserData);
        resolveUserReady();
    }
});
function populateTimeSlots(service) {
    const timeSelect = document.getElementById("timeInput");
    timeSelect.innerHTML = ""; // clear existing

    const slots = service === "Maintenance Support"
        ? maintenanceSlots
        : allTimeSlots;

    slots.forEach(time => {
        const option = document.createElement("option");
        option.value = time;
        option.textContent = time;
        timeSelect.appendChild(option);
    });
}
async function updateAvailableSlots() {
    const service = document.getElementById("serviceSelect").value;
    const floor = document.getElementById("floorSelect").value;
    const date = document.getElementById("dateInput").value;

    if (!date) return;

    // 🔥 Get all bookings for that date
    const existingBookings = await getBookingsByDate(date);

    const timeSelect = document.getElementById("timeInput");
    const options = timeSelect.querySelectorAll("option");

    options.forEach(option => {
        option.disabled = false;

        const slotTime = option.value;
        const slotStart = new Date(`${date}T${slotTime}`);
        let duration = 30;
        if(service === "Both") duration = 90;
        const slotEnd  =new Date(slotStart.getTime() + duration*60000);
    const isTaken = existingBookings.some(b => {
    const isSameMachine =
        service === "Both" ||
        b.service === "Both" ||
        b.service === service;
    if (!isSameMachine || b.floor !== floor) return false;

    const existingStart = new Date(b.startTime);
    const existingEnd = new Date(b.endTime);

    return slotStart < existingEnd && slotEnd > existingStart;
}); if(isTaken){
    option.disabled = true;
    option.textContent = `${slotTime} `
}else{
    option.textContent = slotTime;
}
});
}
document.getElementById("dateInput").addEventListener("change", updateAvailableSlots);
document.getElementById("serviceSelect").addEventListener("change", updateAvailableSlots);
document.getElementById("floorSelect").addEventListener("change", updateAvailableSlots);


// 📅 MIN DATE
const today = new Date().toISOString().split('T')[0];
document.getElementById('dateInput').min = today;

// 🎯 SERVICE DISPLAY
const selectedService = localStorage.getItem('selectedService');
if (selectedService) {
    document.getElementById('serviceSelect').value = selectedService;
    document.getElementById('selectedServiceDisplay').textContent = selectedService;
}

const serviceSelect = document.getElementById("serviceSelect");
const durationContainer = document.getElementById("durationContainer"); 
const floorContainer = document.getElementById('floorCont');
const notesField = document.getElementById("notesField");
serviceSelect.addEventListener("change",async  function () {
    const selectedService = this.value;

    // Update UI
    document.getElementById('selectedServiceDisplay').textContent = selectedService;

    // Update time slots 🔥
    populateTimeSlots(selectedService);
    await updateAvailableSlots();

    if (selectedService === "Maintenance Support") {
        durationContainer.style.display = "none";
        floorContainer.style.display = "none";
        notesField.required = true;
    } else if(selectedService ==="Both"){
        durationContainer.style.display = "none";
        floorContainer.style.display = "block";
        notesField.required = false;
    }else {
        durationContainer.style.display = "block";
        floorContainer.style.display = "block";
        notesField.required = false;
    }
});

// 🧠 SUBMIT
document.getElementById('bookingForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    await userReady;
    const selectedService = document.getElementById("serviceSelect").value;
    let duration;

    if (selectedService === "Maintenance Support") {
        duration = 30;
    } else if (selectedService === "Both") {
        duration = 90; // ✅ 1hr30min
    } else {
        duration = parseInt(document.getElementById('durationSelect').value);
    }
    const formData = {
        service: document.getElementById('serviceSelect').value,
        floor: document.getElementById('floorSelect').value,
        date: document.getElementById('dateInput').value,
        time: document.getElementById('timeInput').value,
        roomNumber: currentUserData.roomNumber,
        duration: duration,
        notes: this.querySelector('textarea').value,
        alertsEnabled: document.getElementById('enableAlerts').checked,
        status: 'upcoming'
    };

    // 🔧 Maintenance validation
    if (formData.service === "Maintenance Support" && !formData.notes.trim()) {
        alert("Please describe the maintenance issue.");
        return;
    }

    // ⏱ TIME
    const startDateTime = new Date(`${formData.date}T${formData.time}`);
    formData.startTime = startDateTime.toISOString();
    formData.endTime = new Date(
        startDateTime.getTime() + formData.duration * 60000
    ).toISOString();
    // 🚫 PREVENT DOUBLE BOOKING (FIXED LOCATION)
    const available = await isSlotAvailable(formData);

    if (!available) {
        alert("❌ This slot is already booked for this floor and machine.");
        return;
    }

    try {
        await saveBooking(formData); // ✅ FIXED
        scheduleNotifications(formData);

        document.getElementById('successModal').classList.remove('hidden');
        document.getElementById('successModal').classList.add('flex');

        this.reset();
    } catch (error) {
        console.error(error);
        alert("Error saving booking");
    }
});

function showLocalNotification(title, body) {
    if (Notification.permission === "granted") {
        new Notification(title, {
            body: body,
            icon: "/icons/icon-144.png"
        });
    }

    const audio = new Audio("images/alarm.wav");
    audio.play().catch(() => {});

    // ✅ Always show toast regardless of permission
    showToast(`${title}: ${body}`);
}
function scheduleNotifications(formData){
    if(!formData.alertsEnabled) return;

    const now = Date.now();
    const start = new Date(formData.startTime).getTime();
    const end = new Date(formData.endTime).getTime();

    const fiveMin = 5*60*1000;

    const startWarning = start - fiveMin;
    const endWarning = end - fiveMin;

    if (startWarning > now){
        setTimeout(()=>{
            showLocalNotification("⏳ Booking Starting Soon", `${formData.service} starts in 5 minutes`);
        },startWarning-now);
        }
     // ⏰ 5 min BEFORE END
    if (endWarning > now) {
        setTimeout(() => {
            showLocalNotification("⚠️ Almost Done", `${formData.service} ends in 5 minutes`);
        }, endWarning - now);
    }
    // 🚀 Booking started — NEW
    if (start > now) {
        setTimeout(() => {
            showLocalNotification("🚀 Booking Started",
                `${formData.service} has started! You have ${formData.duration} minutes.`);
        }, start - now);
    }
    // ⏰ FINISHED
    if (end > now) {
        setTimeout(() => {
            showLocalNotification("✅ Finished", `${formData.service} is done!`);
        }, end - now);
    }
}

// 🔧 MODAL
window.closeModal = function () {
    document.getElementById('successModal').classList.add('hidden');
    document.getElementById('successModal').classList.remove('flex');
};
window.addEventListener("DOMContentLoaded",async ()=>{
    const service = document.getElementById("serviceSelect").value;
    populateTimeSlots(service);
    await updateAvailableSlots();
});
const btn = document.querySelector("button[type='submit']");
btn.disabled = true;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        currentUserData = await getUserData(user.uid);

        btn.disabled = false; // ✅ enable
        resolveUserReady();
    }
});
document.addEventListener("click", () => {
    const audio = new Audio("images/alarm.wav");
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
    }).catch(() => {});
}, { once: true });
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("Service Worker Registered"))
    .catch(err => console.error("SW failed:", err));
}
// Toggle mobile menu
document.getElementById("mobile-menu-btn").addEventListener("click", () => {
    document.getElementById("mobile-menu").classList.toggle("hidden");
});

// Optional: close menu when clicking a link
document.querySelectorAll("#mobile-menu a").forEach(link => {
    link.addEventListener("click", () => {
        document.getElementById("mobile-menu").classList.add("hidden");
    });
});


const messaging = getMessaging();
async function setupFCM() {
    try {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            console.log("❌ Notification permission denied");
            return;
        }

        // ✅ CORRECT service worker registration
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        const token = await getToken(messaging, {
            vapidKey: "BCEWQ3ZEFYTmiG7UWUw5D8x6-0TlmTkjhR1I2AROSeWHVDVl1MwJXxmPqj3-wdkicQnJARjzkJMXPvBMvTsxKIc",
            serviceWorkerRegistration: registration // ✅ FIXED (lowercase s)
        });

        if (!token) {
            console.log("❌ No token received");
            return;
        }

        console.log("✅ FCM Token:", token);

        await saveUserToken(token);

    } catch (error) {
        console.error("❌ FCM error:", error);
    }
}

setupFCM();
onMessage(messaging, (payload) => {
    const n = payload.notification;
    if(!n) return;

    new Notification(n.title, {
        body: n.body,
        icon: "/icons/icon-192.png"
    });
});