const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendBookingReminders = onSchedule("every 1 minutes", async () => {
    const now = Date.now();
    const db = admin.firestore();

    const snapshot = await db.collection("bookings").get();

    for(const doc of snapshot.docs){
        const booking = doc.data();

        if (!booking.alertsEnabled) return;

        const start = new Date(booking.startTime).getTime();
        const end = new Date(booking.endTime).getTime();

        const fiveMin = 5 * 60 * 1000;

        const userDoc = await db.collection("users").doc(booking.userId).get();
        const token = userDoc.data()?.fcmToken;

        if (!token) return;

        // ⏳ 5 MIN BEFORE START
        if (start - fiveMin <= now && start > now) {
            await admin.messaging().send({
                token,
                notification: {
                    title: "⏳ Booking Starting Soon",
                    body: `${booking.service} starts in 5 minutes`
                }
            });
        }

        // ⚠️ 5 MIN BEFORE END
        if (end - fiveMin <= now && end > now) {
            await admin.messaging().send({
                token,
                notification: {
                    title: "⚠️ Almost Done",
                    body: `${booking.service} ends in 5 minutes`
                }
            });
        }

        const ref = db.collection("bookings").doc(doc.id);

// Example for "finished"
if (now >= end && !booking.finishedNotified) {
    await admin.messaging().send({
        token,
        notification: {
            title: "✅ Finished",
            body: `${booking.service} is done!`
        }
    });

    await ref.update({ finishedNotified: true }); // ✅ prevent duplicates
}
    };
});