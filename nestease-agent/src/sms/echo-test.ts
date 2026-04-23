/**
 * Phase 0 Validation: Telnyx SMS outbound test
 * Sends a test SMS to verify outbound delivery works.
 * Inbound (webhook) is tested via the Fastify server + ngrok/Railway.
 */

import { config } from "../config.js";
import { sendSMS } from "./sender.js";

const TEST_PHONE = process.env.TEST_PHONE_NUMBER || "+15555550100";

async function main() {
  console.log("=== Phase 0: Telnyx SMS Outbound Test ===\n");
  console.log(`  From: ${config.telnyxPhoneNumber}`);
  console.log(`  To: ${TEST_PHONE}\n`);

  const success = await sendSMS(TEST_PHONE, "[龙虾 Phase 0] 测试短信 - 如果你收到这条，说明 Telnyx outbound 正常工作");

  if (success) {
    console.log("\n✓ SMS sent successfully. Check your phone.");
  } else {
    console.log("\n✗ SMS send failed. Check Telnyx credentials.");
  }
}

main().catch(console.error);
