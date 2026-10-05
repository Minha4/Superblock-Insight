export type CustomerStatus = "Active" | "Trial" | "Paid" | "Renewal Due" | "Expired" | "Suspended" | "Cancelled";
export type HealthStatus = "Healthy" | "At Risk" | "Expansion" | "Renewal Risk";

export type Offering = {
  id: string;
  name: string;
  description: string;
  status: "Active" | "Trial" | "Paused";
  startDate: string;
  expiryDate: string;
  quantity: string;
  pricing: string;
  notes: string;
  owner: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  createdDate: string;
  updatedAt: string;
  category: "General" | "Sales" | "Support" | "Billing" | "Technical" | "Renewal" | "Important";
  priority: "Low" | "Medium" | "High";
};

export type Meeting = {
  id: string;
  date: string;
  title: string;
  participants: string[];
  owner: string;
  summary: string;
  decisions: string;
  actionItems: string[];
  dueDate: string;
  followUp: string;
  status: "Completed" | "Scheduled" | "Follow-up due";
};

export type Credential = {
  id: string;
  type: "Superblock" | "Meta" | "CRM" | "ERP" | "Email" | "Other";
  username: string;
  loginUrl: string;
  password: string;
  updatedAt: string;
  notes: string;
};

export type Invoice = {
  id: string;
  date: string;
  dueDate: string;
  product: string;
  amount: number;
  tax: number;
  total: number;
  status: "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";
  paymentDate?: string;
};

export type Activity = {
  id: string;
  time: string;
  type: string;
  title: string;
  detail: string;
  actor: string;
  channel?: string;
};

export type Customer = {
  id: string;
  company: string;
  industry: string;
  region: string;
  initials: string;
  contact: { name: string; email: string; phone: string };
  activatedAt: string;
  status: CustomerStatus;
  plan: string;
  subscription: {
    status: string;
    startDate: string;
    renewalDate: string;
    billingCycle: string;
    mrr: number;
    contractValue: number;
    paymentStatus: string;
  };
  renewal: string;
  usage: {
    messages: number;
    broadcasts: number;
    conversations: number;
    email: number;
    sms: number;
    whatsapp: number;
    api: number;
    automations: number;
    storage: number;
    contacts?: number;
  };
  offerings: Offering[];
  notes: Note[];
  meetings: Meeting[];
  credentials: Credential[];
  invoices: Invoice[];
  activities: Activity[];
  health: {
    score: number;
    status: HealthStatus;
    usageTrend: "Increasing" | "Stable" | "Declining";
    loginFrequency: string;
    riskReason: string;
  };
  owner: { name: string; initials: string };
  lastActivity: string;
};
