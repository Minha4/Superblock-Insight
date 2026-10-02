/**
 * TypeScript definitions for AWS Lambda handlers and database records
 * in Analytics Studio backend.
 */

export interface APIGatewayProxyEvent {
  httpMethod?: string;
  path?: string;
  rawPath?: string;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
  };
  queryStringParameters?: Record<string, string | undefined> | null;
  pathParameters?: Record<string, string | undefined> | null;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface APIGatewayProxyResult {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

/**
 * Exact schema for public.notes
 */
export interface NoteRecord {
  id: string;
  customer_id: string;
  title: string | null;
  content: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetNotesResponse {
  success: boolean;
  count: number;
  customerId: string;
  notes: NoteRecord[];
  error?: string;
}

export interface CreateNoteInput {
  customerId?: string;
  customer_id?: string;
  title?: string | null;
  content: string;
  createdBy?: string | null;
  created_by?: string | null;
}

export interface CreateNoteResponse {
  success: boolean;
  note?: NoteRecord;
  error?: string;
}

/**
 * Exact schema for public.meetings
 */
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

export interface GetMeetingsResponse {
  success: boolean;
  count: number;
  customerId: string;
  meetings: MeetingRecord[];
  error?: string;
}

export interface CreateMeetingInput {
  customerId?: string;
  customer_id?: string;
  title: string;
  description?: string | null;
  meetingDate?: string | null;
  meeting_date?: string | null;
  durationMinutes?: number | null;
  duration_minutes?: number | null;
  status?: string | null;
  meetingUrl?: string | null;
  meeting_url?: string | null;
  createdBy?: string | null;
  created_by?: string | null;
}

export interface CreateMeetingResponse {
  success: boolean;
  meeting?: MeetingRecord;
  error?: string;
}

/**
 * Exact schema for public.customers_details (formerly public.customers)
 */
export interface CustomerDetailsRecord {
  id: string;
  client_user_id: string;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetCustomerDetailsResponse {
  success: boolean;
  customer?: CustomerDetailsRecord | null;
  error?: string;
}

export interface ListCustomerDetailsResponse {
  success: boolean;
  count: number;
  customers: CustomerDetailsRecord[];
  error?: string;
}

/**
 * public.contacts
 */
export interface ContactRecord {
  id: string;
  client_user_id: string;
  contact_id: string;
  contact_name: string;
  phone: string;
  selected: boolean;
  created_at: string;
  timestamp: number | null;
  email: string | null;
  whatsapp_opt_in: boolean | null;
  membership_tier: string | null;
  tags: string[] | null;
  notes: string | null;
  updated_at: string | null;
  country_code: string;
}

export interface GetContactsResponse {
  success: boolean;
  count: number;
  customerId: string;
  contacts: ContactRecord[];
  error?: string;
}

export interface CreateContactInput {
  customerId?: string;
  clientUserId?: string;
  client_user_id?: string;
  contactId?: string;
  contact_id?: string;
  contactName: string;
  contact_name?: string;
  phone: string;
  email?: string | null;
  countryCode?: string;
  country_code?: string;
  whatsappOptIn?: boolean;
  whatsapp_opt_in?: boolean;
  membershipTier?: string | null;
  membership_tier?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  selected?: boolean;
}

export interface CreateContactResponse {
  success: boolean;
  contact?: ContactRecord;
  error?: string;
}

/**
 * public.deals
 */
export interface DealRecord {
  id: string;
  client_id: string;
  client_user_id: string;
  deal_id: string;
  contact: string | null;
  company: string | null;
  phone: string | null;
  name: string;
  title: string | null;
  value: number;
  numeric_value: number;
  currency: string;
  probability: number | null;
  forecast: string | null;
  source: string | null;
  priority: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  stage: string | null;
  stage_id: string | null;
  owner: string | null;
  notes: string | null;
  due_date: string | null;
  close_date: string | null;
  activity: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tags: any;
  products: any;
  status: string | null;
  owner_id: string | null;
  owner_name: string | null;
  last_activity_at: string | null;
  contact_id: string | null;
  original_value: number | null;
  original_currency: string | null;
}

export interface GetDealsResponse {
  success: boolean;
  count: number;
  customerId: string;
  deals: DealRecord[];
  error?: string;
}

export interface CreateDealInput {
  customerId?: string;
  clientUserId?: string;
  client_user_id?: string;
  clientId?: string;
  client_id?: string;
  dealId?: string;
  deal_id?: string;
  name: string;
  title?: string | null;
  value?: number;
  currency?: string;
  probability?: number;
  forecast?: string | null;
  source?: string | null;
  priority?: string | null;
  pipelineId?: string | null;
  pipeline_id?: string | null;
  pipelineName?: string | null;
  pipeline_name?: string | null;
  stage?: string | null;
  stageId?: string | null;
  stage_id?: string | null;
  owner?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  due_date?: string | null;
  closeDate?: string | null;
  close_date?: string | null;
  contact?: string | null;
  company?: string | null;
  phone?: string | null;
  tags?: any;
  products?: any;
  status?: string | null;
  ownerId?: string | null;
  owner_id?: string | null;
  ownerName?: string | null;
  owner_name?: string | null;
}

export interface CreateDealResponse {
  success: boolean;
  deal?: DealRecord;
  error?: string;
}

/**
 * public.tickets
 */
export interface TicketRecord {
  id: string;
  ticket_id: string;
  client_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  title: string | null;
  subject: string | null;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetTicketsResponse {
  success: boolean;
  count: number;
  customerId: string;
  tickets: TicketRecord[];
  error?: string;
}

export interface CreateTicketInput {
  customerId?: string;
  userId?: string;
  user_id?: string;
  clientId?: string;
  client_id?: string;
  ticketId?: string;
  ticket_id?: string;
  title?: string;
  subject?: string;
  description?: string | null;
  userName?: string | null;
  user_name?: string | null;
  userEmail?: string | null;
  user_email?: string | null;
  userPhone?: string | null;
  user_phone?: string | null;
  category?: string;
  priority?: string;
  status?: string;
  assignedTo?: string | null;
  assigned_to?: string | null;
}

export interface CreateTicketResponse {
  success: boolean;
  ticket?: TicketRecord;
  error?: string;
}

/**
 * public.team_members
 */
export interface TeamMemberRecord {
  id: string;
  team_user_id: string;
  org_user_id: string;
  org_user_name: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  password_hash: string | null;
  created_at: string;
}

export interface GetTeamMembersResponse {
  success: boolean;
  count: number;
  customerId: string;
  teamMembers: TeamMemberRecord[];
  error?: string;
}

export interface CreateTeamMemberInput {
  customerId?: string;
  orgUserId?: string;
  org_user_id?: string;
  orgUserName?: string | null;
  org_user_name?: string | null;
  teamUserId?: string;
  team_user_id?: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  role?: string;
  passwordHash?: string | null;
  password_hash?: string | null;
}

export interface CreateTeamMemberResponse {
  success: boolean;
  teamMember?: TeamMemberRecord;
  error?: string;
}

export interface UpdateTeamMemberInput {
  name?: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  department?: string;
  status?: string;
}

export interface UpdateTeamMemberResponse {
  success: boolean;
  teamMember?: TeamMemberRecord;
  error?: string;
}

export interface DeleteTeamMemberResponse {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * public.products
 */
export interface ProductRecord {
  id: string;
  client_id: string;
  client_user_id: string;
  name: string | null;
  description: string | null;
  category: string | null;
  hsn: string | null;
  barcode_type: string | null;
  barcode_value: string | null;
  billing: string | null;
  cost: number;
  currency: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  price: number | null;
  sku: string | null;
  margin: string | null;
  tax_rate: number | null;
  unit: string | null;
  track_inventory: boolean | null;
  stock: number | null;
}

export interface GetProductsResponse {
  success: boolean;
  count: number;
  customerId: string;
  products: ProductRecord[];
  error?: string;
}

export interface CreateProductInput {
  customerId?: string;
  clientUserId?: string;
  client_user_id?: string;
  clientId?: string;
  client_id?: string;
  id?: string;
  name: string;
  description?: string | null;
  category?: string | null;
  hsn?: string | null;
  barcodeType?: string | null;
  barcode_type?: string | null;
  barcodeValue?: string | null;
  barcode_value?: string | null;
  billing?: string | null;
  cost?: number;
  currency?: string;
  active?: boolean;
  price?: number;
  sku?: string | null;
  margin?: string | null;
  taxRate?: number;
  tax_rate?: number;
  unit?: string;
  trackInventory?: boolean;
  track_inventory?: boolean;
  stock?: number;
  createdBy?: string | null;
  created_by?: string | null;
}

export interface CreateProductResponse {
  success: boolean;
  product?: ProductRecord;
  error?: string;
}

export interface UpdateProductInput {
  name?: string;
  category?: string;
  billing?: string;
  model?: string;
  price?: number;
  cost?: number;
  currency?: string;
  active?: boolean;
  status?: string;
  description?: string;
  sku?: string | null;
  margin?: string | null;
  taxRate?: number;
  tax_rate?: number;
  unit?: string;
  trackInventory?: boolean;
  track_inventory?: boolean;
  stock?: number;
}

export interface UpdateProductResponse {
  success: boolean;
  product?: ProductRecord;
  error?: string;
}

export interface DeleteProductResponse {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * public.subscriptions
 */
export interface SubscriptionRecord {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  amount: number | null;
  currency: string | null;
  billing_interval: string | null;
  created_at: string | null;
  updated_at: string | null;
  plan_name?: string | null;
  customer_name?: string | null;
}

export interface GetSubscriptionsResponse {
  success: boolean;
  count: number;
  customerId: string;
  subscriptions: SubscriptionRecord[];
  error?: string;
}

export interface CreateSubscriptionInput {
  id?: string;
  customerId?: string;
  customer_id?: string;
  customer?: string;
  customer_name?: string;
  planId?: string;
  plan_id?: string;
  plan?: string;
  status?: string | null;
  startDate?: string | null;
  start_date?: string | null;
  endDate?: string | null;
  end_date?: string | null;
  renewalDate?: string | null;
  amount?: number | null;
  mrr?: number | null;
  currency?: string | null;
  billingInterval?: string | null;
  billing_interval?: string | null;
  cycle?: string | null;
  autoRenewal?: boolean;
}

export interface CreateSubscriptionResponse {
  success: boolean;
  subscription?: SubscriptionRecord;
  error?: string;
}

export interface UpdateSubscriptionInput {
  customer?: string | null;
  customer_name?: string | null;
  planId?: string;
  plan_id?: string;
  plan?: string;
  status?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  renewalDate?: string;
  amount?: number;
  mrr?: number;
  currency?: string;
  billingInterval?: string;
  billing_interval?: string;
  cycle?: string;
}

export interface UpdateSubscriptionResponse {
  success: boolean;
  subscription?: SubscriptionRecord;
  error?: string;
}

export interface DeleteSubscriptionResponse {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * public.customer_offerings
 */
export interface CustomerOfferingRecord {
  id: string;
  customer_id: string;
  product_id: string | null;
  offering_name: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GetCustomerOfferingsResponse {
  success: boolean;
  count: number;
  customerId: string;
  offerings: CustomerOfferingRecord[];
  customerOfferings?: CustomerOfferingRecord[];
  error?: string;
}

export interface CreateCustomerOfferingInput {
  customerId?: string;
  customer_id?: string;
  productId?: string | null;
  product_id?: string | null;
  offeringName?: string | null;
  offering_name?: string | null;
  status?: string | null;
  startDate?: string | null;
  start_date?: string | null;
  endDate?: string | null;
  end_date?: string | null;
}

export interface CreateCustomerOfferingResponse {
  success: boolean;
  offering?: CustomerOfferingRecord;
  customerOffering?: CustomerOfferingRecord;
  error?: string;
}

/**
 * public.invoices
 */
export interface InvoiceRecord {
  id: string;
  customer_id: string;
  invoice_number: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GetInvoicesResponse {
  success: boolean;
  count: number;
  customerId: string;
  invoices: InvoiceRecord[];
  error?: string;
}

export interface CreateInvoiceInput {
  customerId?: string;
  customer_id?: string;
  invoiceNumber?: string | null;
  invoice_number?: string | null;
  status?: string | null;
  amount: number;
  currency?: string | null;
  issueDate?: string | null;
  issue_date?: string | null;
  dueDate?: string | null;
  due_date?: string | null;
  paidDate?: string | null;
  paid_date?: string | null;
  description?: string | null;
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoice?: InvoiceRecord;
  error?: string;
}

/**
 * public.usage_metrics
 */
export interface UsageMetricRecord {
  id: string;
  customer_id: string;
  metric_name: string;
  metric_value: number | null;
  metric_unit: string | null;
  recorded_at: string | null;
  created_at: string | null;
}

export interface MetricSummary {
  metricName: string;
  count: number;
  totalValue: number | null;
  avgValue: number | null;
  maxValue: number | null;
  unit: string | null;
  earliestRecordedAt: string | null;
  latestRecordedAt: string | null;
}

export interface PlanMessageVolumeCustomer {
  userId: string;
  userName: string | null;
  plan: string | null;
  messageVolume: number;
}

export interface PlanMetricsSummary {
  totalConfiguredMessageVolume: number | null;
  configuredCustomersCount: number;
  customers?: PlanMessageVolumeCustomer[];
  note: string;
}

export interface GetUsageMetricsResponse {
  success: boolean;
  scope?: "platform" | "customer";
  count: number;
  customerId?: string;
  usageMetrics: UsageMetricRecord[];
  metricBreakdown?: Record<string, MetricSummary>;
  planMetrics?: PlanMetricsSummary;
  contactsSummary?: {
    totalContacts: number | null;
  };
  warning?: string;
  error?: string;
}

export interface CreateUsageMetricInput {
  customerId?: string;
  customer_id?: string;
  metricName: string;
  metric_name?: string;
  metricValue?: number | null;
  metric_value?: number | null;
  metricUnit?: string | null;
  metric_unit?: string | null;
  recordedAt?: string | null;
  recorded_at?: string | null;
}

export interface CreateUsageMetricResponse {
  success: boolean;
  usageMetric?: UsageMetricRecord;
  error?: string;
}

/**
 * public.activities
 */
export interface ActivityRecord {
  id: string;
  customer_id: string;
  activity_type: string;
  title: string | null;
  description: string | null;
  performed_by: string | null;
  activity_date: string | null;
  created_at: string | null;
}

export interface GetActivitiesResponse {
  success: boolean;
  count: number;
  customerId: string;
  activities: ActivityRecord[];
  error?: string;
}

export interface CreateActivityInput {
  customerId?: string;
  customer_id?: string;
  activityType: string;
  activity_type?: string;
  title?: string | null;
  description?: string | null;
  performedBy?: string | null;
  performed_by?: string | null;
  activityDate?: string | null;
  activity_date?: string | null;
}

export interface CreateActivityResponse {
  success: boolean;
  activity?: ActivityRecord;
  error?: string;
}

/**
 * public.plans
 */
export interface PlanRecord {
  id: string;
  name: string;
  product: string;
  monthly: number;
  annual: number;
  limit: string;
  features: number;
  status: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GetPlansResponse {
  success: boolean;
  count: number;
  plans: PlanRecord[];
  error?: string;
}

export interface CreatePlanInput {
  id?: string;
  name: string;
  product?: string;
  monthly?: number;
  annual?: number;
  limit?: string;
  features?: number;
  status?: string;
  description?: string;
}

export interface CreatePlanResponse {
  success: boolean;
  plan?: PlanRecord;
  error?: string;
}

/**
 * SuperBlock Customer Analytics API types (GET /customeranalytics)
 */
export interface ApiCustomerRecord {
  user_id: string;
  customer_id?: string;
  business_account_id?: string | null;
  business_name?: string | null;
  business_phone_number_id?: string | null;
  business_portfolio_id?: string | null;
  created_at?: string | null;
  email?: string | null;
  user_email?: string | null;
  user_name?: string | null;
}

export interface CustomerAnalyticsApiResponse {
  success: boolean;
  count: number;
  users: ApiCustomerRecord[];
  error?: string;
}
