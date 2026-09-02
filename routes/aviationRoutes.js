import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { createAviationDataService } from "../services/aviation/aviationDataService.js";

export function createAviationRouter(service = createAviationDataService()) {
  const router = express.Router();
  router.use(authenticateUser, requireOrganizationMembership, requireOrganizationPermission("contract:read"));

  router.get("/status", async (req, res) => {
    const status = await service.getStatus({ organizationId: req.auth.organizationId });
    res.json({ success: true, aviation: status });
  });

  router.get("/aircraft", async (req, res, next) => {
    try {
      const result = await service.listAircraft({
        organizationId: req.auth.organizationId,
        companyOnly: req.query.scope === "company",
      });
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  });

  router.get("/aircraft/:id/intelligence", async (req, res, next) => {
    try {
      const intelligence = await service.getAircraftIntelligence({ organizationId: req.auth.organizationId, aircraftId: req.params.id });
      if (!intelligence) return res.status(404).json({ success: false, code: "AIRCRAFT_NOT_FOUND", error: "Aircraft not found" });
      return res.json({ success: true, intelligence });
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ success: false, code: "INVALID_AIRCRAFT_ID", error: error.message });
      return next(error);
    }
  });

  router.get("/weather", async (req, res, next) => {
    try {
      const weather = await service.getWeather({ organizationId: req.auth.organizationId, bounds: req.query.bounds || null });
      res.json({ success: true, weather });
    } catch (error) { next(error); }
  });

  return router;
}

export default createAviationRouter();