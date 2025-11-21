import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processWhatsAppMessage } from "@/inngest/functions";

// Serve Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processWhatsAppMessage],
});
