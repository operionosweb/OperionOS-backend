import express from "express";
import { requireOciAccess } from "../middleware/ociAccessMiddleware.js";
import { createOciService } from "../services/ociService.js";

export function createOciRouter(service = createOciService(), authorize = requireOciAccess) {
  const router = express.Router();
  router.use(authorize);
  const actor = req => req.auth?.userId ?? req.oci?.userId ?? req.user?.id;
  const endpoint = handler => async (req, res, next) => {
    try { await handler(req, res); }
    catch (error) {
      if (error.status && error.status >= 400 && (error.status < 500 || error.code === "OCI_SETTINGS_UNAVAILABLE"))
        return res.status(error.status).json({ success: false, code: error.code, error: error.message });
      return next(error);
    }
  };
  router.get("/schema", endpoint(async (req, res) => res.json({ success: true, ...await service.schema() })));
  router.get("/geography/options", endpoint(async (req, res) => res.json({ success: true, ...await service.geographyOptions(req.query) })));
  router.get("/dashboard", endpoint(async (req, res) => res.json({ success: true, ...await service.dashboard(req.query) })));
  router.post("/recommendations/:kind/:id/accept", endpoint(async (req, res) =>
    res.status(201).json({ success: true, record: await service.acceptRecommendation(req.params.kind, req.params.id, req.body, actor(req)) })));
  router.get("/records/:kind", endpoint(async (req, res) => res.json({ success: true, ...await service.listRecords(req.params.kind, req.query) })));
  router.post("/records/:kind", endpoint(async (req, res) => res.status(201).json({ success: true, record: await service.createRecord(req.params.kind, req.body, actor(req)) })));
  router.patch("/records/:kind/:id", endpoint(async (req, res) => res.json({ success: true, record: await service.updateRecord(req.params.kind, req.params.id, req.body, actor(req)) })));
  router.delete("/records/:kind/:id", endpoint(async (req, res) => res.json({ success: true, record: await service.archiveRecord(req.params.kind, req.params.id, req.body, actor(req)) })));
  router.post("/records/contacts/:id/erase", endpoint(async (req, res) => res.json({ success: true, record: await service.eraseContact(req.params.id, req.body, actor(req)) })));
  router.get("/audit", endpoint(async (req, res) => res.json({ success: true, events: await service.audit(req.query) })));
  router.get("/settings/stages", endpoint(async (req, res) => res.json({ success: true, stages: await service.getStages() })));
  router.put("/settings/stages", endpoint(async (req, res) => res.json({ success: true, stages: await service.setStages(req.body, actor(req)) })));
  return router;
}
export default createOciRouter();
