import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly defaultVoiceId: string;
  private readonly modelId: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      config.get<string>("ELEVENLABS_BASE_URL") ?? "https://api.elevenlabs.io";
    this.apiKey = config.get<string>("ELEVENLABS_API_KEY") ?? null;
    // Support both ELEVENLABS_VOICE_ID (Railway) and ELEVENLABS_DEFAULT_VOICE_ID
    this.defaultVoiceId =
      config.get<string>("ELEVENLABS_VOICE_ID") ??
      config.get<string>("ELEVENLABS_DEFAULT_VOICE_ID") ??
      "JBFqnCBsd6RMkjVDRZzb";
    this.modelId =
      config.get<string>("ELEVENLABS_MODEL_ID") ?? "eleven_multilingual_v2";
  }

  get isEnabled(): boolean {
    return !!this.apiKey;
  }

  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const vid = voiceId ?? this.defaultVoiceId;
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/text-to-speech/${vid}?output_format=opus_48000`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/ogg",
      },
      body: JSON.stringify({
        text,
        model_id: this.modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`ElevenLabs TTS failed ${res.status}: ${err}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
