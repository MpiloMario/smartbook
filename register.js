// register.js
import { registerUser } from "./database.js";

document.getElementById("registerBtn").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    try {
        console.log("Starting registration...");
        const username = document.getElementById("username").value;
        const room = document.getElementById("roomNumber").value;

        const result = await registerUser(email, password,username,room);

        console.log("User created:", result);
        alert("Registered successfully!");
        window.location.href = "index.html";

    } catch (error) {
        console.error("REGISTER ERROR:", error); // 🔥 IMPORTANT
        alert(error.message);
    }
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("Service Worker Registered"))
    .catch(err => console.error("SW failed:", err));
}