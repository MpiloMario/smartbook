const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

async function sendToUserTokens(userDoc, notification) {
  const userData = userDoc.data();

  const tokensMap = userData?.fcmTokens || {};
  const oldToken = userData?.fcmToken;

  let tokens = Object.keys(tokensMap);

  if (oldToken && !tokens.includes(oldToken)) {
    tokens.push(oldToken);
  }

  if (!tokens.length) return;

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification
  });

  console.log("Sent:", response.successCount, "Failed:", response.failureCount);
}

exports.sendBookingReminders = onSchedule("every 1 minutes", async () => {
  const now = Date.now();
  const db = admin.firestore();

  const snapshot = await db.collection("bookings").get();

  for (const doc of snapshot.docs) {
    const booking = doc.data();
    const ref = db.collection("bookings").doc(doc.id);

    if (!booking.alertsEnabled) continue;

    const start = new Date(booking.startTime).getTime();
    const end = new Date(booking.endTime).getTime();

    const fiveMin = 5 * 60 * 1000;
    const oneMin = 60 * 1000;

    const userDoc = await db.collection("users").doc(booking.userId).get();

    if (!userDoc.exists) continue;

    if (
      now >= start - fiveMin &&
      now <= start - fiveMin + oneMin &&
      !booking.startNotified
    ) {
      await sendToUserTokens(userDoc, {
        title: "⏳ Booking Starting Soon",
        body: `${booking.service} at ${booking.floor} starts in 5 minutes`
      });

      await ref.update({ startNotified: true });
    }

    if (
      now >= end - fiveMin &&
      now <= end - fiveMin + oneMin &&
      !booking.endNotified
    ) {
      await sendToUserTokens(userDoc, {
        title: "⚠️ Almost Done",
        body: `${booking.service} at ${booking.floor} ends in 5 minutes`
      });

      await ref.update({ endNotified: true });
    }

    if (
      now >= start &&
      now <= start + oneMin &&
      !booking.startedNotified
    ) {
      await sendToUserTokens(userDoc, {
        title: "🚀 Booking Started",
        body: `${booking.service} on ${booking.floor} has started! You have ${booking.duration} minutes.`
      });

      await ref.update({ startedNotified: true });
    }

    if (now >= end && !booking.finishedNotified) {
      await sendToUserTokens(userDoc, {
        title: "✅ Finished",
        body: `${booking.service} at ${booking.floor} is done!`
      });

      await ref.update({ finishedNotified: true });
    }
  }
});