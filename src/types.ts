export type SeverityLevel = "low" | "medium" | "high";
export type IssueStatus = "submitted" | "active" | "assigned" | "in_progress" | "blocked" | "resolved";

export interface WorkDispatch {
  crewName: string;
  dispatchedAt: string;
  estimatedCompletion: string;
  dispatchWorkersCount?: number;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export interface IssueReport {
  id: string;
  photo: string; // Base64 or predetermined image asset reference
  latitude: number;
  longitude: number;
  address: string;
  description: string;
  category: string; // Pothole, Water Leak, Street Light, Graffiti, Trash/Debris, Other
  severity: SeverityLevel;
  department: string; // Dept of Transportation, Water & Power Dept, Sanitation, Parks & Rec
  status: IssueStatus;
  createdAt: string;
  credibilityScore: number;
  upvotes: number;
  upvotedBy?: string[];
  evidence: string[]; // List of supplementary descriptions added by community
  resolvedByCommunity: boolean;
  slaDueAt: string; // ISO string representing deadline
  escalated: boolean;
  duplicateOf: string | null; // ID of another parent report if it was combined
  workDispatch: WorkDispatch | null;
  actionSummary?: string;
  estimatedHoursToFix?: number;
  assignedWard?: string; // Ward this issue belongs to
  reportedBy?: string; // Username of citizen who submitted this
  assignedAgency?: string; // Agency username assigned to this
  completedAt?: string; // When completed
  completionPhoto?: string; // Uploaded photo
  aiCompletionTimerHrs?: number; // AI recommended dispatch/completion timer
}

export interface UserProfile {
  username: string;
  email?: string;
  password?: string;
  avatar?: string;
  ward?: string;
  phone?: string;
  bio?: string;
  xp: number;
  level: number;
  badges: {
    id: string;
    name: string;
    icon: string;
    description: string;
  }[];
  rank: number;
  wardRank?: number;
  role: "citizen" | "authority" | "agency";
  tasksCompletedCount?: number; // for agency leaderboard
  averageCompletionTimeHrs?: number; // for agency leaderboard
  workersCount?: number; // active field workforce crew members count
}

export interface Ward {
  id: string;
  name: string;
  coordinates: [number, number][];
  color: string;
  grade: string;
  status: string;
  isCustom: boolean;
  authorityUsername?: string; // Links custom ward to the authority who drew it
}

export interface HotspotPrediction {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  incidentCount: number;
  riskScore: number; // 0 - 100
  trend: "increasing" | "stable" | "decreasing";
  recommendedAction: string;
}

export interface GlobalStats {
  totalSubmitted: number;
  totalResolved: number;
  credibilityThresholdMet: number;
  averageSlaResolutionTimeHrs: number;
  activeWorkCrews: number;
  totalXPPremiumGranted: number;
}
