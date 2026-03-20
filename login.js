import { loginUser} from "./database.js";

document.getElementById("loginBtn").addEventListener("click", async () => {
    const email = document.getElementById("email").value; // FIXED
    const password = document.getElementById("password").value;

    try {
        const userCredential = await loginUser(email, password);

        localStorage.setItem("currentUser", userCredential.user.uid);

        alert("Login successful!");
        window.location.href = "index.html";
    } catch (error) {
        alert(error.message);
    }
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("Service Worker Registered"))
    .catch(err => console.error("SW failed:", err));
}