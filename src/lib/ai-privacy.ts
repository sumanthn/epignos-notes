/**
 * Privacy requirements applied to every OpenRouter request that can contain
 * user Note content. Requests must fail instead of falling back to a provider
 * that collects prompts or retains them after processing.
 */
export const OPENROUTER_PRIVATE_PROVIDER = {
  require_parameters: true,
  data_collection: "deny",
  zdr: true,
} as const;
