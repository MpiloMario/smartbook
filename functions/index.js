const { onSchedule } = require("firebase-functions/v2/scheduler");
const { FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const ICON = "/icons/icon-256.png";
const BADGE = "/icons/icon-72.png";
const LINK = "/dashboard.html";
const FIVE_MIN = 5 * 60 * 1000;
const START_GRACE = 10 * 60 * 1000; // don't fire a "started" alert more than 10 min late
const STALE_WINDOW = 24 * 60 * 60 * 1000; // ignore bookings that ended > 24h ago

function webpushConfig(tag) {
  return {
    notification: {
      icon: ICON,
      badge: BADGE,
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag
    },
    fcmOptions: { link: LINK }
  };
}

async function sendToUserTokens(userDoc, notification, tag) {
  const userData = userDoc.data();

  const tokensMap = userData?.fcmTokens || {};
  const oldToken = userData?.fcmToken;

  let tokens = Object.keys(tokensMap);

  if (oldToken && !tokens.includes(oldToken)) {
    tokens.push(oldToken);
  }

  if (!tokens.length) return;

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification,
      webpush: webpushConfig(tag)
    });

    console.log("Sent:", response.successCount, "Failed:", response.failureCount);

    // 🧹 Remove tokens FCM reports as no longer registered (expired browsers etc.)
    const deadTokens = response.responses
      .map((r, i) =>
        !r.success && r.error?.code === "messaging/registration-token-not-registered"
          ? tokens[i]
          : null
      )
      .filter(Boolean);

    if (deadTokens.length) {
      const updates = {};
      deadTokens.forEach(token => {
        updates[`fcmTokens.${token}`] = FieldValue.delete();
      });
      await userDoc.ref.update(updates);
    }
  } catch (error) {
    // One bad token/user must never abort the whole reminder run
    console.error("Messaging error:", error.message);
  }
}

exports.sendBookingReminders = onSchedule("every 1 minutes", async () => {
  const now = Date.now();
  const db = admin.firestore();

  const snapshot = await db.collection("bookings").get();

  for (const doc of snapshot.docs) {
    const booking = doc.data();
    const ref = db.collection("bookings").doc(doc.id);

    if (!booking.alertsEnabled) continue;
    if (!booking.startTime || !booking.endTime || !booking.userId) continue;

    const start = new Date(booking.startTime).getTime();
    const end = new Date(booking.endTime).getTime();

    if (Number.isNaN(start) || Number.isNaN(end)) continue;

    // Skip long-past bookings — mark them silently instead of spamming old alerts
    if (now >= end && now - end > STALE_WINDOW) {
      await ref.update({
        startNotified: true,
        endNotified: true,
        startedNotified: true,
        finishedNotified: true
      });
      continue;
    }

    const userDoc = await db.collection("users").doc(booking.userId).get();

    if (!userDoc.exists) continue;

    const service = booking.service || "Booking";
    const floor = booking.floor || "";

    // ⏳ 5 min BEFORE START — flag-based so a delayed run still delivers the alert
    if (now >= start - FIVE_MIN && now < start && !booking.startNotified) {
      await sendToUserTokens(
        userDoc,
        {
          title: "⏳ Booking Starting Soon",
          body: `${service} at ${floor} starts in 5 minutes`
        },
        `${doc.id}-start`
      );

      await ref.update({ startNotified: true });
    }

    // ⚠️ 5 min BEFORE END
    if (now >= end - FIVE_MIN && now < end && !booking.endNotified) {
      await sendToUserTokens(
        userDoc,
        {
          title: "⚠️ Almost Done",
          body: `${service} at ${floor} ends in 5 minutes`
        },
        `${doc.id}-end`
      );

      await ref.update({ endNotified: true });
    }

    // 🚀 STARTED — fires as soon as a run happens at/after the start time
    if (now >= start && !booking.startedNotified) {
      if (now <= start + START_GRACE) {
        await sendToUserTokens(
          userDoc,
          {
            title: "🚀 Booking Started",
            body: `${service} on ${floor} has started! You have ${booking.duration} minutes.`
          },
          `${doc.id}-started`
        );
      }

      await ref.update({ startedNotified: true });
    }

    // ✅ FINISHED
    if (now >= end && !booking.finishedNotified) {
      await sendToUserTokens(
        userDoc,
        {
          title: "✅ Finished",
          body: `${service} at ${floor} is done!`
        },
        `${doc.id}-finished`
      );

      await ref.update({ finishedNotified: true });
    }
  }
});
