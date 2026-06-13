import { Queue, Worker } from "bullmq";
import redis from "./redisClient.js";
import { generateContractCopilot } from "../contractCopilotEngine.js";

/**
 * =========================================
 * CONTRACT PROCESSING QUEUE
 * =========================================
 */

export const contractQueue = new Queue("contract-analysis", {
  connection: redis,
});

/**
 * WORKER (async processing)
 */

const worker = new Worker(
  "contract-analysis",
  async (job) => {
    const { contract, tenant } = job.data;

    console.log("📦 Processing contract job:", job.id);

    const result = await generateContractCopilot({
      contract,
      tenant,
    });

    return result;
  },
  {
    connection: redis,
  }
);

worker.on("completed", (job) => {
  console.log(`✅ Job completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job failed: ${job.id}`, err.message);
});