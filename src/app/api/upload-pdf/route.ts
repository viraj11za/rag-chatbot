import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const file = form.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const text = await extractPdfText(buffer);

        return NextResponse.json({ text });
    } catch (err: any) {
        console.error("PDF ERROR:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
