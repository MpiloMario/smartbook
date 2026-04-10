import { auth, getBookings, getUsers,deleteBooking,showToast } from "./database.js";
import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

lucide.createIcons();

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
function requestNotificationPermission() {
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notification");
        } else if (Notification.permission === "granted") {
            console.log("Notification permission already granted.");
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log("Notification permission granted!");
                } else {
                    console.log("Notification permission denied.");
                }
            });
        }
    }
    document.getElementById('alert').addEventListener('click',requestNotificationPermission);
function notifyUser(message) {
    // 🔔 Browser notification (if permitted)
    if (Notification.permission === "granted") {
        new Notification("SmartBook", {
            body: message,
            icon: "icons/icon-256.png"
        });
    }

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
            btn.classList.add("bg-white", "text-gray-900", "shadow-sm");
        } else {
            btn.classList.remove("bg-white", "text-gray-900", "shadow-sm");
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

    container.innerHTML = filtered.map(booking => {
        const start = new Date(booking.startTime);
        const end = new Date(booking.endTime);

        const isActive = now >= start && now < end;
        const isCompleted = now > end || booking.status === "completed";

        let status = isActive ? "In Progress" : isCompleted ? "Completed" : "Upcoming";
        let color = isActive ? "green" : isCompleted ? "gray" : "indigo";

        return `
            <div class="bg-white p-6 rounded-2xl shadow border">
                <span class="text-xs px-2 py-1 rounded bg-${color}-100 text-${color}-700">
                    ${status}
                </span>

                <h3 class="font-bold text-lg mt-2">${booking.service}</h3>

                <p class="text-sm text-gray-600 mt-2">
                    ${new Date(booking.date).toLocaleDateString()} - ${booking.time}
                </p>

                <p class="text-xs text-gray-500">
                    Floor: ${booking.floor}
                </p>
                ${booking.service === "Maintenance Support" && booking.notes ? `
                <p class="text-sm text-gray-500 mt-2 bg-yellow-50 p-2 rounded">
                    🛠 Room ${booking.roomNumber} : ${booking.notes}
                </p>
            ` : ""}

                <p class="text-xs text-gray-500">
                    User: ${usersMap[booking.userId] || "Unknown"}
                </p>

                <p class="text-xs text-gray-500 mt-1">
                    Duration: ${booking.duration} mins
                </p>
                ${booking.userId === currentUser.uid ? `
                    <button onclick="deleteMyBooking('${booking.id}')" 
                        class="bg-gradient-to-r from-red-600 to-red-500 
               text-white px-4 py-1.5 rounded-lg font-medium 
               shadow-md hover:shadow-lg 
               transition transform hover:scale-105 active:scale-95 
               focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2">
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
        alert("Deleted!");

        bookings = bookings.filter(b => b.id !== id);
        renderBookings();
        updateStats();
    } catch (err) {
        console.error(err);
        alert("Error deleting booking");
    }
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