import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { IssueReport, IssueStatus, SeverityLevel, UserProfile, HotspotPrediction, GlobalStats, AuditRecord, Ward } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parsing middlewares - support large payloads (base64 image uploads)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Shared database structures kept in-memory for the container runtime session
let reports: IssueReport[] = [];

// Default Ward boundaries database managed on the backend
let wards: Ward[] = [];

// Initial database pool of gamified user profiles supporting multi-roles
let leaderboard: UserProfile[] = [];
let announcements: { ward: string, text: string }[] = [];
let activeOtps: Record<string, string> = {};

// Database Persistence Logic
const DB_PATH = path.join(process.cwd(), "db_persistence.json");

function seedDefaultData() {
  leaderboard = [
    {
      username: "citizen",
      email: "citizen@civic.com",
      password: "password",
      role: "citizen",
      ward: "Ward I - Central Corridor",
      xp: 450,
      level: 1,
      rank: 2,
      wardRank: 1,
      badges: [{ id: "b1", name: "Pioneer Reporter", icon: "Award", description: "Amongst the first to join and file incident reports." }]
    },
    {
      username: "authority",
      email: "authority@muni.gov",
      password: "password",
      role: "authority",
      ward: "Municipal Control HQ",
      xp: 1200,
      level: 2,
      rank: 1,
      wardRank: 1,
      badges: [{ id: "b2", name: "Grand Dispatcher", icon: "Shield", description: "Command room authorization confirmed." }]
    },
    {
      username: "agency",
      email: "agency@workforce.org",
      password: "password",
      role: "agency",
      ward: "Ward I - Central Corridor",
      xp: 850,
      level: 1,
      rank: 3,
      wardRank: 2,
      badges: [{ id: "b3", name: "Action Hero", icon: "Wrench", description: "Quick response resolution agent." }],
      tasksCompletedCount: 4,
      averageCompletionTimeHrs: 2.5,
      workersCount: 8
    }
  ];

  wards = [];
  announcements = [
    {
      ward: "Ward I - Central Corridor",
      text: "Notice: Scheduled electrical maintenance along Central Corridor on Friday morning. Please expect brief power transitions."
    },
    {
      ward: "Ward II - Suburban West",
      text: "Monsoon Preparedness: Clean-up drive scheduled for Saturday. Volunteers meet at Kothrud Fire Station."
    },
    {
      ward: "All Regions",
      text: "Global Advisory: General monsoon emergency guidelines are active. Report localized waterlogging immediately."
    }
  ];

  reports = [];

  globalStats = {
    totalSubmitted: 0,
    totalResolved: 0,
    credibilityThresholdMet: 0,
    averageSlaResolutionTimeHrs: 0,
    activeWorkCrews: 0,
    totalXPPremiumGranted: 0
  };

  auditTrail = [];
  seedHotspots();
}

function seedHotspots() {
  HotspotPredictions = [
    {
      id: "h1",
      category: "Waterlogging / Flooding Risk",
      latitude: 18.515,
      longitude: 73.815,
      address: "Kothrud Depot Junction, Ward II",
      incidentCount: 14,
      riskScore: 92,
      trend: "increasing",
      recommendedAction: "Clear secondary storm drainage inlets and install temporary water pumps near Bavdhan Foothills."
    },
    {
      id: "h2",
      category: "Pothole Density Cluster",
      latitude: 18.522,
      longitude: 73.855,
      address: "Deccan Gymkhana Main Crossing, Ward I",
      incidentCount: 9,
      riskScore: 78,
      trend: "stable",
      recommendedAction: "Deploy high-friction bituminous resurfacing layer prior to expected seasonal heavy precipitation index."
    },
    {
      id: "h3",
      category: "Garbage Accumulation Spill",
      latitude: 18.528,
      longitude: 73.852,
      address: "Central Market Boulevard, Ward I",
      incidentCount: 18,
      riskScore: 65,
      trend: "decreasing",
      recommendedAction: "Install high-capacity sensor-driven compactors and schedule automated bi-daily sanitation sweeps."
    }
  ];
}

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf8");
      if (raw.trim()) {
        const data = JSON.parse(raw);
        reports = data.reports || [];
        wards = data.wards || [];
        announcements = data.announcements || [];
        leaderboard = data.leaderboard || [];
        if (leaderboard.length === 0) {
          console.log("Leaderboard is empty in database. Seeding default data...");
          seedDefaultData();
          saveDatabase();
        }
        HotspotPredictions = data.hotspots || [];
        if (HotspotPredictions.length === 0) {
          seedHotspots();
        }
        leaderboard.forEach(u => {
          if (u.role === "agency" && !u.workersCount) {
            u.workersCount = Math.floor(Math.random() * 6) + 4; // realistic fallback random size 4-9
          }
        });
        globalStats = data.globalStats || {
          totalSubmitted: 0,
          totalResolved: 0,
          credibilityThresholdMet: 0,
          averageSlaResolutionTimeHrs: 0,
          activeWorkCrews: 0,
          totalXPPremiumGranted: 0
        };
        auditTrail = data.auditTrail || [];
        recalculateGlobalStats();
        console.log(`Successfully restored persistent database: ${reports.length} reports, ${wards.length} wards, ${leaderboard.length} users.`);
        return;
      }
    }
    console.log("Persistence data missing or empty. Formatting a newly seeded state...");
    seedDefaultData();
    saveDatabase();
  } catch (err) {
    console.warn("Unable to read local seed DB. Creating empty standard structures:", err);
    seedDefaultData();
  }
}

function saveDatabase() {
  try {
    recalculateGlobalStats();
    console.log(`Saving database: ${reports.length} reports, ${leaderboard.length} users.`);
    const data = { reports, wards, leaderboard, globalStats, auditTrail, announcements, hotspots: HotspotPredictions };
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to commit database changes to disk.", err);
  }
}

// Helper to calculate both global and ward-specific ranks
function updateRankingsAndWards() {
  // Sort leaderboard by XP decreasing
  leaderboard.sort((a, b) => b.xp - a.xp);
  
  // Assign global ranks
  leaderboard.forEach((item, index) => {
    item.rank = index + 1;
  });

  // Now group and rank by ward
  const wardGroups: { [key: string]: UserProfile[] } = {};
  leaderboard.forEach(item => {
    if (item.ward) {
      if (!wardGroups[item.ward]) {
        wardGroups[item.ward] = [];
      }
      wardGroups[item.ward].push(item);
    }
  });

  // Score and rank inside each ward
  Object.keys(wardGroups).forEach(wardName => {
    const list = wardGroups[wardName];
    // List is already sorted globally by XP, but let's sort to be safe
    list.sort((a, b) => b.xp - a.xp);
    list.forEach((item, index) => {
      item.wardRank = index + 1;
    });
  });
}

