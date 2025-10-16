import { BotState, ChatMessage } from "~/types/bot";

type StoredEntry = ChatMessage & {
  timestamp: number;
};

export async function handleHistory(entry: ChatMessage, state: BotState): Promise<void> {
  const prev = (state.get<StoredEntry[]>("history") ?? []) as StoredEntry[];
  const newEntry: StoredEntry = {
    role: entry.role,
    content: entry.content,
    timestamp: Date.now(),
  };

  const next = [...prev, newEntry];

  const MAX_ENTRIES = 100;
  const trimmed = next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;

  await state.update({ history: trimmed });
}

export function getHistoryMessages(state: BotState): ChatMessage[] {
  const prev = (state.get<StoredEntry[]>("history") ?? []) as StoredEntry[];
  return prev.map(({ role, content }) => ({ role, content }));
}

export function getHistoryParse(
  state: BotState,
  opts?: { maxMessages?: number; maxChars?: number }
): string {
  const { maxMessages = 30, maxChars = 3000 } = opts ?? {};
  const msgs = getHistoryMessages(state);
  const sliceStart = Math.max(0, msgs.length - maxMessages);
  const recent = msgs.slice(sliceStart);

  const roleLabel = (role: string) => {
    if (role === "user") return "Usuario";
    if (role === "assistant") return "Asistente";
    return role;
  };

  const lines = recent.map((m) => {
    const text = String(m.content ?? "").replace(/\s+/g, " ").trim();
    return `${roleLabel(m.role)}: ${text}`;
  });

  let joined = lines.join("\n");
  if (joined.length > maxChars) {
    joined = joined.slice(joined.length - maxChars);
    const firstNewline = joined.indexOf("\n");
    if (firstNewline > 0) {
      joined = joined.slice(firstNewline + 1);
    }
  }

  return joined
}

export function getHistoryAsLLMMessages(state: BotState): ChatMessage[] {
  return getHistoryMessages(state)
}

export async function clearHistory(state: BotState): Promise<void> {
  await state.update({ history: [] })
}
