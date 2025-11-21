import { inngest } from "./client";
import { generateAutoResponse } from "@/lib/autoResponder";

/**
 * Background job to process WhatsApp auto-responses
 * This runs outside the serverless function timeout limit
 */
export const processWhatsAppMessage = inngest.createFunction(
  {
    id: "process-whatsapp-message",
    name: "Process WhatsApp Message",
  },
  { event: "whatsapp/message.received" },
  async ({ event, step }) => {
    const { phoneNumber, messageText, messageId } = event.data;

    console.log(`[Inngest] Processing message from ${phoneNumber}`);

    // Step 1: Generate auto-response (this can take time, no timeout!)
    const result = await step.run("generate-response", async () => {
      return await generateAutoResponse(phoneNumber, messageText, messageId);
    });

    // Step 2: Log the result
    await step.run("log-result", async () => {
      if (result.success && result.sent) {
        console.log(`[Inngest] ✅ Message sent successfully to ${phoneNumber}`);
        return { status: "sent", phoneNumber };
      } else if (result.noDocuments) {
        console.log(`[Inngest] ℹ️ No documents for ${phoneNumber}`);
        return { status: "no_documents", phoneNumber };
      } else {
        console.log(`[Inngest] ❌ Failed: ${result.error}`);
        return { status: "failed", error: result.error };
      }
    });

    return result;
  }
);
