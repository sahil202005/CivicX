import React, { useEffect, useRef, useState } from "react";
import { 
  MapPin, 
  Layers, 
  Radio, 
  ShieldAlert, 
  Sparkles, 
  Filter, 
  Info, 
  RefreshCw, 
  Locate, 
  Trash2, 
  Plus, 
  Check, 
  X, 
  ClipboardList, 
  Compass, 
  Save, 
  Brush, 
  AlertTriangle 
} from "lucide-react";
import { IssueReport, UserProfile, HotspotPrediction } from "../types";

interface CityMapProps {
  reports: IssueReport[];
  leaderboard?: UserProfile[];
  selectedReportId?: string | null;
  onSelectReport?: (id: string) => void;
  onMapClickCoord?: (lat: number, lng: number, address: string) => void;
  isAuthority?: boolean;
  user?: UserProfile | null;
  onWardCreated?: () => void;
  latitude?: number;
  longitude?: number;
  hotspots?: HotspotPrediction[];
}

// Map parameters (Pune Central Coordinates)
const mapCenterLat = 18.5204;
const mapCenterLng = 73.8567;

// Default Ward Boundaries setup
const DEFAULT_WARDS: any[] = [];

// Aesthetic options for custom ward colors
const WARD_COLORS = [
  { hex: "#22c55e", name: "Green (Stable)" },
  { hex: "#ef4444", name: "Red (Critical)" },
  { hex: "#3b82f6", name: "Blue (Growth)" },
  { hex: "#f59e0b", name: "Amber (Attention)" },
  { hex: "#a855f7", name: "Purple (Strategic)" },
  { hex: "#6366f1", name: "Indigo (Civic)" }
];

// Point-in-polygon algorithm helper
function isPointInPolygon(point: [number, number], polygon: [number, number][]) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Dynamic Leaflet asset loading utility
const loadLeaflet = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }

    // Check if script is already loading or exists
    const existingScript = document.getElementById("leaflet-js");
    if (existingScript) {
      if ((window as any).L) {
        resolve((window as any).L);
      } else {
        const checkInterval = setInterval(() => {
          if ((window as any).L) {
            clearInterval(checkInterval);
            resolve((window as any).L);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error("Leaflet took too long to initialize."));
        }, 8000);
      }
      return;
    }

    // Load Leaflet CSS
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
};

