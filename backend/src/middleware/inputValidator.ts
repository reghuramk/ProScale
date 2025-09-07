import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";

export const validate =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = error._zod.def.map((e) => ({
          input: e.path.join("."),
          message: e.message,
        }));
        return res.status(400).json({ errors: formatted });
      }
    }
  };
