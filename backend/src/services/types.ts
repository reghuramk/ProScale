export interface GoogleSigninResponseType {
  email: string;
  googleId: string;
  name: string;
  picture: string;
}
export interface InstanceIdType {
  instanceId: string;
}

export interface InstanceInfoType {
  id: string;
  launchTime?: Date;
  state?: string;
  type?: string;
}

export interface RegisterResponseType {
  accessToken: string;
  refreshToken: string;
  user: UserType;
}

export interface UserType {
  email: string;
  id?: string;
  idToken?: string;
  name?: string;
  password?: string;
  provider?: string;
  sex?: "female" | "male" | "other";
}
