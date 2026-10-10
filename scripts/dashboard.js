import { auth, getBookings, getUsers,deleteBooking,showToast,showAppNotification,saveUserToken,extendBookingTime } from "./database.js";
import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getMessaging, getToken } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

lucide.createIcons();

const messaging = getMessaging();

let currentUser = null;
let bookings = [];
let currentFilter = "all";
let usersMap = {};


// 🔐 AUTH + LOAD BOOKINGS

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        currentUser = user;

        bookings = await getBookings();
        usersMap = await getUsers(); // ✅ NEW

        markOldBookingsAsSeen(bookings);
        setInterval(checkNotifications, 30000); // every 30 seconds

        updateStats();
        renderBookings();
    }
});
function markOldBookingsAsSeen(bookings) {
    const now = Date.now();
    bookings.forEach(b => {
        const start = new Date(b.startTime).getTime();
        const end = new Date(b.endTime).getTime();
        const fiveMin = 5 * 60 * 1000;

        // If the window for this notification has already passed, mark it silently
        if (start - fiveMin < now) localStorage.setItem(`start-${b.id}`, "true");
        if (start + fiveMin < now) localStorage.setItem(`started-${b.id}`, "true");
        if (end - fiveMin < now)   localStorage.setItem(`end-${b.id}`, "true");
        if (now >= end)            localStorage.setItem(`done-${b.id}`, "true");
    });
}

function checkNotifications() {
    const now = Date.now();

    bookings.forEach(b => {
        if (!b.alertsEnabled) return;

        const start = new Date(b.startTime).getTime();
        const end = new Date(b.endTime).getTime();

        const fiveMin = 5 * 60 * 1000;

        // Unique keys to avoid duplicate alerts
        const startKey = `start-${b.id}`;
        const startedKey = `started-${b.id}`;
        const endKey = `end-${b.id}`;
        const doneKey = `done-${b.id}`;

        // ⏳ 5 min BEFORE START
        if (
            start - fiveMin <= now &&
            start > now &&
            !localStorage.getItem(startKey)
        ) {
            notifyUser(`⏳ ${b.service} starts in 5 minutes`);
            localStorage.setItem(startKey, "true");
        }

        // ⚠️ 5 min BEFORE END
        if (
            end - fiveMin <= now &&
            end > now &&
            !localStorage.getItem(endKey)
        ) {
            notifyUser(`⚠️ ${b.service} ends in 5 minutes`);
            localStorage.setItem(endKey, "true");
        }
        // 🚀 STARTED
        if (start <= now && now <= start + fiveMin && !localStorage.getItem(startedKey)) {
            notifyUser(`🚀 ${b.service} has started! You have ${b.duration} minutes.`);
            localStorage.setItem(startedKey, "true");
        }

        // ✅ FINISHED
        if (
            now >= end &&
            !localStorage.getItem(doneKey)
        ) {
            notifyUser(`✅ ${b.service} is done!`);
            localStorage.setItem(doneKey, "true");
        }
    });
}
function enablePushNotifications() {
    if (!("Notification" in window)) {
        alert("This browser does not support desktop notifications");
        return;
    }

    if (Notification.permission === "denied") {
        showToast("🔕 Notifications are blocked in your browser settings");
        return;
    }

    Notification.requestPermission().then(async (permission) => {
        if (permission !== "granted") {
            console.log("Notification permission denied.");
            return;
        }

        console.log("Notification permission granted!");

        try {
            // ✅ Register the FCM service worker in its own scope so it does not
            // replace /sw.js — both service workers then coexist.
            const registration = await navigator.serviceWorker.register(
                "/firebase-messaging-sw.js",
                { scope: "/fcm-push-scope/" }
            );

            const token = await getToken(messaging, {
                vapidKey: "BCEWQ3ZEFYTmiG7UWUw5D8x6-0TlmTkjhR1I2AROSeWHVDVl1MwJXxmPqj3-wdkicQnJARjzkJMXPvBMvTsxKIc",
                serviceWorkerRegistration: registration
            });

            if (!token) {
                console.log("❌ No FCM token received");
                return;
            }

            // 🔥 Without this the server has no token to push to!
            await saveUserToken(token);

            showToast("🔔 Alerts enabled — you'll be notified about your bookings");
        } catch (error) {
            console.error("❌ FCM error:", error);
        }
    });
}

// Wire up every "Enable Alerts" button (desktop + mobile menu)
document.querySelectorAll(".js-enable-alerts").forEach(btn => {
    btn.addEventListener("click", enablePushNotifications);
});

function notifyUser(message) {
    // 🔔 Browser notification via the service worker — `new Notification()`
    // throws "Illegal constructor" on Android Chrome
    showAppNotification("SmartBook", { body: message });

    // 🔊 Sound
    const audio = new Audio("images/alarm.wav");
    audio.play().catch(() => {});

    // ✅ Always show in-app toast (works even if notifications are blocked)
    showToast(message);
}

