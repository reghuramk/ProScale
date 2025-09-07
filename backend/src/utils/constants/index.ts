export const Constants = {
  ENVIRONMENT: {
    DEVELOPMENT: "DEVELOPMENT",
    PRODUCTION: "PRODUCTION",
  },
  FEMALE: "female",
  MALE: "male",
  MESSAGES: {
    ACCESS_TOKEN_SECRET_UNDEFINED: "ACCESS_TOKEN_SECRET is not defined",
    GOOGLE_SIGN_IN_FAILED: "Google sign in failed",
    INTERNAL_SERVER_ERROR: "Internal Server Error",
    INVALID_GOOGLE_TOKEN: "Invalid Google token",
    INVALID_TOKEN: "Invalid Token",
    PASSWORD_RULE:
      "Password must be at least 8 characters and include at least one letter",
    REDIS_URL_UNDEFINED: "REDIS_URL environment variable is not defined",
    REFRESH_TOKEN_SECRET_UNDEFINED: "REFRESH_TOKEN_SECRET is not defined",
    ROUTE_NOT_FOUND: "Route not found",
    UNAUTHORISED: "Unauthorized",
    USER_INSERT_FAILED: "User insert failed",
    USER_INSERT_SUCCEEDED: "User created succesfully",
  },
  OTHER: "other",
  ROUTES: {
    AUTH: {
      BASE: "/api/auth",
      LOGIN: "/api/auth/login",
      REGISTER: "/api/auth/register",
    },
    DASHBOARD: {
      BASE: "/api/dashboard",
      STATS: "/stats",
    },
  },
  TOKENS: {
    ACCESS_TOKEN: "access_token",
    REFRESH_TOKEN: "refresh_token",
  },
};
