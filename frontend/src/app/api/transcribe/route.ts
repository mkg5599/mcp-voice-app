import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const backend =
    process.env.NEXT_PUBLIC_API_URL ?? "http://backend:8000";

  const r = await fetch(`${backend}/transcribe`, {
    method: "POST",
    body: form,
  });

  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}