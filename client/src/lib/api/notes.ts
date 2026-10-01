import { fetchAuthSession } from "aws-amplify/auth";

export interface NoteRecord {
  id: string;
  customer_id: string;
  title: string | null;
  content: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface GetNotesResponse {
  success: boolean;
  count: number;
  customerId: string;
  notes: NoteRecord[];
  error?: string;
}

interface MutateNoteResponse {
  success: boolean;
  note?: NoteRecord;
  id?: string;
  customerId?: string;
  message?: string;
  error?: string;
}

// Working customer API base (same as customerAnalytics.ts)
const PRODUCTION_CUSTOMER_BASE =
  "https://gateway.superblock.chat/customeranalytics";

// Dashboard base
const PRODUCTION_DASHBOARD_BASE =
  "https://gateway.superblock.chat/customeranalyticsdashaboard";

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    Boolean(import.meta.env.DEV) ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
  );
}

/**
 * Retrieves the Cognito Access Token directly from the active Amplify Auth session,
 * strictly using the Access Token for the dashboard API as required.
 */
async function getAuthHeaders(
  customHeaders: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  try {
    const session = await fetchAuthSession();
    // Strictly use Cognito Access Token for dashboard API
    const token = session?.tokens?.accessToken?.toString() || "";
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn("Could not retrieve Cognito auth token for notes API:", err);
  }

  return headers;
}

function getLocalNotesKey(customerId: string): string {
  return `sb_notes_${customerId}`;
}

export function getLocalNotes(customerId: string): NoteRecord[] {
  if (typeof window === "undefined" || !customerId) return [];
  try {
    const raw = localStorage.getItem(getLocalNotesKey(customerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalNote(customerId: string, note: NoteRecord): void {
  if (typeof window === "undefined" || !customerId) return;
  try {
    const existing = getLocalNotes(customerId);
    const updated = [note, ...existing.filter((n) => n.id !== note.id)];
    localStorage.setItem(getLocalNotesKey(customerId), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("customer-note-created", { detail: { customerId, note } }));
  } catch (err) {
    console.warn("Could not save note to localStorage:", err);
  }
}

export function updateLocalNote(
  customerId: string,
  noteId: string,
  updates: { title?: string | null; content?: string }
): NoteRecord | null {
  if (typeof window === "undefined" || !customerId) return null;
  try {
    const existing = getLocalNotes(customerId);
    let updatedNote: NoteRecord | null = null;
    const updatedList = existing.map((n) => {
      if (n.id === noteId) {
        updatedNote = {
          ...n,
          title: updates.title !== undefined ? updates.title : n.title,
          content: updates.content !== undefined ? updates.content : n.content,
          updated_at: new Date().toISOString(),
        };
        return updatedNote;
      }
      return n;
    });
    localStorage.setItem(getLocalNotesKey(customerId), JSON.stringify(updatedList));
    window.dispatchEvent(new CustomEvent("customer-note-created", { detail: { customerId, noteId } }));
    return updatedNote;
  } catch {
    return null;
  }
}

export function removeLocalNote(customerId: string, noteId: string): void {
  if (typeof window === "undefined" || !customerId) return;
  try {
    const existing = getLocalNotes(customerId);
    const filtered = existing.filter((n) => n.id !== noteId);
    localStorage.setItem(getLocalNotesKey(customerId), JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent("customer-note-created", { detail: { customerId, noteId } }));
  } catch {}
}

/**
 * Fetches customer notes using the exact same authentication and routing pattern as customerAnalytics.
 */
export async function getCustomerNotes(
  customerId: string
): Promise<NoteRecord[]> {
  if (!customerId) return [];

  const headers = await getAuthHeaders();

  try {
    const res = await fetch(
      `/api/notes?customerId=${encodeURIComponent(customerId)}`,
      { method: "GET", headers }
    );
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as GetNotesResponse | null;
      if (Array.isArray(data?.notes)) {
        return data.notes;
      }
    }
  } catch (err) {
    console.error("Error fetching customer notes from API:", err);
  }

  return [];
}

/**
 * Creates a customer note persisting to PostgreSQL through the unified /api/notes endpoint.
 */
export async function createCustomerNote(input: {
  customerId: string;
  title?: string;
  content: string;
  createdBy?: string;
}): Promise<NoteRecord> {
  if (!input.customerId) throw new Error("Customer ID is required");
  if (!input.content.trim()) throw new Error("Note content is required");

  const headers = await getAuthHeaders();
  const payload = {
    action: "create_note",
    customerId: input.customerId,
    customer_id: input.customerId,
    title: input.title?.trim() || null,
    content: input.content.trim(),
    createdBy: input.createdBy || null,
  };

  const res = await fetch("/api/notes", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => null)) as MutateNoteResponse | null;
  if (res.ok && data?.success && data?.note) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("customer-note-created", {
          detail: { customerId: input.customerId, note: data.note },
        })
      );
    }
    return data.note;
  }

  throw new Error(data?.error || `Failed to create note (Status ${res.status})`);
}

/**
 * Updates an existing customer note by ID.
 */
export async function updateCustomerNote(
  noteId: string,
  input: { title?: string; content?: string }
): Promise<NoteRecord> {
  if (!noteId) throw new Error("Note ID is required");

  const headers = await getAuthHeaders();
  const payload = {
    action: "update_note",
    id: noteId,
    title: input.title?.trim() || null,
    content: input.content?.trim() || "",
  };

  const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => null)) as MutateNoteResponse | null;
  if (res.ok && data?.success && data?.note) {
    return data.note;
  }

  throw new Error(data?.error || `Failed to update note (Status ${res.status})`);
}

/**
 * Deletes a customer note by ID from PostgreSQL.
 */
export async function deleteCustomerNote(noteId: string): Promise<boolean> {
  if (!noteId) throw new Error("Note ID is required");

  const headers = await getAuthHeaders();

  const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
    method: "DELETE",
    headers,
  });
  const data = (await res.json().catch(() => null)) as MutateNoteResponse | null;
  if (res.ok && data?.success) {
    return true;
  }

  throw new Error(data?.error || `Failed to delete note (Status ${res.status})`);
}
