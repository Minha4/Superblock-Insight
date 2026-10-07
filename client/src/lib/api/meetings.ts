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
      if (Array.isArray(data?.meetings)) {
        return data.meetings;
      }
    }
  } catch (err) {
    console.error("Error fetching customer meetings from API:", err);
  }

  return [];
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

  const response = await fetch("/api/meetings", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as CreateMeetingResponse | null;
  if (response.ok && data?.success && data.meeting) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("customer-meeting-created", {
          detail: { customerId: input.customerId, meeting: data.meeting },
        })
      );
    }
    return data.meeting;
  }

  throw new Error(data?.error || `Failed to create meeting (Status ${response.status})`);
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

  const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (res.ok && data?.success && data.meeting) {
    return data.meeting;
  }

  throw new Error(data?.error || `Failed to update meeting (Status ${res.status})`);
}

export async function deleteCustomerMeeting(meetingId: string): Promise<boolean> {
  if (!meetingId) {
    throw new Error("Meeting ID is required");
  }

  const headers = await authHeaders();

  const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}`, {
    method: "DELETE",
    headers,
  });
  const data = await res.json().catch(() => null);
  if (res.ok && data?.success) {
    return true;
  }

  throw new Error(data?.error || `Failed to delete meeting (Status ${res.status})`);
}