// 📊 UPDATE STATS
function updateStats() {
    const now = new Date();

    const total = bookings.length;

    const active = bookings.filter(b => {
        const start = new Date(b.startTime);
        const end = new Date(b.endTime);
        return now >= start && now < end && b.status !== "completed";
    }).length;

    const upcoming = bookings.filter(b => 
        new Date(b.startTime) > now
    ).length;

    const completed = bookings.filter(b => 
        b.status === "completed" || new Date(b.endTime) < now
    ).length;

    document.getElementById("totalBookings").textContent = total;
    document.getElementById("activeBookings").textContent = active;
    document.getElementById("upcomingBookings").textContent = upcoming;
    document.getElementById("completedBookings").textContent = completed;
}

// 🎯 FILTER BOOKINGS
window.filterBookings = function(filter) {
    currentFilter = filter;

    document.querySelectorAll(".tab-btn").forEach(btn => {
        if (btn.dataset.tab === filter) {
            btn.classList.add("tab-active");
        } else {
            btn.classList.remove("tab-active");
        }
    });

    renderBookings();
};

// 🧠 RENDER BOOKINGS
function renderBookings() {
    const container = document.getElementById("bookingsContainer");
    const emptyState = document.getElementById("emptyState");

    let filtered = bookings;
    const now = new Date();

    if (currentFilter === "active") {
        filtered = bookings.filter(b => {
            const start = new Date(b.startTime);
            const end = new Date(b.endTime);
            return now >= start && now < end && b.status !== "completed";
        });
    } 
    else if (currentFilter === "upcoming") {
        filtered = bookings.filter(b => new Date(b.startTime) > now);
    } 
    else if (currentFilter === "completed") {
        filtered = bookings.filter(b => 
            b.status === "completed" || new Date(b.endTime) < now
        );
    } 
    else if (currentFilter === "mine") {
        filtered = bookings.filter(b => b.userId === currentUser.uid);
    }

    if (filtered.length === 0) {
        container.innerHTML = "";
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    // 🎨 Dark-theme status pill styles per state
    const statusStyles = {
        "In Progress": "bg-emerald-400/10 border border-emerald-400/30 text-emerald-300",
        "Completed":   "bg-white/5 border border-white/10 text-slate-400",
        "Upcoming":    "bg-violet-400/10 border border-violet-400/30 text-violet-300"
    };

    container.innerHTML = filtered.map(booking => {
        const start = new Date(booking.startTime);
        const end = new Date(booking.endTime);

        const isActive = now >= start && now < end;
        const isCompleted = now > end || booking.status === "completed";

        let status = isActive ? "In Progress" : isCompleted ? "Completed" : "Upcoming";

        return `
            <div class="card p-6 rounded-2xl">
                <span class="text-xs px-2 py-1 rounded-full ${statusStyles[status]}">
                    ${status}
                </span>

                <h3 class="font-display font-bold text-lg mt-3 text-white">${booking.service}</h3>

                <p class="text-sm text-slate-400 mt-2">
                    ${new Date(booking.date).toLocaleDateString()} - ${booking.time}
                </p>

                <p class="text-xs text-slate-500">
                    Floor: ${booking.floor}
                </p>
                ${booking.service === "Maintenance Support" && booking.notes ? `
                <p class="text-sm text-amber-200/90 mt-2 bg-amber-400/10 border border-amber-400/20 p-2 rounded-lg">
                    🛠 Room ${booking.roomNumber} : ${booking.notes}
                </p>
            ` : ""}

                <p class="text-xs text-slate-500">
                    User: ${usersMap[booking.userId] || "Unknown"}
                </p>

                <p class="text-xs text-slate-500 mt-1">
                    Duration: ${booking.duration} mins
                </p>
                ${booking.userId === currentUser.uid ? `
                    <button onclick="deleteMyBooking('${booking.id}')" 
                        class="mt-4 bg-gradient-to-r from-red-500 to-rose-500 
               text-white px-4 py-1.5 rounded-lg font-medium 
               shadow-lg shadow-red-500/25 
               transition transform hover:scale-105 hover:shadow-red-500/40 active:scale-95 
               focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-midnight">
                        Delete
                    </button>
                ` : ""}
            </div>
        `;
    }).join("");

    lucide.createIcons();
    
}
window.deleteMyBooking = async function(id) {
    const confirmDelete = confirm("Delete this booking?");
    if (!confirmDelete) return;

    try {
        await deleteBooking(id);
        showToast("🗑 Booking deleted");

        bookings = bookings.filter(b => b.id !== id);
        renderBookings();
        updateStats();
    } catch (err) {
        console.error(err);
        showToast("Error deleting booking");
    }
};

// 🚨 ALERT MODAL ACTIONS
window.dismissAlert = function() {
    const modal = document.getElementById("alertModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
};

window.extendBooking = async function() {
    // Extend the current user's active booking by 15 minutes
    const now = new Date();
    const mine = bookings.find(b =>
        b.userId === currentUser.uid &&
        new Date(b.startTime) <= now && now < new Date(b.endTime)
    );

    if (!mine) {
        showToast("No active booking to extend");
        window.dismissAlert();
        return;
    }

    try {
        await extendBookingTime(mine.id, 15);
        showToast("⏱ Booking extended by 15 minutes");

        mine.endTime = new Date(new Date(mine.endTime).getTime() + 15 * 60000).toISOString();
        updateStats();
        renderBookings();
    } catch (err) {
        console.error(err);
        showToast("Could not extend booking");
    }

    window.dismissAlert();
};
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