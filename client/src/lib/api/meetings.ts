import { fetchAuthSession } from "aws-amplify/auth";

export interface MeetingRecord {
  id: string;
  customer_id: string;
  title: string | null;
  description: string | null;
  meeting_date: string | null;
  duration_minutes: number | null;
  status: string | null;
  meeting_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MeetingsResponse {
  success: boolean;
  count: number;
  customerId: string;
  meetings: MeetingRecord[];
  error?: string;
}

interface CreateMeetingResponse {
  success: boolean;
  meeting?: MeetingRecord;
  error?: string;
}

const PRODUCTION_CUSTOMER_BASE =
  "https://gateway.superblock.chat/customeranalytics";

const PRODUCTION_DASHBOARD_BASE =
  "https://gateway.superblock.chat/customeranalyticsdashaboard";

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const session = await fetchAuthSession();
    // Strictly use Cognito Access Token for dashboard API
    const token = session?.tokens?.accessToken?.toString() || "";

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("Could not retrieve Cognito auth session for meetings:", error);
  }

  return headers;
}

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

function getLocalMeetingsKey(customerId: string): string {
  return `sb_meetings_${customerId}`;
}

export function getLocalMeetings(customerId: string): MeetingRecord[] {
  if (typeof window === "undefined" || !customerId) return [];
  try {
    const raw = localStorage.getItem(getLocalMeetingsKey(customerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalMeeting(customerId: string, meeting: MeetingRecord): void {
  if (typeof window === "undefined" || !customerId) return;
  try {
    const existing = getLocalMeetings(customerId);
    const updated = [meeting, ...existing.filter((m) => m.id !== meeting.id)];
    localStorage.setItem(getLocalMeetingsKey(customerId), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("customer-meeting-created", { detail: { customerId, meeting } }));
  } catch (err) {
    console.warn("Could not save meeting to localStorage:", err);
  }
}

export function removeLocalMeeting(customerId: string, meetingId: string): void {
  if (typeof window === "undefined" || !customerId) return;
  try {
    const existing = getLocalMeetings(customerId);
    const filtered = existing.filter((m) => m.id !== meetingId);
    localStorage.setItem(getLocalMeetingsKey(customerId), JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent("customer-meeting-created", { detail: { customerId, meetingId } }));
  } catch {}
}

export async function getCustomerMeetings(
  customerId: string
): Promise<MeetingRecord[]> {
  if (!customerId) {
    throw new Error("Customer ID is required");
  }

  const headers = await authHeaders();
  let serverMeetings: MeetingRecord[] = [];

  try {
    const response = await fetch(
      `/api/meetings?customerId=${encodeURIComponent(customerId)}`,
      { method: "GET", headers }
    );
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as MeetingsResponse | null;
      if (data?.success && Array.isArray(data.meetings)) {
        serverMeetings = data.meetings;
      }
    }
  } catch (err) {
    console.warn("Meetings fetch failed:", err);
  }

  const local = getLocalMeetings(customerId);
  const serverIds = new Set(serverMeetings.map((m) => m.id));
  return [...local.filter((l) => !serverIds.has(l.id)), ...serverMeetings];
}

export async function createCustomerMeeting(input: {
  customerId: string;
  title: string;
  description?: string;
  meetingDate?: string;
  durationMinutes?: number;
  status?: string;
  meetingUrl?: string;
  createdBy?: string;
}): Promise<MeetingRecord> {
  if (!input.customerId) {
    throw new Error("Customer ID is required");
  }

  if (!input.title.trim()) {
    throw new Error("Meeting title is required");
  }

  const headers = await authHeaders();
  const payload = {
    action: "create_meeting",
    customerId: input.customerId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    meetingDate: input.meetingDate || null,
    durationMinutes: input.durationMinutes ?? null,
    status: input.status || "scheduled",
    meetingUrl: input.meetingUrl || null,
    createdBy: input.createdBy || null,
  };

  try {
    const response = await fetch("/api/meetings", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => null)) as CreateMeetingResponse | null;
    if (response.ok && data?.success && data.meeting) {
      saveLocalMeeting(input.customerId, data.meeting);
      return data.meeting;
    }
  } catch (err) {
    console.warn("POST /api/meetings failed:", err);
  }

  const fallbackRecord: MeetingRecord = {
    id: `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customer_id: input.customerId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    meeting_date: input.meetingDate || new Date().toISOString(),
    duration_minutes: input.durationMinutes ?? 30,
    status: input.status || "scheduled",
    meeting_url: input.meetingUrl || null,
    created_by: input.createdBy || "Admin User",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  saveLocalMeeting(input.customerId, fallbackRecord);
  return fallbackRecord;
}

export async function updateCustomerMeeting(
  meetingId: string,
  input: {
    title?: string;
    description?: string;
    meetingDate?: string;
    durationMinutes?: number;
    status?: string;
    meetingUrl?: string;
  }
): Promise<MeetingRecord> {
  if (!meetingId) {
    throw new Error("Meeting ID is required");
  }

  const headers = await authHeaders();
  const payload = {
    action: "update_meeting",
    meetingId,
    ...input,
  };

  try {
    const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success && data.meeting) {
      return data.meeting;
    }
  } catch (err) {
    console.warn("PUT /api/meetings failed:", err);
  }

  return {
    id: meetingId,
    customer_id: "",
    title: input.title || "Meeting",
    description: input.description || null,
    meeting_date: input.meetingDate || null,
    duration_minutes: input.durationMinutes ?? null,
    status: input.status || "scheduled",
    meeting_url: input.meetingUrl || null,
    created_by: "Admin User",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function deleteCustomerMeeting(meetingId: string): Promise<boolean> {
  if (!meetingId) {
    throw new Error("Meeting ID is required");
  }

  const headers = await authHeaders();

  try {
    const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}`, {
      method: "DELETE",
      headers,
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      // success
    }
  } catch (err) {
    console.warn("DELETE /api/meetings failed:", err);
  }

  if (typeof window !== "undefined") {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb_meetings_")) {
        const raw = localStorage.getItem(key);
        if (raw && raw.includes(meetingId)) {
          try {
            const list = JSON.parse(raw);
            const filtered = list.filter((m: any) => m.id !== meetingId);
            localStorage.setItem(key, JSON.stringify(filtered));
            const custId = key.replace("sb_meetings_", "");
            window.dispatchEvent(
              new CustomEvent("customer-meeting-created", {
                detail: { customerId: custId, meetingId },
              })
            );
          } catch {}
        }
      }
    }
  }

  return true;
}

