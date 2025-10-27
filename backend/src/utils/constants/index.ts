export const Constants = {
  ENVIRONMENT: {
    DEVELOPMENT: "DEVELOPMENT",
    PRODUCTION: "PRODUCTION",
  },
  FEMALE: "female",
  MALE: "male",
  MESSAGES: {
    ACCESS_TOKEN_SECRET_UNDEFINED: "ACCESS_TOKEN_SECRET is not defined",
    ERROR_CREATING_USER: "Cannot create user",
    ERROR_LISTING_INSTANCES: "Cannot fetch Instance List",
    ERROR_STARTING_INSTANCE: "Cannot start the Instance",
    ERROR_STOPPING_INSTANCE: "Cannot stop the Instance",
    GOOGLE_SIGN_IN_FAILED: "Google sign in failed",
    INSTANCE_LIST_FETCHED: "Instances List fetched succesfully",
    INSTANCE_STARTED: "The instance has been started succesully",
    INSTANCE_STOPPED: "The instance has been stoped succesully",
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
    INFRA: {
      BASE: "/infrastructure",
      LIST_INSTANCES: "/infrastructure/instances",
      START_INSTANCE: "/infrastructure/start/:instanceId",
      STOP_INSTANCE: "/infrastructure/stop/:instanceId",
    },
  },
  TOKENS: {
    ACCESS_TOKEN: "access_token",
    REFRESH_TOKEN: "refresh_token",
  },
};
