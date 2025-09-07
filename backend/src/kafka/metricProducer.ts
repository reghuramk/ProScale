import { Kafka } from "kafkajs";

const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKER ?? "localhost:9092"],
  clientId: "auth-service",
});
const producer = kafka.producer();

export const sendEmailVerificationEvent = async (payload: {
  email: string;
  token: string;
}) => {
  await producer.connect();
  await producer.send({
    messages: [{ value: JSON.stringify(payload) }],
    topic: "email-verification",
  });
  await producer.disconnect();
};
