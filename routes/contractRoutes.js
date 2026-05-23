// routes/contractRoutes.js

import express from "express";

const router = express.Router();

/**
 * Services
 */
import {
  createContract,
  getAllContracts,
  getContractById,
  updateContract,
  deleteContract,
} from "../services/contractService.js";

/**
 * -----------------------------------------
 * POST /contracts
 * Create new contract
 * -----------------------------------------
 */
router.post(
  "/",
  async (req, res) => {
    try {
      const result =
        await createContract(
          req.body
        );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(201).json({
        success: true,
        contract:
          result.contract,
      });
    } catch (error) {
      console.error(
        "Create Contract Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to create contract",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /contracts
 * Get all contracts
 * -----------------------------------------
 */
router.get(
  "/",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      return res.status(200).json({
        success: true,
        contracts,
      });
    } catch (error) {
      console.error(
        "Get Contracts Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to fetch contracts",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /contracts/:id
 * Get contract by ID
 * -----------------------------------------
 */
router.get(
  "/:id",
  async (req, res) => {
    try {
      const contract =
        await getContractById(
          req.params.id
        );

      if (!contract) {
        return res.status(404).json({
          success: false,
          error:
            "Contract not found",
        });
      }

      return res.status(200).json({
        success: true,
        contract,
      });
    } catch (error) {
      console.error(
        "Get Contract Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to fetch contract",
      });
    }
  }
);

/**
 * -----------------------------------------
 * PUT /contracts/:id
 * Update contract
 * -----------------------------------------
 */
router.put(
  "/:id",
  async (req, res) => {
    try {
      const result =
        await updateContract(
          req.params.id,
          req.body
        );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        contract:
          result.contract,
      });
    } catch (error) {
      console.error(
        "Update Contract Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to update contract",
      });
    }
  }
);

/**
 * -----------------------------------------
 * DELETE /contracts/:id
 * Delete contract
 * -----------------------------------------
 */
router.delete(
  "/:id",
  async (req, res) => {
    try {
      const result =
        await deleteContract(
          req.params.id
        );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Contract deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete Contract Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to delete contract",
      });
    }
  }
);

export default router;
