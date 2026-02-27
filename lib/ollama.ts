export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
  expires_at: string;
  size_vram: number;
}

export interface OllamaVersion {
  version: string;
}

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: Record<string, unknown>;
  keep_alive?: string;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaChatMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaShowResponse {
  modelfile: string;
  parameters: string;
  template: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
  model_info: Record<string, unknown>;
}

export async function ollamaFetch<T>(
  baseUrl: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getVersion(baseUrl: string): Promise<OllamaVersion> {
  return ollamaFetch<OllamaVersion>(baseUrl, "/api/version");
}

export async function listModels(
  baseUrl: string
): Promise<{ models: OllamaModel[] }> {
  return ollamaFetch<{ models: OllamaModel[] }>(baseUrl, "/api/tags");
}

export async function listRunningModels(
  baseUrl: string
): Promise<{ models: OllamaRunningModel[] }> {
  return ollamaFetch<{ models: OllamaRunningModel[] }>(baseUrl, "/api/ps");
}

export async function showModel(
  baseUrl: string,
  name: string
): Promise<OllamaShowResponse> {
  return ollamaFetch<OllamaShowResponse>(baseUrl, "/api/show", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteModel(
  baseUrl: string,
  name: string
): Promise<void> {
  await ollamaFetch(baseUrl, "/api/delete", {
    method: "DELETE",
    body: JSON.stringify({ name }),
  });
}

export async function copyModel(
  baseUrl: string,
  source: string,
  destination: string
): Promise<void> {
  await ollamaFetch(baseUrl, "/api/copy", {
    method: "POST",
    body: JSON.stringify({ source, destination }),
  });
}

export function pullModelStream(
  baseUrl: string,
  name: string
): ReadableStream<OllamaPullProgress> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/pull`;

  return new ReadableStream({
    async start(controller) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stream: true }),
      });

      if (!res.ok || !res.body) {
        controller.error(
          new Error(`Pull failed: ${res.status} ${res.statusText}`)
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              controller.enqueue(JSON.parse(line));
            } catch {
              // skip malformed lines
            }
          }
        }
      }

      controller.close();
    },
  });
}
