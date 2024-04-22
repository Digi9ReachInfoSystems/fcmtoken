const express = require("express");
const admin = require("firebase-admin");
const app = express();
require("dotenv").config();

app.use(express.json()); // Middleware to parse JSON bodies

// Check if the required environment variable is loaded
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
  process.exit(1); // Exit if the configuration is not available
}

// Initialize Firebase Admin with service account
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("ascii")
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Define the route for sending notifications
app.post("/send-notification", async (req, res) => {
  const { userReference, couponName } = req.body;

  if (!userReference || !couponName) {
    return res
      .status(400)
      .send({ message: "Missing userReference or couponName" });
  }

  try {
    const userDoc = await db.collection("Users").doc(userReference).get();
    if (!userDoc.exists) {
      return res.status(404).send({ message: "User not found" });
    }

    const tokensCollection = await db
      .collection("Users")
      .doc(userReference)
      .collection("fcm_tokens")
      .get();
    if (tokensCollection.empty) {
      return res.status(404).send({ message: "No FCM tokens found for user" });
    }

    const userToken = tokensCollection.docs[0].data().fcm_token;
    if (!userToken) {
      return res
        .status(404)
        .send({ message: "FCM token not found or invalid" });
    }

    const message = {
      notification: {
        title: "Special Offer",
        body: `Hello! Here's a special coupon just for you: ${couponName}`,
      },
      token: userToken,
    };

    const response = await admin.messaging().send(message);
    res.status(200).send({
      message: "Notification sent successfully",
      response: response,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).send({
      message: "Failed to send notification",
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
