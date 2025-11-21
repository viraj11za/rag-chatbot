import { NextResponse } from "next/server";
import { generateAutoResponse } from "@/lib/autoResponder";

/**
 * Manual endpoint to generate auto-response
 * Useful for testing without triggering the webhook
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { phone_number, message, message_id } = body;

        if (!phone_number || !message) {
            return NextResponse.json(
                { error: "phone_number and message are required" },
                { status: 400 }
            );
        }

        const result = await generateAutoResponse(
            phone_number,
            message,
            message_id || `manual-${Date.now()}`
        );

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    noDocuments: result.noDocuments,
                },
                { status: result.noDocuments ? 404 : 500 }
            );
        }

        return NextResponse.json({
            success: true,
            response: result.response,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("AUTO_RESPOND_ERROR:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
