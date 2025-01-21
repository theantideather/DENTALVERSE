import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const base64Audio = body.audio;

    // Convert the base64 audio data to a Buffer
    const audioBuffer = Buffer.from(base64Audio, "base64");

    // Create a File object from the buffer
    const audioFile = new File([audioBuffer], "audio.wav", { type: "audio/wav" });

    const data = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error processing audio:", error);
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 500 });
  }
}
