import { z } from "zod";

import { Constants } from "../utils/constants";

export const registrationSchema = z.object({
  email: z.email().nonempty(),
  name: z.string().nonempty(),
  password: z
    .string()
    .nonempty()
    .regex(/^(?=.*[a-zA-Z])[\w\W]{8,}$/, Constants.MESSAGES.PASSWORD_RULE),
  provider: z.string().nonempty(),
  sex: z.enum([Constants.FEMALE, Constants.MALE, Constants.OTHER]),
});
