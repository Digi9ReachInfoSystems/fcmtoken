const express = require("express");
const admin = require("firebase-admin");
const app = express();
require("dotenv").config();

app.use(express.json()); // Middleware to parse JSON bodies

// Initialize Firebase Admin with service account
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("ascii")
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.post("/send-notification", async (req, res) => {
  const { userReference, couponName } = req.body;

  if (!userReference || !couponName) {
    return res
      .status(400)
      .send({ message: "Missing userReference or couponName" });
  }

  try {
    console.log("Fetching user document by reference:", userReference);
    const userDoc = await db.collection("Users").doc(userReference).get();
    if (!userDoc.exists) {
      console.log("No user found for the given reference:", userReference);
      return res.status(404).send({ message: "User not found" });
    }

    console.log("Accessing FCM tokens subcollection for user:", userReference);
    const tokensCollection = await db
      .collection("Users")
      .doc(userReference)
      .collection("fcm_tokens")
      .get();
    if (tokensCollection.empty) {
      console.log("No FCM tokens found for user:", userReference);
      return res.status(404).send({ message: "No FCM tokens found for user" });
    }

    const userToken = tokensCollection.docs[0].data().fcm_token;
    if (!userToken) {
      console.log("FCM token in the first document is null or undefined.");
      return res
        .status(404)
        .send({ message: "FCM token not found or invalid" });
    }

    console.log("FCM Token to be used for sending notification:", userToken);
    const message = {
      notification: {
        title: "Special Offer",
        body: `Hello! Here's a special coupon just for you: ${couponName}`,
      },
      token: userToken,
    };

    console.log("Sending notification with the message:", message);
    const response = await admin.messaging().send(message);
    console.log("Notification sent successfully, Firebase response:", response);
    res.status(200).send({
      message: "Notification sent successfully",
      response: response,
    });
  } catch (error) {
    console.error("Error sending notification:", error); // Debug: Print error to console
    if (
      error.errorInfo &&
      error.errorInfo.code === "messaging/registration-token-not-registered"
    ) {
      // Token is no longer valid
      console.log(
        "The FCM token is no longer valid and will be marked or removed."
      );
      // Here you could mark the token as invalid in your database or attempt to notify the client to regenerate a token
    }
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
