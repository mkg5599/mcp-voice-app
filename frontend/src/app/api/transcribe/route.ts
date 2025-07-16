import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // This is a placeholder for a real transcription service.
    // In a real application, you would use a service like AssemblyAI, Deepgram, or Google Speech-to-Text.
    // For this example, we'll just return a dummy transcription.
    const dummyTranscription = "show me black jackets under $75 in Seattle";

    return NextResponse.json({ text: dummyTranscription });
  } catch (error) {
    console.error("Error in transcribe API:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to process transcription", details: errorMessage },
      { status: 500 }
    );
  }
}