// Helper to find or register a user context dynamically based on incoming headers
function getUserFromRequest(req: Request): UserProfile {
  let username = (req.headers["x-username"] as string || "").trim();
  if (!username) {
    username = "CitizenResident";
  }

  let profile = leaderboard.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!profile) {
    // Automatically register a new user in our state system
    profile = {
      username: username,
      xp: 0,
      level: 1,
      ward: "Unassigned Corridor",
      badges: [
        { id: `b-new-${Date.now()}`, name: "New Recruit", icon: "Check", description: "Created an account on the decentralized portal." }
      ],
      rank: leaderboard.length + 1,
      wardRank: 1,
      role: "citizen"
    };
    leaderboard.push(profile);
  }

  updateRankingsAndWards();

  return profile;
}

let HotspotPredictions: HotspotPrediction[] = [];

let globalStats: GlobalStats = {
  totalSubmitted: 0,
  totalResolved: 0,
  credibilityThresholdMet: 0,
  averageSlaResolutionTimeHrs: 0,
  activeWorkCrews: 0,
  totalXPPremiumGranted: 0
};

function recalculateGlobalStats() {
  const submittedCount = reports.length;
  const resolvedReports = reports.filter(r => r.status === "resolved");
  const credibilityCount = reports.filter(r => r.credibilityScore >= 20).length;
  const activeDispatches = reports.filter(r => r.status === "assigned" || r.status === "in_progress").length;

  let avgHrs = 4; // fallback default
  if (resolvedReports.length > 0) {
    let totalDuration = 0;
    let countedResolved = 0;
    resolvedReports.forEach(r => {
      if (r.completedAt) {
        const start = r.workDispatch ? new Date(r.workDispatch.dispatchedAt) : new Date(r.createdAt);
        const finish = new Date(r.completedAt);
        const duration = Math.max(0.1, (finish.getTime() - start.getTime()) / (3600 * 1000));
        totalDuration += duration;
        countedResolved++;
      }
    });
    if (countedResolved > 0) {
      avgHrs = Math.round(totalDuration / countedResolved);
    }
  }

  globalStats = {
    totalSubmitted: Math.max(globalStats.totalSubmitted, submittedCount),
    totalResolved: Math.max(globalStats.totalResolved, resolvedReports.length),
    credibilityThresholdMet: Math.max(globalStats.credibilityThresholdMet, credibilityCount),
    averageSlaResolutionTimeHrs: avgHrs || 4,
    activeWorkCrews: activeDispatches,
    totalXPPremiumGranted: globalStats.totalXPPremiumGranted || 0
  };
}

let auditTrail: AuditRecord[] = [];

// Lazy Gemini SDK client initialization
let geminiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!geminiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      geminiInstance = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("Lazy initialized GoogleGenAI with custom API key");
    } else {
      console.warn("GEMINI_API_KEY environment variable is missing or placeholder. Running in smart simulation mode.");
    }
  }
  return geminiInstance;
}

