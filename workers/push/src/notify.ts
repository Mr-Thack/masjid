interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: string,
  vapidDetails: {
    subject: string;
    publicKey: string;
    privateKey: string;
  },
): Promise<void> {
  const postData = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    payload,
    vapidDetails,
  };

  try {
    await fetch('https://push-service.fake/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData),
    });
  } catch (err) {
    console.error('sendPushNotification failed:', err);
  }
}