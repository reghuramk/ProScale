import sgMail from "@sendgrid/mail";
import { Kafka } from "kafkajs";

sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? "");

const kafka = new Kafka({
  brokers: ["localhost:9092"],
  clientId: "email-worker",
});
const consumer = kafka.consumer({ groupId: "email-group" });

async function run() {
  await consumer.connect();
  await consumer.subscribe({
    fromBeginning: false,
    topic: "email-verification",
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        console.error("Received message with null value");
        return;
      }
      interface EmailVerificationPayload { email: string; token: string };
      const { email, token } = JSON.parse(
        message.value.toString(),
      ) as EmailVerificationPayload;

      const frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl) {
        throw new Error("FRONTEND_URL environment variable is not set");
      }
      const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
      await sgMail.send({
        from: "noreply@yourdomain.com",
        html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email</p>`,
        subject: "Verify Your Email",
        to: email,
      });
    },
  });
}

run().catch(console.error);