// Helper to call Gemini with exponential backoff on transient errors (503 / 429)
async function callGeminiWithRetry(
  aiClient: any,
  params: any,
  retries = 3,
  delayMs = 1000
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await aiClient.models.generateContent(params);
    } catch (err: any) {
      const errStr = String(err?.message || err || "");
      const isTransient =
        err?.status === 503 ||
        err?.status === 429 ||
        errStr.includes("503") ||
        errStr.includes("429") ||
        errStr.includes("UNAVAILABLE") ||
        errStr.includes("RESOURCE_EXHAUSTED");

      if (isTransient && attempt < retries) {
        console.warn(`Gemini high demand or rate limit detected (attempt ${attempt}/${retries}). Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      } else {
        throw err;
      }
    }
  }
}

// Smart local matching fallback if Gemini API key is missing
function mockAnalyzeDescription(description: string, imageAvailable: boolean) {
  const lowercase = description.toLowerCase();
  let category = "Other";
  let department = "Parks & Rec";
  let severity: SeverityLevel = "low";
  let estimatedHoursToFix = 4;
  let actionSummary = "Issue needs assessment by local city personnel.";

  if (lowercase.includes("pothole") || lowercase.includes("hole") || lowercase.includes("asphalt") || lowercase.includes("cracks") || lowercase.includes("road")) {
    category = "Pothole";
    department = "Department of Transportation";
    severity = lowercase.includes("severe") || lowercase.includes("deep") || lowercase.includes("danger") ? "high" : "medium";
    estimatedHoursToFix = severity === "high" ? 4 : 8;
    actionSummary = "Detected asphalt deep surface hazard requiring mastic seal patch.";
  } else if (lowercase.includes("leak") || lowercase.includes("burst") || lowercase.includes("water") || lowercase.includes("flooding") || lowercase.includes("pipe") || lowercase.includes("hydrant")) {
    category = "Water Leak";
    department = "Water & Power Dept";
    severity = lowercase.includes("burst") || lowercase.includes("flood") || lowercase.includes("flowing") ? "high" : "medium";
    estimatedHoursToFix = severity === "high" ? 6 : 12;
    actionSummary = "Sidewalk water source pressure line leak requiring pressure isolation.";
  } else if (lowercase.includes("light") || lowercase.includes("lamp") || lowercase.includes("dark") || lowercase.includes("bulb") || lowercase.includes("unlit")) {
    category = "Street Light";
    department = "Department of Transportation";
    severity = lowercase.includes("dark corner") || lowercase.includes("completely dark") ? "medium" : "low";
    estimatedHoursToFix = 2;
    actionSummary = "High efficacy bulb or pole circuit malfunction requiring service diagnostics.";
  } else if (lowercase.includes("graffiti") || lowercase.includes("spray") || lowercase.includes("tag") || lowercase.includes("paint") || lowercase.includes("vandal")) {
    category = "Graffiti";
    department = "Parks & Rec";
    severity = "low";
    estimatedHoursToFix = 3;
    actionSummary = "Graffiti defacement on street furniture or recreational masonry wall.";
  } else if (lowercase.includes("trash") || lowercase.includes("furniture") || lowercase.includes("garbage") || lowercase.includes("dump") || lowercase.includes("debris") || lowercase.includes("mattress")) {
    category = "Trash/Debris";
    department = "Sanitation Department";
    severity = lowercase.includes("blocking") || lowercase.includes("ramp") || lowercase.includes("hazard") ? "medium" : "low";
    estimatedHoursToFix = 1;
    actionSummary = "Illegal roadside bulk dumping obstructing thoroughfare space.";
  }

  return {
    category,
    severity,
    department,
    actionSummary,
    estimatedHoursToFix,
    simulated: true
  };
}

// Helper to safely get user profile for stats & reports (without failing if unauthorized)
function tryRegisterUser(req: Request) {
  try {
    const rawUsername = req.headers["x-username"] as string;
    if (rawUsername && rawUsername.trim() !== "") {
      req.headers["x-username"] = rawUsername.trim();
      getUserFromRequest(req);
    }
  } catch (e) {
    console.error("Safe session reconstruction failed", e);
  }
}

// 1. GET /api/reports
app.get("/api/reports", (req: Request, res: Response) => {
  try {
    const userProfile = getUserFromRequest(req);
    // Allow authorities to see all reports on the map.
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve reports database" });
  }
});

// 2. GET /api/stats
app.get("/api/stats", (req: Request, res: Response) => {
  try {
    tryRegisterUser(req);
    res.json({
      globalStats,
      hotspots: HotspotPredictions,
      leaderboard: leaderboard // Allow all roles to see the leaderboard
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve statistics summary" });
  }
});

// 3. GET /api/audit
app.get("/api/audit", (req: Request, res: Response) => {
  try {
    tryRegisterUser(req);
    res.json(auditTrail);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve audit trail logs" });
  }
});

// 4. POST /api/reports - Citizens submit a report
app.post("/api/reports", async (req: Request, res: Response) => {
  try {
    const { photo, description, latitude, longitude, address, category, ward } = req.body;

    if (!description || !latitude || !longitude) {
       res.status(400).json({ error: "Missing required parameters: description, latitude, and longitude are required." });
       return;
    }

    const reportId = `rep-${Date.now()}`;
    const cleanAddress = address || "Unspecified tagged GPS coordinate";

    console.log(`Analyzing new civic incident report raw feedback...`);

    let triageResult;
    let fallbackStatus = false;
    const aiClient = getGeminiClient();

    if (aiClient) {
      try {
        console.log("Analyzing with Gemini 3.5 Triage Vision Engine...");
        const parts: any[] = [
          {
            text: `You are a high-speed municipal civic AI triage classifier. Analyze this report text and optionally accompanying image to determine the appropriate routing attributes.
            Report Description: "${description}"

            Identify:
            1. category: STRICTLY select from: ["Pothole", "Water Leak", "Street Light", "Graffiti", "Trash/Debris", "Other"]
            2. severity: STRICTLY select one of: ["low", "medium", "high"]
            3. department: STRICTLY select one of: ["Department of Transportation", "Water & Power Dept", "Sanitation Department", "Parks & Rec"]
            4. actionSummary: Provide a highly concise, elegant 1-sentence summary of the hazard context and required crew tools.
            5. estimatedHoursToFix: Provide a realistic repair work duration (as integer hours, usually between 1 and 24).`
          }
        ];

        // If there's an image payload, send it to the Gemini vision parts list as well
        if (photo && photo.startsWith("data:image/")) {
          const imageRegex = /^data:(image\/\w+);base64,(.+)$/;
          const match = photo.match(imageRegex);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
            console.log("Appended citizen image payload to Gemini request.");
          }
        }

        const aiResponse = await callGeminiWithRetry(aiClient, {
          model: "gemini-3.5-flash",
          contents: { parts },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  description: "Must be: 'Pothole', 'Water Leak', 'Street Light', 'Graffiti', 'Trash/Debris', or 'Other'."
                },
                severity: {
                  type: Type.STRING,
                  description: "Assess severity: 'low', 'medium', or 'high'."
                },
                department: {
                  type: Type.STRING,
                  description: "Select most relevant: 'Department of Transportation', 'Water & Power Dept', 'Sanitation Department', 'Parks & Rec'."
                },
                actionSummary: {
                  type: Type.STRING,
                  description: "Concisely explain technical repair scope."
                },
                estimatedHoursToFix: {
                  type: Type.INTEGER,
                  description: "Expected technician hours."
                }
              },
              required: ["category", "severity", "department", "actionSummary", "estimatedHoursToFix"]
            }
          }
        });

        const rawText = aiResponse.text?.trim() || "";
        triageResult = JSON.parse(rawText);
        console.log("Successful auto-triage response received from system model.");
      } catch (geminiError: any) {
        console.log("Gracefully activated the secondary local routing heuristic to finalize classification.");
        triageResult = mockAnalyzeDescription(description, !!photo);
        fallbackStatus = true;
      }
    } else {
      // API Key missing - run robust simulated triage
      triageResult = mockAnalyzeDescription(description, !!photo);
      fallbackStatus = true;
    }

    // EXPLICIT SELECTION OVERRIDE: If the citizen manually designated the category, respect it!
    if (category) {
      triageResult.category = category;
      
      // Map standard department matching the manually selected category
      const departmentMapping: { [key: string]: string } = {
        "Pothole": "Department of Transportation",
        "Water Leak": "Water & Power Dept",
        "Street Light": "Department of Transportation",
        "Graffiti": "Parks & Rec",
        "Trash/Debris": "Sanitation Department",
        "Other": "Parks & Rec"
      };
      if (departmentMapping[category]) {
        triageResult.department = departmentMapping[category];
      }
    }

    // Duplicate check logic helper (within 300 meters and matching solved category)
    const duplicateThresholdDegrees = 0.003; // ~300 meters
    let foundDup: IssueReport | null = null;
    const finalCategory = triageResult.category || "Other";
    for (const rep of reports) {
      if (rep.status !== "resolved") {
        const distLat = Math.abs(rep.latitude - latitude);
        const distLong = Math.abs(rep.longitude - longitude);
        if (distLat < duplicateThresholdDegrees && distLong < duplicateThresholdDegrees) {
          if (rep.category && finalCategory && rep.category.toLowerCase().trim() === finalCategory.toLowerCase().trim()) {
            foundDup = rep;
            break;
          }
        }
      }
    }

    // SLA Duration Mapping based on Severity
    const slaOffsetsHrs = {
      low: 120,    // 5 days
      medium: 72,  // 3 days
      high: 24     // 1 day
    };
    const chosenSeverity = (triageResult.severity?.toLowerCase() || "low") as SeverityLevel;
    const offsetHrs = slaOffsetsHrs[chosenSeverity] || 72;
    const slaDate = new Date(Date.now() + offsetHrs * 3600000).toISOString();

    // Ray-Casting algorithm to find which Ward contains the coordinates
    let matchedWardName = ward || "Ward I - Civic Hub"; // default fallback
    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    function isPointInPoly(pt: [number, number], vs: [number, number][]) {
      const x = pt[0], y = pt[1];
      let inside = false;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    if (!ward) {
      for (const w of wards) {
        if (isPointInPoly([latNum, lngNum], w.coordinates)) {
          matchedWardName = w.name;
          break;
        }
      }
    }

    // If the photo was empty or a default placeholder, map it to a category preset image!
    let finalPhoto = photo || "default_card_placeholder";
    if (!photo || photo === "default_card_placeholder" || photo.trim() === "") {
      const categoryPresets: { [key: string]: string } = {
        "Pothole": "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop",
        "Water Leak": "https://images.unsplash.com/photo-1542013936693-8848e574047e?q=80&w=600&auto=format&fit=crop",
        "Street Light": "https://images.unsplash.com/photo-1508849789987-4e5333c12b78?q=80&w=600&auto=format&fit=crop",
        "Graffiti": "https://images.unsplash.com/photo-1525909002-1b0570d860d4?q=80&w=600&auto=format&fit=crop",
        "Trash/Debris": "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?q=80&w=600&auto=format&fit=crop",
        "Other": "https://images.unsplash.com/photo-1473163928189-364b2c4e1135?q=80&w=600&auto=format&fit=crop"
      };
      
      const chosenCategory = triageResult.category || "Other";
      finalPhoto = categoryPresets[chosenCategory] || categoryPresets["Other"]; 
    }

    const userProfile = getUserFromRequest(req);

    const newReport: IssueReport = {
      id: reportId,
      photo: finalPhoto,
      latitude: Number(latitude),
      longitude: Number(longitude),
      address: cleanAddress,
      description,
      category: triageResult.category || "Other",
      severity: chosenSeverity,
      department: triageResult.department || "Parks & Rec",
      status: "submitted",
      createdAt: new Date().toISOString(),
      credibilityScore: 10, // Initial submission starting score
      upvotes: 1,
      upvotedBy: [userProfile.username],
      evidence: [],
      resolvedByCommunity: false,
      slaDueAt: slaDate,
      escalated: false,
      duplicateOf: foundDup ? foundDup.id : null,
      workDispatch: null,
      actionSummary: triageResult.actionSummary || "Civic hazard filed.",
      estimatedHoursToFix: triageResult.estimatedHoursToFix || 3,
      assignedWard: matchedWardName,
      reportedBy: userProfile.username
    };

    reports.unshift(newReport);

    // Update global state
    globalStats.totalSubmitted += 1;
    userProfile.xp += 150; // Plus 150 XP for contributing to community safety!
    if (userProfile.xp >= userProfile.level * 1000) {
      userProfile.level += 1;
    }

    // Add audit logs
    const actionDetails = foundDup
      ? `Merged as duplicate of primary incident ${foundDup.id}.`
      : `Auto-routed to ${newReport.department} under SLA of ${offsetHrs} hours.`;

    auditTrail.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: userProfile.username,
      action: foundDup ? "Duplicate Auto-Merged" : "Citizen Incident Submitted",
      details: `Hazard filed at ${cleanAddress}. Category matched: ${newReport.category} (Severity: ${newReport.severity}). ${actionDetails}`
    });

    saveDatabase();

    res.json({
      success: true,
      report: newReport,
      xpGained: 150,
      userState: userProfile,
      duplicateDetected: !!foundDup,
      parentReportId: foundDup?.id || null,
      diagnostics: {
        fallbackSimulation: fallbackStatus
      }
    });

  } catch (error: any) {
    console.error("Critical error processing issue submission:", error);
    res.status(500).json({ error: "Failed to securely parse or register incident reporting card: " + error.message });
  }
});

// 5. POST /api/reports/:id/upvote - Upvoted by community members, increasing credibility
app.post("/api/reports/:id/upvote", (req: Request, res: Response) => {
  const { id } = req.params;
  const rep = reports.find(r => r.id === id);

  if (!rep) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (!rep.upvotedBy) {
    rep.upvotedBy = [];
  }

  const username = (req.headers["x-username"] as string || "").trim() || "CitizenResident";

  const alreadyUpvoted = rep.upvotedBy.some(u => u.toLowerCase() === username.toLowerCase());
  if (alreadyUpvoted) {
    res.status(400).json({ error: "You have already verified this report." });
    return;
  }

  rep.upvotedBy.push(username);
  rep.upvotes += 1;
  rep.credibilityScore += 10; // Each client upvote adds 10 credibility

  // If status is submitted, and it hits a credibility threshold (e.g. 20), transition to active state!
  if (rep.status === "submitted" && rep.credibilityScore >= 20) {
    rep.status = "active";
    globalStats.credibilityThresholdMet += 1;

    auditTrail.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: "Community Moderation Engine",
      action: "Status Escalated to Active",
      details: `Incident card ${rep.id} met community credibility limit of 20 score points. Assigned department SLA timer officially validated.`
    });
  }

  const userProfile = getUserFromRequest(req);
  userProfile.xp += 25; // Voter receives 25 XP for moderating feed
  if (userProfile.xp >= userProfile.level * 1000) {
    userProfile.level += 1;
  }

  saveDatabase();

  res.json({
    success: true,
    report: rep,
    voterXp: userProfile.xp
  });
});

// 6. POST /api/reports/:id/evidence - Community adds additional notes or validation text evidence
app.post("/api/reports/:id/evidence", (req: Request, res: Response) => {
  const { id } = req.params;
  const { text } = req.body;
  const rep = reports.find(r => r.id === id);

  if (!rep) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (!text) {
    res.status(400).json({ error: "Evidence text cannot be empty" });
    return;
  }

  rep.evidence.push(`Community note: "${text}"`);
  rep.credibilityScore += 15; // Structured evidence boosts health score!

  const userProfile = getUserFromRequest(req);
  auditTrail.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: userProfile.username,
    action: "Evidence Logged",
    details: `Added supplementary text review to ticket card ${rep.id}. Credibility score boosted.`
  });

  userProfile.xp += 50;
  if (userProfile.xp >= userProfile.level * 1000) {
    userProfile.level += 1;
  }

  saveDatabase();

  res.json({
    success: true,
    report: rep,
    xp: userProfile.xp
  });
});

// 7. POST /api/reports/:id/resolve-community - Community flags as resolved (Peer Verification)
app.post("/api/reports/:id/resolve-community", (req: Request, res: Response) => {
  const { id } = req.params;
  const rep = reports.find(r => r.id === id);

  if (!rep) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  rep.resolvedByCommunity = true;
  rep.credibilityScore += 30;

  const userProfile = getUserFromRequest(req);
  // Let's also log
  auditTrail.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: userProfile.username,
    action: "Citizen Validation Logged",
    details: `Endorsed peer-to-peer visual resolution on ticket card ${rep.id}.`
  });

  userProfile.xp += 100;
  if (userProfile.xp >= userProfile.level * 1000) {
    userProfile.level += 1;
  }

  saveDatabase();

  res.json({
    success: true,
    report: rep
  });
});

// 8. POST /api/reports/:id/status - Authority workflow (Dept dispatcher or field crew state updates)
app.post("/api/reports/:id/status", (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, crewName, estimatedHours } = req.body;
  const rep = reports.find(r => r.id === id);

  if (!rep) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (status) {
    const prevStatus = rep.status;
    rep.status = status as IssueStatus;

    if (rep.status === "resolved") {
      globalStats.totalResolved += 1;
    }

    auditTrail.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: `${rep.department} Dispatcher`,
      action: "Workforce State Modified",
      details: `Ticket card ${rep.id} transit from status '${prevStatus}' to '${status}'.`
    });
  }

  if (crewName) {
    rep.workDispatch = {
      crewName,
      dispatchedAt: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + (estimatedHours || 2) * 3600000).toISOString()
    };
    rep.status = "in_progress";

    auditTrail.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: `${rep.department} Dispatcher`,
      action: "Crew Dispatched",
      details: `Field task assignment verified for crew: "${crewName}". Marked status in-progress.`
    });
  }

  saveDatabase();

  res.json({
    success: true,
    report: rep
  });
});

// 8.5. POST /api/reports/:id/dispatch - Authority assigns report to a Worker/Agency with AI recommendations
app.post("/api/reports/:id/dispatch", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { agencyUsername, workersCount } = req.body;
  const userProfile = getUserFromRequest(req);

  if (userProfile.role !== "authority") {
    res.status(403).json({ error: "Only authorized personnel can dispatch municipal issues." });
    return;
  }

  const rep = reports.find(r => r.id === id);
  if (!rep) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const agency = leaderboard.find(u => u.username === agencyUsername && u.role === "agency");
  if (!agency) {
    res.status(404).json({ error: "Assigned Work Agency not found" });
    return;
  }

  // Calculate AI Recommended completion time based on description & severity
  let aiCompletionTimerHrs = 12; // default
  if (rep.severity === "high") {
    aiCompletionTimerHrs = 4;
  } else if (rep.severity === "medium") {
    aiCompletionTimerHrs = 8;
  } else {
    aiCompletionTimerHrs = 24;
  }

  // Query Gemini for smart evaluation if key exists
  const aiClient = getGeminiClient();
  if (aiClient) {
    try {
      const gResponse = await callGeminiWithRetry(aiClient, {
        model: "gemini-3.5-flash",
        contents: `Recommend a professional municipal repair completion time (integer value in hours, strictly between 1 and 48) for this dispatched issue.
        Issue description: "${rep.description}"
        Severity level: "${rep.severity}"
        Category: "${rep.category}"
        Output a single raw integer number only.`
      });
      const parsedVal = parseInt(gResponse.text?.trim() || "", 10);
      if (!isNaN(parsedVal) && parsedVal > 0) {
        aiCompletionTimerHrs = parsedVal;
      }
    } catch {
      // safe precalculated fallback on failure
    }
  }

  rep.status = "assigned";
  rep.assignedAgency = agencyUsername;
  rep.aiCompletionTimerHrs = aiCompletionTimerHrs;
  rep.workDispatch = {
    crewName: `${agencyUsername} Mobile Unit`,
    dispatchedAt: new Date().toISOString(),
    estimatedCompletion: new Date(Date.now() + aiCompletionTimerHrs * 3600000).toISOString(),
    dispatchWorkersCount: Number(workersCount) || Number(agency?.workersCount) || 5
  };

  auditTrail.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: userProfile.username,
    action: "Agency Dispatched",
    details: `Dispatched '${rep.category}' issue at ${rep.address} to ${agencyUsername} (Completion Limit: AI Estimated ${aiCompletionTimerHrs} hrs).`
  });

  saveDatabase();

  res.json({ success: true, report: rep });
});

// 8.5.5. POST /api/reports/:id/accept - Agency accepts an assigned dispatch
app.post("/api/reports/:id/accept", (req: Request, res: Response) => {
  const { id } = req.params;
  const userProfile = getUserFromRequest(req);

  if (userProfile.role !== "agency") {
    res.status(403).json({ error: "Only worker agencies can accept assignments." });
    return;
  }

  const rep = reports.find(r => r.id === id);
  if (!rep) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (rep.status !== "assigned") {
    res.status(400).json({ error: "Only assigned tasks can be accepted." });
    return;
  }

  rep.status = "in_progress";

  auditTrail.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: userProfile.username,
    action: "Agency Task Accepted",
    details: `Agency '${userProfile.username}' accepted the task '${rep.category}' at '${rep.address}'.`
  });

  saveDatabase();

  res.json({ success: true, report: rep });
});

// 8.5.6. POST /api/reports/:id/reject - Agency rejects an assigned dispatch
app.post("/api/reports/:id/reject", (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userProfile = getUserFromRequest(req);

  if (userProfile.role !== "agency") {
    res.status(403).json({ error: "Only worker agencies can reject assignments." });
    return;
  }

  const rep = reports.find(r => r.id === id);
  if (!rep) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (rep.status !== "assigned") {
    res.status(400).json({ error: "Only assigned tasks can be rejected." });
    return;
  }

  rep.status = "active"; // Demote status back to active so it can be redispatched
  rep.assignedAgency = undefined;
  rep.workDispatch = null;

  auditTrail.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: userProfile.username,
    action: "Agency Task Rejected",
    details: `Agency '${userProfile.username}' rejected the task '${rep.category}' at '${rep.address}'. Reason: ${reason || "No reason specified"}.`
  });

  saveDatabase();

  res.json({ success: true, report: rep });
});

// 8.6. POST /api/reports/:id/complete - Worker completes work, uploads Base64 asset proof, and gets points
app.post("/api/reports/:id/complete", (req: Request, res: Response) => {
  const { id } = req.params;
  const { completionPhoto, resolvedPhoto } = req.body;
  const userProfile = getUserFromRequest(req);

  if (userProfile.role !== "agency") {
    res.status(403).json({ error: "Only worker agencies can complete assigned dispatches." });
    return;
  }

  const rep = reports.find(r => r.id === id);
  if (!rep) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  rep.status = "resolved";
  rep.completedAt = new Date().toISOString();
  rep.completionPhoto = completionPhoto || resolvedPhoto || "completed_resolved_proof";

  globalStats.totalResolved += 1;

  // calculate real-world completion hour difference
  const start = rep.workDispatch ? new Date(rep.workDispatch.dispatchedAt) : new Date(rep.createdAt);
  const finish = new Date(rep.completedAt);
  const actualDurationHrs = Math.max(0.1, (finish.getTime() - start.getTime()) / (3600 * 1000));

  // reward Worker / Agency with XP based on estimated and actual completion time
  const estimatedLimit = rep.aiCompletionTimerHrs || 12;
  const isWithinSLA = actualDurationHrs <= estimatedLimit;
  
  // Base award is 300 XP
  // If completed within the estimated time, award a fast-completion bonus.
  // Formula: Bonus = Math.round((estimatedLimit - actualDurationHrs) * 50)
  // Ensure the bonus is at least 50 XP if they are within SLA, and caps at a maximum of 300 XP.
  let timeBonus = 0;
  if (isWithinSLA) {
    timeBonus = Math.min(300, Math.max(50, Math.round((estimatedLimit - actualDurationHrs) * 50)));
  } else {
    // Overdue fallback scaled relative to estimate:
    timeBonus = Math.max(10, Math.round((estimatedLimit / actualDurationHrs) * 50));
  }
  const totalAwardedXp = 300 + timeBonus;

  userProfile.xp += totalAwardedXp;
  userProfile.tasksCompletedCount = (userProfile.tasksCompletedCount || 0) + 1;
  const currentAvg = userProfile.averageCompletionTimeHrs || 0;
  userProfile.averageCompletionTimeHrs = Number(((currentAvg * (userProfile.tasksCompletedCount - 1) + actualDurationHrs) / userProfile.tasksCompletedCount).toFixed(1));

  if (userProfile.xp >= userProfile.level * 1000) {
    userProfile.level += 1;
  }

  // reward citizen reporter with partial resolution bonus
  let originalReporter = "CivicKnight99";
  const matchedAudit = auditTrail.find(a => a.action === "Citizen Incident Submitted" && a.details.includes(rep.id));
  if (matchedAudit) {
    originalReporter = matchedAudit.actor;
  }
  const reporterProfile = leaderboard.find(u => u.username === originalReporter);
  if (reporterProfile) {
    reporterProfile.xp += 100;
    if (reporterProfile.xp >= reporterProfile.level * 1000) {
      reporterProfile.level += 1;
    }
  }

  // update rankings
  updateRankingsAndWards();

  auditTrail.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: userProfile.username,
    action: "Ticket Resolved",
    details: `Task successfully resolved and verified. Proof photo attached. Completion time: ${actualDurationHrs.toFixed(1)} hrs vs AI Estimated limit of ${estimatedLimit} hrs. Awarded ${totalAwardedXp} XP (Base: 300, Speed/Estimate Bonus: ${timeBonus} XP).`
  });

  saveDatabase();

  res.json({ success: true, report: rep, userProfile, leaderboard });
});

// 8.7. Wards configuration endpoints
app.get("/api/wards", (req: Request, res: Response) => {
  const userProfile = getUserFromRequest(req);
  if (userProfile.role === "authority") {
    // Return only authorized wards for authorities
    const authorizedWards = wards.filter(w => w.authorityUsername === userProfile.username);
    res.json({ success: true, wards: authorizedWards });
  } else {
    // Return all wards for citizens/others
    res.json({ success: true, wards: wards });
  }
});

app.post("/api/wards", (req: Request, res: Response) => {
  const { name, coordinates, color, grade, status } = req.body;
  const userProfile = getUserFromRequest(req);
  if (userProfile.role !== "authority") {
    res.status(403).json({ error: "Only authorized personnel can mark municipal boundaries." });
    return;
  }

  if (!name || !coordinates || coordinates.length < 3) {
    res.status(400).json({ error: "Invalid boundary data. Coordinates require at least 3 vertex points." });
    return;
  }

  const newWard: Ward = {
    id: `ward-custom-${Date.now()}`,
    name,
    coordinates,
    color: color || "#6366f1",
    grade: grade || "B",
    status: status || "Monitored",
    isCustom: true,
    authorityUsername: userProfile.username
  };

  wards.push(newWard);

  auditTrail.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: userProfile.username,
    action: "Boundary Marked",
    details: `Created new corridor '${name}' with ${coordinates.length} vertices.`
  });

  saveDatabase();

  res.json({ success: true, ward: newWard, wards });
});

app.delete("/api/wards/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const userProfile = getUserFromRequest(req);
  if (userProfile.role !== "authority") {
    res.status(403).json({ error: "Only authorized personnel can delete municipal boundaries." });
    return;
  }

  const index = wards.findIndex(w => w.id === id);
  if (index === -1) {
    res.status(404).json({ error: "Ward not found." });
    return;
  }

  const deletedWard = wards[index];
  wards.splice(index, 1);

  auditTrail.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: userProfile.username,
    action: "Boundary Deleted",
    details: `Deleted corridor '${deletedWard.name}'.`
  });

  saveDatabase();

  res.json({ success: true, wards });
});

// 9. GET /api/users - Retrieve user profile details and top creators list
app.get("/api/users", (req: Request, res: Response) => {
  const userProfile = getUserFromRequest(req);
  res.json({
    userProfile,
    leaderboard
  });
});

// 9.5. PUT /api/profile - Update user profile information
app.put("/api/profile", (req: Request, res: Response) => {
  const userProfile = getUserFromRequest(req);
  const { email, phone, bio, avatar, ward } = req.body;

  if (email !== undefined) userProfile.email = email;
  if (phone !== undefined) userProfile.phone = phone;
  if (bio !== undefined) userProfile.bio = bio;
  if (avatar !== undefined) userProfile.avatar = avatar;
  if (ward !== undefined) userProfile.ward = ward;

  saveDatabase();

  res.json({
    success: true,
    userProfile,
    leaderboard
  });
});

// 10. GET /api/announcement/:ward
app.get("/api/announcement/:ward", (req: Request, res: Response) => {
  const ward = decodeURIComponent(req.params.ward).toLowerCase().trim();
  console.log(`GET /api/announcement/${ward}. Current announcements:`, JSON.stringify(announcements));
  let announcement = announcements.find(a => a.ward.toLowerCase().trim() === ward);
  if (!announcement && ward !== "all regions") {
    announcement = announcements.find(a => a.ward.toLowerCase().trim() === "all regions");
  }
  res.json({ success: true, announcement: announcement || null });
});

// 12. GET /api/all-announcements (DEBUG)
app.get("/api/all-announcements", (req: Request, res: Response) => {
  res.json({ success: true, announcements });
});

// 11. POST /api/announcement
app.post("/api/announcement", (req: Request, res: Response) => {
  const { text, ward: bodyWard } = req.body;
  const userProfile = getUserFromRequest(req);
  if (userProfile.role !== "authority") {
    res.status(403).json({ error: "Only authority can update announcements." });
    return;
  }
  const rawWard = bodyWard || userProfile.ward || "All Regions";
  const ward = rawWard.trim();
  const wardKey = ward.toLowerCase().trim();
  console.log(`Authority ${userProfile.username} is updating announcement for ward: ${ward}. Text: ${text}`);
  
  const index = announcements.findIndex(a => a.ward.toLowerCase().trim() === wardKey);
  if (index !== -1) {
    announcements[index].text = text;
    announcements[index].ward = ward;
    console.log(`Updated existing announcement for ${ward}.`);
  } else {
    announcements.push({ ward, text });
    console.log(`Created new announcement for ${ward}.`);
  }
  
  saveDatabase();
  console.log(`Current announcements state:`, JSON.stringify(announcements));
  res.json({ success: true, announcement: announcements.find(a => a.ward.toLowerCase().trim() === wardKey) });
});
app.post("/api/register", (req: Request, res: Response) => {
  const { email, username, password, ward, role, workersCount } = req.body;
  const chosenRole = role || "citizen";
  const finalWard = ward;

  if (!email || !username || !password || !finalWard) {
    res.status(400).json({ error: "All fields are required (Email, Name/Username, Password, and Ward Jurisdiction)" });
    return;
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  // Check if username or email already exists
  const exists = leaderboard.find(u => 
    u.username.toLowerCase() === cleanUsername.toLowerCase() || 
    (u.email && u.email.toLowerCase() === cleanEmail)
  );

  if (exists) {
    res.status(400).json({ error: "Username/Name or Email has already been registered." });
    return;
  }

  const newProfile: UserProfile = {
    username: cleanUsername,
    email: cleanEmail,
    password: password,
    ward: finalWard,
    xp: 0,
    level: 1,
    badges: [
      { id: `b-reg-${Date.now()}`, name: "Charter Citizen", icon: "User", description: `Registered an account with ${chosenRole} profile.` }
    ],
    avatar: ["🦊", "🐼", "🐨", "🐸", "🦁", "🦄", "🐙", "🦀", "🦋", "🌻", "🚀", "🛸", "🔥", "🌈", "⚡"][Math.floor(Math.random() * 15)],
    rank: leaderboard.length + 1,
    wardRank: 1,
    role: chosenRole,
    tasksCompletedCount: chosenRole === "agency" ? 0 : undefined,
    averageCompletionTimeHrs: chosenRole === "agency" ? 0 : undefined,
    workersCount: chosenRole === "agency" ? (Number(workersCount) || Math.floor(Math.random() * 8) + 3) : undefined
  };

  leaderboard.push(newProfile);
  updateRankingsAndWards();

  saveDatabase();

  res.json({
    success: true,
    userProfile: newProfile,
    leaderboard
  });
});

// POST /api/send-otp - Generate & register dynamic 6-digit OTP code for a citizen email
app.post("/api/send-otp", (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email address is required to dispatch OTP code." });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  activeOtps[cleanEmail] = generatedOtp;
  
  console.log(`[OTP DISPATCH] Dispatched secure code ${generatedOtp} for target ${cleanEmail}.`);
  
  res.json({
    success: true,
    email: cleanEmail,
    otp: generatedOtp,
    message: `Secure validation OTP successfully dispatched to simulated inbox at ${cleanEmail}.`
  });
});

// POST /api/verify-otp - Validate code against the in-memory active OTP cache
app.post("/api/verify-otp", (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) {
    res.status(400).json({ error: "Both email and verification code are required." });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const targetCode = code.trim();
  const savedCode = activeOtps[cleanEmail];

  if (savedCode && savedCode === targetCode) {
    // Clear code after single use for maximum security verification integrity
    delete activeOtps[cleanEmail];
    res.json({ success: true, verified: true });
  } else {
    res.status(400).json({ error: "Invalid, incorrect, or expired verification OTP code." });
  }
});

// 11. POST /api/login - Set active user session
app.post("/api/login", (req: Request, res: Response) => {
  const { email, password, username } = req.body;
  
  // Backward compatibility check for previous simple dynamic registration
  if (username && !email && !password) {
    req.headers["x-username"] = username.trim();
    const profile = getUserFromRequest(req);
    res.json({
      success: true,
      userProfile: profile,
      leaderboard
    });
    return;
  }

  if (!email || !password) {
    res.status(400).json({ error: "Email/Username and password are required" });
    return;
  }

  const identityKey = email.trim().toLowerCase();
  
  // Look up user by email or by username
  const profile = leaderboard.find(u => 
    (u.email && u.email.toLowerCase() === identityKey) ||
    u.username.toLowerCase() === identityKey
  );

  if (!profile) {
    res.status(401).json({ error: "Invalid credentials. User not found. Please register first." });
    return;
  }

  // Bypassing password for legacy usernames if they don't have one set up
  if (profile.password && profile.password !== password) {
    res.status(401).json({ error: "Incorrect password. Please try again." });
    return;
  }

  // If password was unset (legacy mock user), set it on the fly
  if (!profile.password) {
    profile.password = password;
  }

  saveDatabase();

  res.json({
    success: true,
    userProfile: profile,
    leaderboard
  });
});


app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { message, ward, username } = req.body;
    if (!message) {
      res.status(400).json({ error: "Missing required parameter: message is required." });
      return;
    }

    const aiClient = getGeminiClient();
    if (aiClient) {
      try {
        console.log("Analyzing citizen chat with Gemini...");
        const parts = [
          {
            text: `You are an intelligent, friendly civic chatbot for a smart city platform.
            The citizen who is chatting is named "${username || "CitizenResident"}" and their registered ward is "${ward || "Unknown Ward"}".

            User message: "${message}"

            Analyze the message and return a JSON response matching this schema:
            {
              "response": "Your conversational, helpful, empathetic and professional answer to the citizen. If they described a civic problem (like a pothole, leak, broken light, graffiti, trash, etc.) in their ward, summarize it nicely in your message and offer to submit it as a ticket directly to their registered ward.",
              "isComplaint": true/false (Set to true ONLY if they are describing/reporting a real-world civic problem or maintenance hazard that needs fixing in their neighborhood. Set to false if they are just asking general questions about the app, XP, wards, or general chatting.),
              "detectedCategory": "Pothole" | "Water Leak" | "Street Light" | "Graffiti" | "Trash/Debris" | "Other" (Must map to one of these exactly, only if isComplaint is true),
              "detectedDescription": "A concise, clear 1-sentence description summarizing the exact issue (e.g., 'Large water leak flooding the main avenue') (only if isComplaint is true)"
            }
            
            Always output clean JSON matching the schema.`
          }
        ];

        const aiResponse = await callGeminiWithRetry(aiClient, {
          model: "gemini-3.5-flash",
          contents: { parts },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                response: { type: Type.STRING },
                isComplaint: { type: Type.BOOLEAN },
                detectedCategory: { type: Type.STRING },
                detectedDescription: { type: Type.STRING }
              },
              required: ["response", "isComplaint"]
            }
          }
        });

        const rawText = aiResponse.text?.trim() || "";
        const result = JSON.parse(rawText);
        res.json({ success: true, ...result });
        return;
      } catch (geminiError: any) {
        console.error("Gemini Chat failed, falling back to local NLP heuristic:", geminiError);
      }
    }

    // Heuristic Local Parser Fallback
    const lowercase = message.toLowerCase();
    let response = "";
    let isComplaint = false;
    let detectedCategory = "Other";
    let detectedDescription = "";

    // Check for common questions
    if (lowercase.includes("how") && (lowercase.includes("report") || lowercase.includes("submit") || lowercase.includes("file"))) {
      response = "To report a problem, you can use the 'Civic Incident Form' on the left side of your dashboard. Choose the category, tag the coordinates on the interactive map, add a description, and hit 'Submit Citizen Report'. The system will automatically route it to your respective registered ward.";
    } else if (lowercase.includes("xp") || lowercase.includes("level") || lowercase.includes("badge") || lowercase.includes("credibility")) {
      response = "You earn 150 XP for every new issue report you file, and 50 XP for contributing verification evidence or upvoting existing issues. Gaining XP levels up your profile, which boosts your citizen credibility score!";
    } else if (lowercase.includes("sla") || lowercase.includes("how long") || lowercase.includes("time to fix")) {
      response = "Municipal response times follow strict SLAs: High-severity hazards (like burst water mains or dangling wires) have a 24-hour SLA. Medium-severity issues have a 72-hour (3-day) SLA, and low-severity complaints are scheduled for completion within 120 hours (5 days).";
    } else if (lowercase.includes("ward") || lowercase.includes("jurisdiction") || lowercase.includes("zone")) {
      response = `Your assigned jurisdiction is "${ward || "Ward I - Central Corridor"}". The system automatically ensures all incidents submitted by you are directed to this ward's specialized maintenance crews.`;
    } else if (lowercase.includes("hello") || lowercase.includes("hi ") || lowercase.includes("hey")) {
      response = `Hello ${username || "Citizen"}! I am your interactive Civic Assistant. I can help answer common questions about our smart city or register complaints for ${ward || "your registered ward"}. What's on your mind today?`;
    } else {
      // Check if it looks like a complaint
      const keywords = ["pothole", "leak", "water", "flood", "light", "dark", "lamp", "bulb", "trash", "debris", "garbage", "graffiti", "spray", "broken", "hazard", "vandal"];
      const containsKeyword = keywords.some(kw => lowercase.includes(kw));

      if (containsKeyword) {
        isComplaint = true;
        // Determine category
        if (lowercase.includes("pothole") || lowercase.includes("hole") || lowercase.includes("road") || lowercase.includes("street")) {
          detectedCategory = "Pothole";
        } else if (lowercase.includes("leak") || lowercase.includes("water") || lowercase.includes("flood") || lowercase.includes("pipe")) {
          detectedCategory = "Water Leak";
        } else if (lowercase.includes("light") || lowercase.includes("lamp") || lowercase.includes("dark") || lowercase.includes("bulb")) {
          detectedCategory = "Street Light";
        } else if (lowercase.includes("graffiti") || lowercase.includes("spray") || lowercase.includes("paint")) {
          detectedCategory = "Graffiti";
        } else if (lowercase.includes("trash") || lowercase.includes("debris") || lowercase.includes("garbage") || lowercase.includes("rubbish")) {
          detectedCategory = "Trash/Debris";
        }

        detectedDescription = message.length > 80 ? message.slice(0, 77) + "..." : message;
        response = `I noticed you might be describing a civic issue related to ${detectedCategory}. Would you like me to log an official ticket for this under ${ward || "your registered ward"}? I can do that for you instantly!`;
      } else {
        response = "I am here to help you! You can ask me about reporting procedures, assigned wards, XP rewards, or describe a neighborhood problem (e.g. broken street light, potholes, water leaks) to submit it directly to your ward.";
      }
    }

    res.json({
      success: true,
      response,
      isComplaint,
      detectedCategory,
      detectedDescription
    });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});


// Serve static assets and Vite middleware mount
async function startServer() {
  loadDatabase();

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware configured.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files directory configured.");
  }

  // Fallback match to ensure SPA redirects nicely in dev too if they hit a different route segment
  app.get("*", (req: Request, res: Response, next) => {
    if (process.env.NODE_ENV !== "production") {
      // Allow Vite's SPA middleware to handle it
      next();
    } else {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    }
  });

  // Global error handler to ALWAYS respond with clean JSON for API requests
  app.use((err: any, req: Request, res: Response, next: any) => {
    console.error("Express uncaught exception:", err);
    if (req.path.startsWith("/api/")) {
      res.status(err.status || 500).json({
        error: err.message || "An unexpected dynamic backend exception occurred."
      });
    } else {
      next(err);
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Civic Issue Reporting Server running on http://localhost:${PORT}`);
  });
}

startServer();
