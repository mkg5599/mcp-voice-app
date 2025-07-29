export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { RagRequest, RagResponse } from "../../../types/product";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
    const t0 = Date.now();

    try {
        const body: RagRequest = await req.json();

        if (!body.query?.trim()) {
            return NextResponse.json(
                { error: "Query is required" },
                { status: 400 }
            );
        }

        // Call backend RAG endpoint
        const response = await fetch(`${BACKEND_INTERNAL_URL}/products/rag`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: body.query.trim(),
                context_size: body.context_size || 5,
                system_prompt: body.system_prompt,
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`Backend RAG error: ${response.status} ${response.statusText}`, errorData);

            return NextResponse.json(
                {
                    error: "RAG service unavailable",
                    detail: `Backend error: ${response.status} ${response.statusText}`,
                },
                { status: response.status }
            );
        }

        const ragData: RagResponse = await response.json();

        // Add frontend processing time
        const totalLatency = Date.now() - t0;

        console.log(JSON.stringify({
            evt: "frontend_rag_request",
            query: body.query,
            context_size: ragData.context_size,
            retrieved_products: ragData.retrieved_products.length,
            backend_processing_ms: ragData.processing_time_ms,
            total_latency_ms: totalLatency,
        }));

        return NextResponse.json({
            ...ragData,
            frontend_processing_time_ms: totalLatency,
        });

    } catch (error) {
        const latency = Date.now() - t0;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error('Frontend RAG error:', error);
        console.log(JSON.stringify({
            evt: "frontend_rag_error",
            error: errorMessage,
            latency_ms: latency,
        }));

        return NextResponse.json(
            {
                error: "RAG request failed",
                detail: errorMessage,
            },
            { status: 500 }
        );
    }
}