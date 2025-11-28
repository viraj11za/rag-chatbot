import { supabase } from "./supabaseClient";
import { embedText } from "./embeddings";
import { retrieveRelevantChunksFromFiles } from "./retrieval";
import { getFilesForPhoneNumber } from "./phoneMapping";
import { sendWhatsAppMessage } from "./whatsappSender";
import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

export type AutoResponseResult = {
    success: boolean;
    response?: string;
    error?: string;
    noDocuments?: boolean;
    sent?: boolean; // Whether message was sent via WhatsApp
};

/**
 * Generate an automatic response for a WhatsApp message
 * @param fromNumber - The sender's phone number (who sent the message)
 * @param toNumber - The business WhatsApp number (where message was received)
 * @param messageText - The text of the message
 * @param messageId - The unique message ID
 */
export async function generateAutoResponse(
    fromNumber: string,
    toNumber: string,
    messageText: string,
    messageId: string
): Promise<AutoResponseResult> {
    try {
        // 1. Get all documents mapped to this 'to' number (business number)
        const fileIds = await getFilesForPhoneNumber(toNumber);

        if (fileIds.length === 0) {
            console.log(`No documents mapped for business number: ${toNumber}`);
            return {
                success: false,
                noDocuments: true,
                error: "No documents mapped to this business number",
            };
        }

        console.log(`Found ${fileIds.length} document(s) for business number ${toNumber}`);

        // 1.5. Fetch phone mapping details including system prompt and credentials
        const { data: phoneMapping, error: mappingError } = await supabase
            .from("phone_document_mapping")
            .select("system_prompt, intent, rag_files(auth_token, origin)")
            .eq("phone_number", toNumber)
            .limit(1)
            .single();

        if (mappingError || !phoneMapping) {
            console.error("Error fetching phone mapping:", mappingError);
            return {
                success: false,
                error: "Failed to fetch phone mapping details",
            };
        }

        const fileData = Array.isArray(phoneMapping.rag_files)
            ? phoneMapping.rag_files[0]
            : phoneMapping.rag_files;

        if (!fileData) {
            return {
                success: false,
                error: "No file credentials found",
            };
        }

        const { auth_token, origin } = fileData;
        const customSystemPrompt = phoneMapping.system_prompt;

        if (!auth_token || !origin) {
            console.error("File missing 11za credentials");
            return {
                success: false,
                error: "File is missing WhatsApp API credentials",
            };
        }

        // 2. Embed the user query
        const queryEmbedding = await embedText(messageText);

        if (!queryEmbedding) {
            return {
                success: false,
                error: "Failed to generate embedding for message",
            };
        }

        // 3. Retrieve relevant chunks from all mapped documents
        const matches = await retrieveRelevantChunksFromFiles(
            queryEmbedding,
            fileIds,
            5
        );

        if (matches.length === 0) {
            console.log("No relevant chunks found");
        }

        const contextText = matches.map((m) => m.chunk).join("\n\n");

        // 4. Get conversation history for this phone number
        const { data: historyRows } = await supabase
            .from("whatsapp_messages")
            .select("content_text, event_type")
            .eq("from_number", fromNumber)
            .order("received_at", { ascending: true })
            .limit(10); // Last 10 messages

        // Build conversation history (only user messages)
        const history = (historyRows || [])
            .filter(m => m.event_type === "MoMessage" && m.content_text)
            .map(m => ({
                role: "user" as const,
                content: m.content_text
            }));

        // 5. Generate response using Groq with dynamic system prompt
        const defaultSystemPrompt =
            `You are a helpful WhatsApp assistant. Your ONLY job is to answer questions based strictly on the provided document context.\n\n` +
            `STRICT RULES:\n` +
            `- ONLY answer questions using information from the CONTEXT below\n` +
            `- If the answer is not in the CONTEXT, say "I don't have that information in the document"\n` +
            `- NEVER use your general knowledge or make assumptions beyond the document\n` +
            `- NEVER offer to do tasks you cannot do (generate files, make calls, etc.)\n` +
            `- Be concise and friendly - keep responses under 300 words\n` +
            `- Use clear, simple language appropriate for WhatsApp chat\n` +
            `- Format responses with line breaks for readability`;

        const systemPrompt = customSystemPrompt || defaultSystemPrompt;

        const messages = [
            {
                role: "system" as const,
                content: `${systemPrompt}\n\nCONTEXT:\n${contextText || "No relevant context found in the documents."}`
            },
            ...history.slice(-5), // Include last 5 messages for context
            { role: "user" as const, content: messageText }
        ];

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.2,
            max_tokens: 500, // Keep responses concise for WhatsApp
        });

        const response = completion.choices[0].message.content;

        if (!response) {
            return {
                success: false,
                error: "No response generated from LLM",
            };
        }

        // 6. Send the response via WhatsApp using file-specific credentials
        const sendResult = await sendWhatsAppMessage(fromNumber, response, auth_token, origin);

        if (!sendResult.success) {
            console.error("Failed to send WhatsApp message:", sendResult.error);
            // Still mark as attempted in database
            await supabase
                .from("whatsapp_messages")
                .update({
                    auto_respond_sent: false,
                    response_sent_at: new Date().toISOString(),
                })
                .eq("message_id", messageId);

            return {
                success: false,
                response,
                sent: false,
                error: `Generated response but failed to send: ${sendResult.error}`,
            };
        }

        // 7. Mark the message as responded in database
        await supabase
            .from("whatsapp_messages")
            .update({
                auto_respond_sent: true,
                response_sent_at: new Date().toISOString(),
            })
            .eq("message_id", messageId);

        console.log(`✅ Auto-response sent successfully to ${fromNumber}`);

        return {
            success: true,
            response,
            sent: true,
        };
    } catch (error) {
        console.error("Auto-response error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
