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

export interface FlowiseChatflowCreateBody {
  name: string;
  flowData: string;
  deployed: boolean;
  isPublic: boolean;
  type: "CHATFLOW" | "AGENTFLOW";
}

export interface FlowiseChatflowResponse {
  id: string;
  name: string;
  deployed: boolean;
  createdDate: string;
  updatedDate: string;
}

export interface FlowiseToolDef {
  name: string;
  description: string;
  color?: string;
  schema: string;
  func: string;
}

export interface FlowiseToolResponse {
  id: string;
  name: string;
}
