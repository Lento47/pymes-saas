import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private readonly defaultApiKey = process.env.ELEVENLABS_API_KEY ?? "";
  private readonly defaultVoiceId = process.env.ELEVENLABS_VOICE_ID ?? "";

  async textToSpeech(text: string, apiKey?: string, voiceId?: string): Promise<Buffer> {
    const key = apiKey || this.defaultApiKey;
    const voice = voiceId || this.defaultVoiceId;
    if (!key || !voice) throw new Error("ElevenLabs not configured: missing API key or voice ID");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 500),
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => String(res.status));
      throw new Error(`ElevenLabs TTS ${res.status}: ${body.slice(0, 200)}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  isConfigured(): boolean {
    return !!(this.defaultApiKey && this.defaultVoiceId);
  }
}
