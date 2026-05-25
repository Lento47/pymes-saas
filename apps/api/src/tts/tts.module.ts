import { Global, Module } from "@nestjs/common";
import { TtsService } from "./tts.service";

@Global()
@Module({
  providers: [TtsService],
  exports: [TtsService],
})
export class TtsModule {}
