export interface TeamMemberItem {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  department: string;
  customers: number;
  status: string;
  lastActive: string;
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY = "analytics_studio_custom_team";

const DEFAULT_TEAM: TeamMemberItem[] = [
  {
    id: "tm-1",
    name: "Aakash Sharma",
    initials: "AS",
    email: "aakash@superblock.chat",
    role: "Admin",
    department: "Executive",
    customers: 42,
    status: "Active",
    lastActive: "Now",
    createdAt: "2024-01-01T09:00:00Z",
  },
  {
    id: "tm-2",
    name: "Sneha Patel",
    initials: "SP",
    email: "sneha@superblock.chat",
    role: "Customer Success",
    department: "Success",
    customers: 28,
    status: "Active",
    lastActive: "10m ago",
    createdAt: "2024-01-15T11:00:00Z",
  },
  {
    id: "tm-3",
    name: "Rohan Verma",
    initials: "RV",
    email: "rohan@superblock.chat",
    role: "Support Lead",
    department: "Support",
    customers: 15,
    status: "Away",
    lastActive: "2h ago",
    createdAt: "2024-02-01T14:30:00Z",
  },
  {
    id: "tm-4",
    name: "Pooja Nair",
    initials: "PN",
    email: "pooja@superblock.chat",
    role: "Billing Specialist",
    department: "Finance",
    customers: 19,
    status: "Active",
    lastActive: "Just now",
    createdAt: "2024-02-10T16:00:00Z",
  },
];

function loadLocalTeamMembers(): TeamMemberItem[] {
  if (typeof window === "undefined") return DEFAULT_TEAM;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEAM;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEAM;
  } catch {
    return DEFAULT_TEAM;
  }
}

function saveLocalTeamMembers(items: TeamMemberItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Could not save team members to localStorage:", err);
  }
}

function getInitials(name?: string): string {
  if (!name || !name.trim()) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export async function getTeamMembers(): Promise<TeamMemberItem[]> {
  try {
    const res = await fetch("/api/team");
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data?.teamMembers)) {
        const mappedFromDb: TeamMemberItem[] = data.teamMembers.map((m: any) => ({
          id: m.id || `tm-${Date.now()}`,
          name: m.name || m.org_user_name || "Team Member",
          initials: getInitials(m.name || m.org_user_name),
          email: m.email || "team@superblock.chat",
          role: m.role || "Member",
          department: m.department || "Customer",
          customers: typeof m.customers === "number" ? m.customers : 0,
          status: (m.status || "Active") as TeamMemberItem["status"],
          lastActive: m.last_active || "Recently",
          createdAt: m.created_at || new Date().toISOString(),
          updatedAt: m.updated_at || new Date().toISOString(),
        }));

        saveLocalTeamMembers(mappedFromDb);
        return mappedFromDb;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch team members from backend, falling back to local storage:", err);
  }

  return loadLocalTeamMembers();
}

export async function inviteTeamMember(input: Partial<TeamMemberItem>): Promise<TeamMemberItem> {
  const name = input.name?.trim() || "New Member";
  let savedMember: TeamMemberItem = {
    id: input.id || `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    initials: getInitials(name),
    email: input.email?.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@superblock.chat`,
    role: input.role || "Customer Success",
    department: input.department || "Customer",
    customers: input.customers ?? 0,
    status: input.status || "Active",
    lastActive: "Just now",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res = await fetch("/api/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: savedMember.id,
      name: savedMember.name,
      email: savedMember.email,
      role: savedMember.role,
      department: savedMember.department,
      customers: savedMember.customers,
      status: savedMember.status,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success || !data?.teamMember) {
    throw new Error(data?.error || `Failed to invite team member (${res.status})`);
  }

  savedMember = {
    id: data.teamMember.id,
    name: data.teamMember.name,
    initials: getInitials(data.teamMember.name),
    email: data.teamMember.email,
    role: data.teamMember.role || savedMember.role,
    department: savedMember.department,
    customers: savedMember.customers,
    status: savedMember.status,
    lastActive: "Just now",
    createdAt: data.teamMember.created_at || savedMember.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const existing = loadLocalTeamMembers();
  const updated = [savedMember, ...existing.filter((m) => m.id !== savedMember.id && m.email !== savedMember.email)];
  saveLocalTeamMembers(updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("team-updated", { detail: savedMember }));
  }

  return savedMember;
}

export async function updateTeamMember(id: string, updates: Partial<TeamMemberItem>): Promise<TeamMemberItem> {
  const existing = loadLocalTeamMembers();
  const target = existing.find((m) => m.id === id || m.email === id);

  let updatedMember: TeamMemberItem = {
    ...(target || {}),
    id,
    name: updates.name || target?.name || "Team Member",
    initials: getInitials(updates.name || target?.name),
    email: updates.email || target?.email || "team@superblock.chat",
    role: updates.role || target?.role || "Member",
    department: updates.department || target?.department || "Customer",
    customers: updates.customers ?? target?.customers ?? 0,
    status: (updates.status || target?.status || "Active") as TeamMemberItem["status"],
    lastActive: "Just now",
    createdAt: target?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(`/api/team/${encodeURIComponent(target?.id || id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: updatedMember.name,
        email: updatedMember.email,
        role: updatedMember.role,
        department: updatedMember.department,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.teamMember) {
        updatedMember = {
          id: data.teamMember.id,
          name: data.teamMember.name,
          initials: getInitials(data.teamMember.name),
          email: data.teamMember.email,
          role: data.teamMember.role || updatedMember.role,
          department: updatedMember.department,
          customers: updatedMember.customers,
          status: updatedMember.status,
          lastActive: "Just now",
          createdAt: data.teamMember.created_at || updatedMember.createdAt,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn("Backend PUT /api/team failed, persisting to local storage:", err);
  }

  const updatedList = existing.map((m) => (m.id === (target?.id || id) ? updatedMember : m));
  saveLocalTeamMembers(updatedList);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("team-updated", { detail: updatedMember }));
  }

  return updatedMember;
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  try {
    await fetch(`/api/team/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("Backend DELETE /api/team failed, removing from local storage:", err);
  }

  const existing = loadLocalTeamMembers();
  const updatedList = existing.filter((m) => m.id !== id && m.email !== id);
  saveLocalTeamMembers(updatedList);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("team-updated", { detail: { id } }));
  }

  return true;
}