export default function CityMap({ reports, leaderboard, selectedReportId, onSelectReport, onMapClickCoord, isAuthority, user, onWardCreated, latitude, longitude, hotspots = [] }: CityMapProps) {
  const [mapMode, setMapMode] = useState<"cluster" | "heatmap">("cluster");
  const [showWards, setShowWards] = useState(true);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  const [mapPresetView, setMapPresetView] = useState<"local" | "world">("local");
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  
  // Real-time user Geolocation states
  const [isLocating, setIsLocating] = useState(false);
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);

  // Ward custom creation states
  const [wards, setWards] = useState<any[]>(DEFAULT_WARDS);

  const fetchBackendWards = async () => {
    try {
      const res = await fetch("/api/wards", {
        headers: { "x-username": user?.username || "" }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.wards) {
          setWards(data.wards);
        }
      }
    } catch (e) {
      console.error("Failed to load wards from API.", e);
    }
  };

  useEffect(() => {
    fetchBackendWards();
  }, [user]);

  const [idShowWardEditor, setIdShowWardEditor] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [newWardName, setNewWardName] = useState("");
  const [selectedWardColor, setSelectedWardColor] = useState("#22c55e");
  const [newWardGrade, setNewWardGrade] = useState("A");
  const [newWardStatus, setNewWardStatus] = useState("Active Triage");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const heatmapLayerRef = useRef<any>(null);
  const wardsLayerRef = useRef<any>(null);
  const drawingLayerRef = useRef<any>(null);
  const clickMarkerRef = useRef<any>(null);
  const hotspotsLayerRef = useRef<any>(null);

  const drawingModeRef = useRef(false);
  const drawingPointsRef = useRef<[number, number][]>([]);

  // Synchronize state values inside event listener refs
  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);

  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);

  const handleSaveCustomWard = async () => {
    if (drawingPoints.length < 3) return;
    const nameToUse = newWardName.trim() || `Custom Ward Area #${wards.length + 1}`;
    
    try {
      const res = await fetch("/api/wards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": user?.username || ""
        },
        body: JSON.stringify({
          name: nameToUse,
          coordinates: drawingPoints,
          color: selectedWardColor,
          grade: newWardGrade,
          status: newWardStatus
        })
      });

      if (res.ok) {
        const data = await res.json();
        setWards(data.wards);
        if (onWardCreated) {
          onWardCreated();
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to mark and save boundary on central servers.");
      }
    } catch (e) {
      console.error("Failed saving ward", e);
    }

    // Reset fields
    setDrawingPoints([]);
    setNewWardName("");
    setDrawingMode(false);
    setShowWards(true);
  };

  const handleDeleteWard = async (id: string) => {
    try {
      const res = await fetch(`/api/wards/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-username": user?.username || "" }
      });
      if (res.ok) {
        const data = await res.json();
        setWards(data.wards);
      }
    } catch (e) {
      console.error("Failed to delete custom boundary", e);
    }
  };

  // Load Leaflet assets
  useEffect(() => {
    loadLeaflet()
      .then(() => {
        setLeafletLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load realistic Leaflet map component:", err);
        setLoadingError(true);
      });
  }, []);

  // Smart on-mount auto-geolocation centering if Leaflet is loaded
  useEffect(() => {
    if (leafletLoaded && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const map = mapInstanceRef.current;
          if (map) {
            console.log("Automatically centering map on user GPS coordinates:", latitude, longitude);
            map.setView([latitude, longitude], 15, { animate: true });
            
            // Provide localized coordinates back to parent if callback exists and no custom click yet
            if (onMapClickCoord && !clickedLocation) {
              const L = (window as any).L;
              if (L) {
                // Perform quick geocode lookup for local address consistency
                const runReverseGeocode = async () => {
                  try {
                    const res = await fetch(
                      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
                      {
                        headers: {
                          "Accept-Language": "en",
                          "User-Agent": "CivicLedgerDispatchApp/1.0 (sahilbidwai20@gmail.com)"
                        }
                      }
                    );
                    if (res.ok) {
                      const contentType = res.headers.get("content-type");
                      if (contentType && contentType.includes("application/json")) {
                        const data = await res.json();
                        const addressVal = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                        onMapClickCoord(latitude, longitude, addressVal);
                        return;
                      }
                    }
                    onMapClickCoord(latitude, longitude, `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                  } catch (e) {
                    onMapClickCoord(latitude, longitude, `GPS coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                  }
                };
                runReverseGeocode();
              }
            }
          }
        },
        (error) => {
          console.log("On-mount auto-geolocation skipped or permission prompt pending: Using municipal center default.", error.message);
        },
        { enableHighAccuracy: false, timeout: 6000 }
      );
    }
  }, [leafletLoaded]);

  // Handle standard real-time GPS locating
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setLocationErrorMsg("Geolocation is not supported by your browser engine.");
      setTimeout(() => setLocationErrorMsg(null), 5000);
      return;
    }

    setIsLocating(true);
    setLocationErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const L = (window as any).L;
        const map = mapInstanceRef.current;
        if (!map || !L) {
          setIsLocating(false);
          return;
        }

        // Center map to physical GPS coordinates with realistic detail zoom level
        map.setView([latitude, longitude], 16, { animate: true });

        // Place or refresh click selection marker
        if (clickMarkerRef.current) {
          map.removeLayer(clickMarkerRef.current);
        }

        const bounceIcon = L.divIcon({
          html: `<div class="relative flex items-center justify-center animate-bounce">
                   <span class="absolute inline-flex h-8 w-8 rounded-full bg-indigo-500/30 animate-ping"></span>
                   <div class="p-2 bg-slate-900 border border-indigo-400 rounded-full text-indigo-400 shadow-lg">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                   </div>
                 </div>`,
          className: "leaflet-click-marker",
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        });

        clickMarkerRef.current = L.marker([latitude, longitude], { icon: bounceIcon }).addTo(map);

        // Fetch realistic geocoded details
        const resolvedAddr = await reverseGeocode(latitude, longitude);
        setClickedLocation({ lat: latitude, lng: longitude, address: resolvedAddr });

        if (onMapClickCoord) {
          onMapClickCoord(latitude, longitude, resolvedAddr);
        }
        setIsLocating(false);
      },
      (error) => {
        console.warn("Geolocation failure:", error);
        let userMessage = "Could not access location. Please check your browser privacy preferences.";
        if (error.code === error.PERMISSION_DENIED) {
          userMessage = "Location permission denied. Please enable location permissions in your browser interface.";
        } else if (error.code === error.TIMEOUT) {
          userMessage = "Location request timed out. Please retry in a moment.";
        }
        setLocationErrorMsg(userMessage);
        setIsLocating(false);
        setTimeout(() => setLocationErrorMsg(null), 6000);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Category point marker styling
  const getCategoryHexColor = (category: string) => {
    switch (category) {
      case "Pothole": return "#f97316"; // orange-500
      case "Water Leak": return "#3b82f6"; // blue-500
      case "Street Light": return "#eab308"; // amber-500
      case "Trash/Debris": return "#475569"; // slate-600
      case "Graffiti": return "#ec4899"; // pink-500
      default: return "#6366f1"; // indigo-500
    }
  };

  // Reverse geocoding lookup
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "CivicLedgerDispatchApp/1.0 (sahilbidwai20@gmail.com)"
          }
        }
      );
      if (!response.ok) throw new Error("Network address geocoding failed");
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Received non-JSON content from Nominatim geocoder API");
      }
      const data = await response.json();
      if (data && data.display_name) {
        // Shorten address to first 3 elements for aesthetic display
        const parts = data.display_name.split(",");
        if (parts.length > 3) {
          return parts.slice(0, 3).join(",").trim();
        }
        return data.display_name;
      }
    } catch (err) {
      console.warn("API geocoder failed, returning structured mock address:", err);
    } finally {
      setIsGeocoding(false);
    }
    
    // Fallback static Pune generator
    const streetPrefixes = ["F C Road", "J M Road", "Senapati Bapat Road", "Karve Road", "M G Road", "Kumthekar Road", "Tilak Road", "Model Colony"];
    const blockNum = Math.floor(100 + Math.random() * 800);
    return `${blockNum} ${streetPrefixes[Math.floor(Math.random() * streetPrefixes.length)]}, Pune, Maharashtra, 411004, India`;
  };

  // Synchronize realistic tile layer style and limits with state changes (supporting World/Satellite views!)
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const L = (window as any).L;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = "";
    let attribution = "";

    if (mapStyle === "satellite") {
      // High-resolution realistic satellite imagery from Esri
      url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      attribution = "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";
    } else {
      // Standard realistic detailed city street vector map from CartoDB Voyager
      url = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      attribution = "Tiles &copy; CartoDB";
    }

    tileLayerRef.current = L.tileLayer(url, {
      maxZoom: 19,
      minZoom: 1,
      attribution: attribution
    }).addTo(map);
  }, [leafletLoaded, mapStyle]);

  // Handle Preset Views
  const handleSetWorldView = () => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.setView([20, 0], 2, { animate: true });
    setMapPresetView("world");
  };

  const handleSetLocalView = () => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.setView([latitude || mapCenterLat, longitude || mapCenterLng], 14, { animate: true });
    setMapPresetView("local");
  };

  // Map Initialization
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Destroy existing instance if it was left over
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Create Leaflet Map Instance with global capability (minZoom: 1)
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 1
    }).setView([latitude || mapCenterLat, longitude || mapCenterLng], 14);

    mapInstanceRef.current = map;

    // Add standard Zoom tool but repositioned cleanly
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Initial marker & overlay groups
    markersGroupRef.current = L.layerGroup().addTo(map);
    heatmapLayerRef.current = L.layerGroup().addTo(map);
    wardsLayerRef.current = L.layerGroup().addTo(map);
    drawingLayerRef.current = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = L.layerGroup().addTo(map);

    // Tap to dispatch coordinates handler or custom ward vertex builder
    map.on("click", async (e: any) => {
      const { lat, lng } = e.latlng;
      
      if (drawingModeRef.current) {
        const updated = [...drawingPointsRef.current, [lat, lng] as [number, number]];
        setDrawingPoints(updated);
        return;
      }

      // Update local temporary click marker
      if (clickMarkerRef.current) {
        map.removeLayer(clickMarkerRef.current);
      }
      
      const bounceIcon = L.divIcon({
        html: `<div class="relative flex items-center justify-center animate-bounce">
                 <span class="absolute inline-flex h-8 w-8 rounded-full bg-indigo-500/30 animate-ping"></span>
                 <div class="p-2 bg-slate-900 border border-indigo-400 rounded-full text-indigo-400 shadow-lg">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                 </div>
               </div>`,
        className: "leaflet-click-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      clickMarkerRef.current = L.marker([lat, lng], { icon: bounceIcon }).addTo(map);

      // Fetch realistic geocoded details
      const resolvedAddr = await reverseGeocode(lat, lng);
      setClickedLocation({ lat, lng, address: resolvedAddr });

      if (onMapClickCoord) {
        onMapClickCoord(lat, lng, resolvedAddr);
      }
    });

    // Fit map bounds properly
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // Update Ward Boundaries highlight overlay
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !wardsLayerRef.current) return;
    const L = (window as any).L;
    
    // Clear previous wards
    wardsLayerRef.current.clearLayers();

    if (showWards) {
      wards.forEach((w) => {
        if (!w.coordinates || w.coordinates.length < 3) return;
        
        const polygon = L.polygon(w.coordinates, {
          color: w.color,
          weight: 1.5,
          dashArray: "4, 6",
          fillColor: w.color,
          fillOpacity: 0.05
        }).addTo(wardsLayerRef.current);

        // Calculate dynamic report statistics targeting this specific custom polygon boundary area
        const insideReportsCount = reports.filter((r) => {
          if (r.duplicateOf) return false;
          return isPointInPolygon([r.latitude, r.longitude], w.coordinates);
        }).length;

        const infoTooltipContent = `
          <div class="p-1.5 font-sans text-[10.5px] leading-snug text-slate-800" style="min-width: 140px;">
            <p class="font-extrabold text-slate-900 border-b border-slate-100 pb-1 mb-1">${w.name}</p>
            <p class="text-[9.5px]">🛡️ Status: <strong class="text-indigo-650">${w.status}</strong></p>
            <p class="text-[9.5px]">⭐ Triage Grade: <strong>${w.grade}</strong></p>
            <p class="text-[10px] font-bold text-indigo-600 mt-1">📊 Unresolved Issues: ${insideReportsCount}</p>
          </div>
        `;
        polygon.bindTooltip(infoTooltipContent, { sticky: true });
      });

      // Directly fit bounds to show all ward boundaries if in authority view and has wards
      if (isAuthority && wards.length > 0) {
        const allPoints: [number, number][] = [];
        wards.forEach((w) => {
          if (w.coordinates && w.coordinates.length >= 3) {
            w.coordinates.forEach((coord: [number, number]) => {
              allPoints.push(coord);
            });
          }
        });
        if (allPoints.length > 0) {
          try {
            const bounds = L.latLngBounds(allPoints);
            mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
          } catch (fitErr) {
            console.warn("Auto-fitting ward bounds failed on empty container:", fitErr);
          }
        }
      }
    }
  }, [leafletLoaded, showWards, wards, reports, isAuthority]);

  // Live Ward Polygon construction drawing preview effect
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !drawingLayerRef.current) return;
    const L = (window as any).L;
    
    drawingLayerRef.current.clearLayers();

    if (drawingMode && drawingPoints.length > 0) {
      if (drawingPoints.length > 1) {
        L.polyline(drawingPoints, {
          color: selectedWardColor,
          weight: 2.5,
          dashArray: "5, 5"
        }).addTo(drawingLayerRef.current);
      }

      drawingPoints.forEach((pt, idx) => {
        L.circleMarker(pt, {
          radius: 5,
          fillColor: "#ffffff",
          color: selectedWardColor,
          weight: 2,
          fillOpacity: 1
        }).addTo(drawingLayerRef.current)
          .bindTooltip(`Vertex point #${idx + 1}`, { permanent: false });
      });

      if (drawingPoints.length >= 3) {
        L.polygon(drawingPoints, {
          color: selectedWardColor,
          weight: 1,
          fillColor: selectedWardColor,
          fillOpacity: 0.15
        }).addTo(drawingLayerRef.current);
      }
    }
  }, [leafletLoaded, drawingPoints, drawingMode, selectedWardColor]);

  // Update Spot Pins or Heatmap layers on state change
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    
    // Reset layers
    markersGroupRef.current.clearLayers();
    heatmapLayerRef.current.clearLayers();

    if (mapMode === "heatmap") {
      // Heatmap view - Draw overlapping semi-transparent circles forming heat clouds
      reports.forEach((r) => {
        if (r.duplicateOf) return; // ignore merged duplicates
        if (r.status === "resolved") return; // remove if job is completed
        
        let color = "#f59e0b"; // Default submitted (amber/orange)
        if (r.status === "active") {
          color = "#e11d48"; // Rose/Crimson red for active
        } else if (r.status === "in_progress" || r.status === "assigned") {
          color = "#3b82f6"; // Royal blue for dispatched/in_progress
        } else if (r.severity === "high") {
          color = "#ef4444"; // Severity based fallback
        }

        const isHigh = r.severity === "high";
        const radius = isHigh ? 280 : 185;

        L.circle([r.latitude, r.longitude], {
          radius: radius,
          weight: 0,
          fillColor: color,
          fillOpacity: 0.35
        }).addTo(heatmapLayerRef.current);
      });
    } else {
      // Pins Mode - Setup gorgeous marker drops
      reports.forEach((r) => {
        if (r.duplicateOf) return;
        if (r.status === "resolved") return; // remove the pin if job is completed

        const isSelected = selectedReportId === r.id;
        
        // Use status-specific high-contrast colors for active, in-progress, and resolved, and default to category color for others
        let color = getCategoryHexColor(r.category);
        if (r.status === "active") {
          color = "#e11d48"; // Rose/Crimson-rich red for active verified issues
        } else if (r.status === "in_progress" || r.status === "assigned") {
          color = "#3b82f6"; // Royal blue for assigned/dispatched work
        }

        const severityStr = r.severity.toUpperCase();

        const reporterName = r.reportedBy || (r.upvotedBy && r.upvotedBy.length > 0 ? r.upvotedBy[0] : "CitizenResident");
        const reporter = leaderboard?.find(u => u.username === reporterName);
        const avatar = reporter?.avatar || "👤";

        const svgIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

        const customIcon = L.divIcon({
          html: `<div class="relative group">
                   ${r.severity === "high" ? `
                     <span class="absolute -top-1 -left-1 flex h-6 w-6">
                       <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60"></span>
                     </span>
                   ` : ""}
                   <div style="background-color: ${color};" class="p-1.5 rounded-full border border-white text-white shadow-md flex items-center justify-center transform transition-transform duration-200 active:scale-95 ${
                     isSelected ? "scale-125 ring-2 ring-indigo-600 ring-offset-2" : "hover:scale-110"
                   }">
                     <span class="text-[12px]">${avatar}</span>
                   </div>
                 </div>`,
          className: "custom-leaflet-spot",
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        const marker = L.marker([r.latitude, r.longitude], { icon: customIcon })
          .addTo(markersGroupRef.current);

        // Bind quick popup with descriptive status badges including Active
        const statusBadge = r.status === "in_progress"
            ? `<span class="px-1.5 py-0.5 rounded text-[8px] bg-blue-50 text-blue-700 font-bold border border-blue-200">DISPATCHED</span>`
            : r.status === "assigned"
              ? `<span class="px-1.5 py-0.5 rounded text-[8px] bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">ASSIGNED</span>`
              : r.status === "active"
                ? `<span class="px-1.5 py-0.5 rounded text-[8px] bg-rose-550/10 text-rose-600 font-bold border border-rose-220">ACTIVE</span>`
                : `<span class="px-1.5 py-0.5 rounded text-[8px] bg-amber-50 text-amber-700 font-bold border border-amber-200">SUBMITTED</span>`;

        const severityBadge = r.severity === "high"
          ? `<span class="px-1.5 py-0.5 rounded text-[8px] bg-rose-50 text-rose-700 font-bold border border-rose-200">CRITICAL</span>`
          : `<span class="px-1.5 py-0.5 rounded text-[8px] bg-slate-50 text-slate-700 font-bold border border-slate-200">${severityStr}</span>`;

        const popupContent = `
          <div class="p-1 text-slate-800 font-sans space-y-1.5 min-w-[200px]" style="line-height:1.4;">
            <div class="flex items-center justify-between border-b pb-1">
              <span class="text-[9px] font-bold text-indigo-600">Disp #${r.id}</span>
              <div class="flex gap-1">${statusBadge}${severityBadge}</div>
            </div>
            <p class="font-bold text-xs text-slate-900">${r.category}</p>
            <p class="text-[10px] text-slate-600 line-clamp-2">${r.description}</p>
            <div class="text-[9.5px] text-slate-500 font-mono">
              👤 Reporter: <strong class="text-indigo-650">${reporterName}</strong>
            </div>
            <p class="text-[9px] text-slate-400 font-mono italic">📍 ${r.address}</p>
            <button class="w-full text-center text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 p-1.5 rounded hover:bg-indigo-100 transition mt-1 select-btn" data-id="${r.id}">
              Inspect Report Details
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 280 });

        marker.on("popupopen", () => {
          // Hook into the inspect button inside popup
          setTimeout(() => {
            const btn = document.querySelector(`.select-btn[data-id="${r.id}"]`);
            if (btn) {
              btn.addEventListener("click", () => {
                if (onSelectReport) onSelectReport(r.id);
                map.closePopup();
                // Find report card element and scroll to it
                const el = document.getElementById(`report-card-${r.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-8", "ring-indigo-100");
                  setTimeout(() => el.classList.remove("ring-8", "ring-indigo-100"), 1500);
                }
              });
            }
          }, 50);
        });
      });
    }
  }, [leafletLoaded, reports, mapMode, selectedReportId]);

  // Center on map focus selection changes
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !selectedReportId) return;
    const map = mapInstanceRef.current;
    const selected = reports.find((r) => r.id === selectedReportId);
    if (selected) {
      map.setView([selected.latitude, selected.longitude], 16, { animate: true });
    }
  }, [selectedReportId, reports, leafletLoaded]);

  // Update Hotspot circles / AI prediction overlays on state change
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !hotspotsLayerRef.current) return;
    const L = (window as any).L;
    
    hotspotsLayerRef.current.clearLayers();

    hotspots.forEach((h) => {
      const radius = 250; 
      const riskColor = h.riskScore >= 80 ? "#f97316" : "#eab308"; 

      L.circle([h.latitude, h.longitude], {
        radius: radius,
        weight: 1.5,
        color: riskColor,
        dashArray: "5, 5",
        fillColor: riskColor,
        fillOpacity: 0.08
      }).addTo(hotspotsLayerRef.current);

      const riskSvg = `
        <div class="relative flex items-center justify-center">
          <span class="absolute inline-flex h-5 w-5 rounded-full bg-orange-400 opacity-75 animate-ping"></span>
          <div class="relative w-4 h-4 bg-orange-500 border border-white text-[9px] text-white font-extrabold flex items-center justify-center rounded-full shadow-md">
            ⚠️
          </div>
        </div>
      `;

      const hotspotIcon = L.divIcon({
        html: riskSvg,
        className: "custom-leaflet-hotspot",
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      L.marker([h.latitude, h.longitude], { icon: hotspotIcon })
        .addTo(hotspotsLayerRef.current)
        .bindPopup(`
          <div class="font-sans text-xs space-y-1.5 p-1 min-w-[180px]">
            <div class="flex items-center justify-between border-b border-slate-100 pb-1">
              <strong class="text-orange-700 font-extrabold tracking-tight">AI PREDICTIVE ZONE</strong>
              <span class="text-[9px] bg-orange-50 text-orange-700 px-1 py-0.5 rounded-full font-bold border border-orange-150">${h.riskScore}% RISK</span>
            </div>
            <p class="font-semibold text-slate-800">${h.category}</p>
            <p class="text-[10px] text-slate-500 font-mono">${h.address}</p>
            <div class="bg-orange-50/50 p-2 rounded border border-orange-100/50 text-[10px] text-orange-900 leading-normal font-medium">
              <strong>Action Rule:</strong> ${h.recommendedAction}
            </div>
          </div>
        `);
    });
  }, [leafletLoaded, hotspots]);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4" id="city-map-card">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
            <Layers size={16} className="text-indigo-600" />
            Interactive Global GIS Map
          </h2>
          <p className="text-[10px] text-slate-400">Photorealistic satellite world maps, city streets, and live geocoding</p>
        </div>

        {/* Map options buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Map Style Selector */}
          <div className="flex border border-slate-200 p-0.5 rounded-lg bg-slate-50 text-[10px] font-semibold">
            <button
              onClick={() => setMapStyle("streets")}
              title="Show clean vector design view with city streets and highways"
              className={`px-2 py-1 rounded transition-all cursor-pointer ${mapStyle === "streets" ? "bg-white text-slate-800 shadow-xs border border-slate-100 font-bold" : "text-slate-500 hover:text-slate-800"}`}
            >
              🗺️ Streets
            </button>
            <button
              onClick={() => setMapStyle("satellite")}
              title="Show photorealistic high-res satellite camera photography"
              className={`px-2 py-1 rounded transition-all cursor-pointer ${mapStyle === "satellite" ? "bg-white text-slate-800 shadow-xs border border-slate-100 font-bold" : "text-slate-500 hover:text-slate-800"}`}
            >
              🛰️ Satellite
            </button>
          </div>

          {/* Quick Preset View Focus (Only show for general community view) */}
          {!isAuthority && (
            <div className="flex border border-slate-200 p-0.5 rounded-lg bg-slate-50 text-[10px] font-semibold">
              <button
                onClick={handleSetLocalView}
                title="Zoom to your current focal location Hub"
                className={`px-2 py-1 rounded transition-all cursor-pointer ${mapPresetView === "local" ? "bg-white text-slate-800 shadow-xs border border-slate-100 font-bold" : "text-slate-500 hover:text-slate-800"}`}
              >
                📍 My Location
              </button>
              <button
                onClick={handleSetWorldView}
                title="Zoom out to complete realistic world globe perspective"
                className={`px-2 py-1 rounded transition-all cursor-pointer ${mapPresetView === "world" ? "bg-white text-slate-800 shadow-xs border border-slate-100 font-bold" : "text-slate-500 hover:text-slate-800"}`}
              >
                🌐 World map
              </button>
            </div>
          )}

          <button
            onClick={handleLocateUser}
            disabled={isLocating || !leafletLoaded}
            title="Recenter map at your physical device position"
            className={`px-2 py-1.5 border rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer hover:bg-slate-50 ${isLocating ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold" : "bg-white border-slate-200 text-slate-600"}`}
          >
            <Locate size={12} className={isLocating ? "animate-spin text-indigo-600" : ""} />
            {isLocating ? "Locating..." : "Find My Location"}
          </button>

          <div className="flex border border-slate-150 p-0.5 rounded-lg bg-slate-50 text-[10px] font-semibold">
            <button
              onClick={() => setMapMode("cluster")}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${mapMode === "cluster" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
            >
              📌 Pins
            </button>
            <button
              onClick={() => setMapMode("heatmap")}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${mapMode === "heatmap" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
            >
              🔥 Heatmap
            </button>
          </div>

          <button
            onClick={() => setShowWards(!showWards)}
            className={`px-2 py-1.5 border rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${showWards ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-500"}`}
          >
            🚧 Wards
          </button>

          {isAuthority && (
            <button
              onClick={() => {
                setIdShowWardEditor(!idShowWardEditor);
                if (!idShowWardEditor) setShowWards(true);
              }}
              title="Admin tools to design and manage custom ward polygons"
              className={`px-2 py-1.5 border rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                idShowWardEditor 
                  ? "bg-rose-50 border-rose-200 text-rose-700 shadow-xs font-black" 
                  : "bg-indigo-50 border-indigo-150 hover:bg-indigo-100 text-indigo-700"
              }`}
            >
              <Compass size={12} className={idShowWardEditor ? "animate-spin" : ""} />
              🛠️ Boundary Commander
            </button>
          )}
        </div>
      </div>

      {/* Boundary Commander Console */}
      {idShowWardEditor && isAuthority && (
        <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3.5 shadow-sm" id="boundary-commander-deck">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <Compass size={14} className="text-indigo-650 animate-spin-slow" />
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 tracking-tight">Boundary Commander Console</h3>
                <p className="text-[9.5px] text-slate-400">Design, draw, and deploy custom service zones directly on the map</p>
              </div>
            </div>
            <button
              onClick={() => {
                setIdShowWardEditor(false);
                setDrawingMode(false);
                setDrawingPoints([]);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Left sidebar: Current list of wards */}
            <div className="space-y-2 bg-white border border-slate-150 p-2.5 rounded-xl">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block">Active Ward Jurisdictions ({wards.length})</span>
              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                {wards.map((w) => {
                  const insCount = reports.filter(r => {
                    if (r.duplicateOf) return false;
                    return isPointInPolygon([r.latitude, r.longitude], w.coordinates);
                  }).length;

                  return (
                    <div 
                      key={w.id} 
                      className="p-1 px-2 border border-slate-100 hover:border-slate-200 rounded-lg flex justify-between items-center gap-2 group transition bg-slate-50/50"
                    >
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: w.color }} />
                        <div className="min-w-0">
                          <span className="font-bold text-[10px] text-slate-700 block line-clamp-1">{w.name}</span>
                          <span className="text-[8.5px] text-slate-400 block leading-tight">
                            Grade {w.grade} &middot; <span className="font-semibold" style={{ color: w.color }}>{w.status}</span>
                          </span>
                          <span className="text-[8.5px] text-indigo-500 font-mono font-semibold block">
                            📈 {w.coordinates.length} vertices &middot; {insCount} issues
                          </span>
                        </div>
                      </div>

                      {w.isCustom ? (
                        <button
                          onClick={() => handleDeleteWard(w.id)}
                          title="Purge custom boundary zone"
                          className="p-1 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded opacity-80 group-hover:opacity-100 transition duration-150 cursor-pointer text-[10px]"
                        >
                          <Trash2 size={10} />
                        </button>
                      ) : (
                        <span className="text-[7.5px] bg-slate-100 text-slate-400 font-bold px-1 py-0.5 rounded uppercase font-mono">Core</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right sidebar: Draw Ward Polygon Workspace */}
            <div className="space-y-2.5 bg-white border border-slate-150 p-3 rounded-xl flex flex-col justify-between min-h-[170px]">
              {!drawingMode ? (
                <div className="space-y-3 flex-1 flex flex-col justify-center items-center text-center py-2.5">
                  <div className="p-2.5 bg-indigo-50 text-indigo-650 rounded-2xl">
                    <Brush size={16} className="animate-pulse" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-700">Define Custom Service Boundaries</p>
                    <p className="text-[9px] text-slate-450 leading-relaxed max-w-[210px]">
                      Trigger drafting mode to capture coordinates directly by clicking points on the interactive map stage.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setDrawingMode(true);
                      setDrawingPoints([]);
                    }}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] rounded-lg shadow-sm transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={10} />
                    <span>Initialize Polygon Draft Tool</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-extrabold text-rose-500 uppercase tracking-widest font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                        Live Drafting workspace
                      </span>
                      <span className="text-[8.5px] font-bold font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                        {drawingPoints.length} points
                      </span>
                    </div>
                    
                    <p className="text-[8.5px] text-slate-500 leading-normal">
                      📍 <strong>Boundary Rule:</strong> Click the map to place vertices. Place at least <strong>3 points</strong> to build a valid closed polygon.
                    </p>

                    <div className="space-y-1">
                      <div>
                        <label className="block text-[7.5px] font-extrabold font-mono text-slate-400 uppercase mb-0.5">Ward Name Label:</label>
                        <input
                          type="text"
                          value={newWardName}
                          onChange={(e) => setNewWardName(e.target.value)}
                          placeholder="e.g. Ward IV - North Hub"
                          className="w-full text-[9.5px] p-1.5 rounded border border-slate-200 focus:border-indigo-400 outline-none font-bold placeholder-slate-350"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[7.5px] font-extrabold font-mono text-slate-400 uppercase mb-0.5">Grade:</label>
                          <select
                            value={newWardGrade}
                            onChange={(e) => setNewWardGrade(e.target.value)}
                            className="w-full text-[9px] p-1 rounded border border-slate-200 outline-none font-semibold text-slate-700"
                          >
                            <option value="A+">Grade A+</option>
                            <option value="A">Grade A</option>
                            <option value="B+">Grade B+</option>
                            <option value="B">Grade B</option>
                            <option value="C">Grade C</option>
                            <option value="D">Grade D</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[7.5px] font-extrabold font-mono text-slate-400 uppercase mb-0.5">SLA Status:</label>
                          <select
                            value={newWardStatus}
                            onChange={(e) => setNewWardStatus(e.target.value)}
                            className="w-full text-[9px] p-1 rounded border border-slate-200 outline-none font-semibold text-slate-700"
                          >
                            <option value="Optimal">Optimal</option>
                            <option value="SLA Monitored">SLA Monitored</option>
                            <option value="Active Dispatch">Active Dispatch</option>
                            <option value="High Risk">High Risk</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[7.5px] font-extrabold font-mono text-slate-400 uppercase mb-0.5">Visual Color Accent:</label>
                        <div className="flex gap-1">
                          {WARD_COLORS.map((wc) => (
                            <button
                              key={wc.hex}
                              type="button"
                              onClick={() => setSelectedWardColor(wc.hex)}
                              title={wc.name}
                              className={`w-4 h-4 rounded-full relative transition flex items-center justify-center cursor-pointer hover:scale-110 ${selectedWardColor === wc.hex ? "ring-2 ring-indigo-500 ring-offset-1 scale-105" : "border border-slate-200"}`}
                              style={{ backgroundColor: wc.hex }}
                            >
                              {selectedWardColor === wc.hex && <Check size={8} className="text-white font-extrabold" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 pt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawingMode(false);
                        setDrawingPoints([]);
                        setNewWardName("");
                      }}
                      className="flex-1 py-1 text-slate-500 hover:text-slate-800 rounded border border-slate-200 text-[8.5px] font-medium transition cursor-pointer"
                    >
                      Exit Tool
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawingPoints([])}
                      disabled={drawingPoints.length === 0}
                      className="flex-1 py-1 text-rose-500 hover:bg-rose-50 rounded border border-rose-100 text-[8.5px] font-semibold disabled:opacity-50 transition cursor-pointer"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCustomWard}
                      disabled={drawingPoints.length < 3}
                      className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[8.5px] rounded disabled:opacity-50 shadow-sm transition flex items-center justify-center gap-0.5 cursor-pointer"
                    >
                      <Save size={8} />
                      <span>Deploy Ward</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map container stage */}
      <div className="relative h-80 w-full border border-slate-100 bg-slate-50 rounded-xl overflow-hidden shadow-inner" style={{ zIndex: 10 }}>
        {loadingError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-2 bg-slate-50 text-slate-500">
            <ShieldAlert size={28} className="text-amber-500" />
            <p className="text-xs font-bold leading-none">Map API Blocked or Interrupted</p>
            <p className="text-[10px] text-slate-400 max-w-xs">Verify your internet network connections. Interactive map overlays failed to load from CDNs.</p>
          </div>
        ) : !leafletLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-slate-50 text-slate-400">
            <RefreshCw size={24} className="animate-spin text-indigo-500" />
            <p className="text-[10px] font-mono animate-pulse">Streaming GIS map layout textures...</p>
          </div>
        ) : (
          <div ref={mapContainerRef} className="w-full h-full" id="map-leaflet-box" />
        )}

        {/* Floating live location bar */}
        {clickedLocation && (
          <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md text-white px-3 py-2 rounded-xl text-[10px] space-y-0.5 max-w-[240px] shadow-lg border border-slate-800 pointer-events-none" style={{ zIndex: 1000 }}>
            <span className="text-[8px] tracking-wider uppercase font-bold text-indigo-400 block font-mono">🎯 Selected Coordinates</span>
            <p className="font-bold font-sans line-clamp-1">{clickedLocation.address}</p>
            <div className="flex gap-2 font-mono text-[8px] text-slate-400 pt-0.5">
              <span>Lat: {clickedLocation.lat.toFixed(4)}</span>
              <span>Lng: {clickedLocation.lng.toFixed(4)}</span>
            </div>
          </div>
        )}

        {/* Geolocation error notification banner */}
        {locationErrorMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-medium shadow-md flex items-center gap-1.5 animate-bounce" style={{ zIndex: 1000 }}>
            <span>⚠️ {locationErrorMsg}</span>
          </div>
        )}

        {/* Inline loader for reverse geocoding */}
        {isGeocoding && (
          <div className="absolute top-3 right-3 bg-slate-900 text-white p-1 px-2.5 rounded-lg text-[9px] font-mono flex items-center gap-1.5 shadow-md pointer-events-none" style={{ zIndex: 1000 }}>
            <span className="w-2 h-2 rounded-full border border-indigo-400 border-t-transparent animate-spin"></span>
            <span>Geocoding coordinate address...</span>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-start gap-2">
        <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="text-[10px] leading-relaxed text-slate-500">
          <strong>Interactive GIS Mapping:</strong> Toggle between <strong>🗺️ Streets</strong> vector layout and <strong>🛰️ Satellite Photography</strong> views. Zoom out fully to explore the <strong>🌐 World Map</strong>, or center dynamically on regional reports or your own device position to geocode real world coordinate addresses from any continent!
        </div>
      </div>
    </div>
  );
}

