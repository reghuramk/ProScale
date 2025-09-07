// services/emailVerification.service.ts
import jwt from "jsonwebtoken";

import { sendEmailVerificationEvent } from "../kafka/metricProducer";

export async function initiateEmailVerification(email: string) {
  const token = jwt.sign(
    { email },
    process.env.EMAIL_VERIFICATION_SECRET ?? "",
    { expiresIn: "15m" },
  );

  await sendEmailVerificationEvent({ email, token });
}
