import jwt from "jsonwebtoken";

import { Constants } from "./constants";

const { MESSAGES } = Constants;

export const signAccessToken = (userId: string) => {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error(MESSAGES.ACCESS_TOKEN_SECRET_UNDEFINED);
  }
  return jwt.sign({ userId }, secret, {
    expiresIn: "15m",
  });
};

export const signRefreshToken = (userId: string) => {
  const secret = process.env.REFRESH_TOKEN_SECRET;
  if (!secret) {
    throw new Error(MESSAGES.REFRESH_TOKEN_SECRET_UNDEFINED);
  }
  return jwt.sign({ userId }, secret, {
    expiresIn: "7d",
  });
};
