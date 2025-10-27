import { Router } from "express";

import * as InfrastructureController from "../controller/infrastructure.controller";
import { Constants } from "../utils/constants";

const { ROUTES } = Constants;

const router = Router();

router.get(
  ROUTES.INFRA.LIST_INSTANCES.replace(ROUTES.INFRA.BASE, ""),
  InfrastructureController.listInstances,
);
router.post(
  ROUTES.INFRA.START_INSTANCE.replace(ROUTES.INFRA.BASE, ""),
  InfrastructureController.startInstance,
);
router.post(
  ROUTES.INFRA.STOP_INSTANCE.replace(ROUTES.INFRA.BASE, ""),
  InfrastructureController.stopInstance,
);

export default router;
