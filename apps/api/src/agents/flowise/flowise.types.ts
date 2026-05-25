export interface FlowisePredictRequest {
  question: string;
  sessionId?: string;
  overrideConfig?: Record<string, unknown>;
}

export interface FlowisePredictResponse {
  text: string;
  sourceDocuments?: Array<{
    pageContent: string;
    metadata: Record<string, unknown>;
  }>;
  usedTools?: Array<{
    toolName: string;
    toolInput: unknown;
    toolOutput: unknown;
  }>;
}
