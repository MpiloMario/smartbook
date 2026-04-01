const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendBookingReminders = onSchedule("every 1 minutes", async () => {
    const now = Date.now();
    const db = admin.firestore();

    const snapshot = await db.collection("bookings").get();

    for(const doc of snapshot.docs){
        const booking = doc.data();

        if (!booking.alertsEnabled) continue;

        const start = new Date(booking.startTime).getTime();
        const end = new Date(booking.endTime).getTime();

        const fiveMin = 5 * 60 * 1000;
        const oneMin = 60*1000;

        const userDoc = await db.collection("users").doc(booking.userId).get();
        const token = userDoc.data()?.fcmToken;

        if (!token) continue;

        // ⏳ 5 MIN BEFORE START
        if (now>= (start - fiveMin)&& now<= (start -fiveMin+oneMin)&&!booking.startNotified) {
            await admin.messaging().send({
                token,
                notification: {
                    title: "⏳ Booking Starting Soon",
                    body: `${booking.service} as ${booking.floor} starts in 5 minutes`
                }
            });
            await ref.update({ startNotified: true }); // ✅ prevent duplicates
        }

        // ⚠️ 5 MIN BEFORE END
        if (now>=(end - fiveMin)&&now<=(end-fiveMin+oneMin)&&!booking.endNotified) {
            await admin.messaging().send({
                token,
                notification: {
                    title: "⚠️ Almost Done",
                    body: `${booking.service} at ${booking.floor} ends in 5 minutes`
                }
            });
            await ref.update({ endNotified: true }); // ✅ prevent duplicates
        }

        const ref = db.collection("bookings").doc(doc.id);

// Example for "finished"
if (now >= end && !booking.finishedNotified) {
    await admin.messaging().send({
        token,
        notification: {
            title: "✅ Finished",
            body: `${booking.service} at ${booking.floor} is done!`
        }
    });

    await ref.update({ finishedNotified: true }); // ✅ prevent duplicates
}
    };
});