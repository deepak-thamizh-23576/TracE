import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";

import { useAuth } from "@/contexts/AuthContext";
import { AppColors } from "@/constants/colors";
import { TravelPlace, TripRecord, TripWaypoint } from "@/constants/tasks";
import { TRAVEL_MAP_HTML } from "@/constants/travelMapHtml";
import PlaceSearch from "@/components/tasks/PlaceSearch";
import type { NominatimResult } from "@/components/tasks/PlaceSearch";
import * as Location from "expo-location";

// ──────────── API base ────────────

const DEPLOYED_BASE =
  "https://trackeverythingte-904503171.catalystserverless.com/server/track_everything_te_function";
const DEV_BASE =
  "https://trackeverythingte-904503171.development.catalystserverless.com/server/track_everything_te_function";

const LOCAL_PORT = process.env.EXPO_PUBLIC_LOCAL_PORT ?? "3000";

function getLocalBase(): string {
  if (Platform.OS === "web") {
    return `http://localhost:${LOCAL_PORT}/server/track_everything_te_function`;
  }
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    // @ts-ignore – older SDKs
    Constants.manifest?.debuggerHost;

  if (debuggerHost) {
    const host = debuggerHost.split(":")[0];
    return `http://${host}:${LOCAL_PORT}/server/track_everything_te_function`;
  }
  return `http://localhost:${LOCAL_PORT}/server/track_everything_te_function`;
}

// Mobile dev uses the cloud dev environment (same as AuthContext) so the
// session token is valid. Web dev uses the local catalyst serve instance.
const API_BASE = __DEV__
  ? (Platform.OS === "web" ? getLocalBase() : DEV_BASE)
  : DEPLOYED_BASE;

// ──────────── Date helpers ────────────

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(dateStr: string): string {
  const today = todayStr();
  const yesterday = shiftDate(today, -1);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ──────────── Map WebView (memoised so it doesn't re-render on state changes) ────────────

interface MapViewProps {
  webViewRef: React.RefObject<WebView | null>;
  onMessage: (e: WebViewMessageEvent) => void;
}

const MapWebView = React.memo(({ webViewRef, onMessage }: MapViewProps) => {
  if (Platform.OS === "web") {
    return (
      <View style={styles.webFallback}>
        <MaterialIcons name="smartphone" size={48} color={AppColors.gray300} />
        <Text style={styles.webFallbackText}>
          Open on your iOS or Android device to use the map.
        </Text>
      </View>
    );
  }
  return (
    <WebView
      ref={webViewRef as React.RefObject<WebView>}
      source={{ html: TRAVEL_MAP_HTML, baseUrl: "https://unpkg.com" }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      cacheEnabled
      allowsInlineMediaPlayback
      mixedContentMode="always"
      startInLoadingState
      renderLoading={() => (
        <View style={styles.mapLoading}>
          <ActivityIndicator size="large" color={AppColors.primarySolid} />
        </View>
      )}
      onMessage={onMessage}
      style={styles.webView}
    />
  );
});

// ── TripRowItem ──
interface TripRowItemProps {
  trip: TravelPlace;
  data: { durationMs?: number; distanceKm?: number; waypoints?: TripWaypoint[]; startTime?: number } | null;
  wps: TripWaypoint[];
  fmtDuration: (ms: number) => string;
  onDelete: () => void;
}

function TripRowItem({ trip, data, wps, fmtDuration, onDelete }: TripRowItemProps) {
  const [expanded, setExpanded] = useState(false);
  const dateLabel = trip.visitDate
    ? new Date(trip.visitDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  return (
    <View style={tripRowStyles.card}>
      <View style={tripRowStyles.header}>
        <View style={tripRowStyles.left}>
          <View style={tripRowStyles.dot} />
          <View>
            <Text style={tripRowStyles.dateText}>{dateLabel}</Text>
            <Text style={tripRowStyles.meta}>
              {data?.durationMs ? fmtDuration(data.durationMs) : "—"}
              {data?.distanceKm ? `  ·  ${data.distanceKm.toFixed(1)} km` : ""}
              {wps.length > 0 ? `  ·  ${wps.length} stops` : ""}
            </Text>
          </View>
        </View>
        <View style={tripRowStyles.actions}>
          {wps.length > 0 && (
            <TouchableOpacity
              onPress={() => setExpanded((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={22} color="#F97316" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            style={{ marginLeft: 4 }}
          >
            <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
      {expanded && wps.length > 0 && (
        <View style={tripRowStyles.wpList}>
          {wps.map((wp, i) => (
            <View key={i} style={tripRowStyles.wpRow}>
              <View style={tripRowStyles.wpDot} />
              <Text style={tripRowStyles.wpText}>{wp.t} — {wp.p}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const tripRowStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F97316",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  meta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  wpList: {
    marginTop: 10,
    paddingLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: "#FED7AA",
  },
  wpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  wpDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F97316",
  },
  wpText: {
    fontSize: 12,
    color: "#374151",
    flex: 1,
  },
});

// ──────────── Screen ────────────

export default function TravelScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const webViewRef = useRef<WebView | null>(null);

  const [places, setPlaces] = useState<TravelPlace[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showList, setShowList] = useState(false);
  const [listSearch, setListSearch] = useState("");

  // Confirmation card state
  const [pendingPlace, setPendingPlace] = useState<NominatimResult | null>(null);
  const [confirmDate, setConfirmDate] = useState<string>(todayStr());

  // Wishlist add-from-list form
  const [wishlistText, setWishlistText] = useState("");
  const [addingWishlist, setAddingWishlist] = useState(false);

  // ── Trip tracking ──
  const [tripActive, setTripActive] = useState(false);
  const [tripElapsed, setTripElapsed] = useState(0); // seconds
  const [tripSummary, setTripSummary] = useState<TripRecord | null>(null);
  const [savingTrip, setSavingTrip] = useState(false);

  const tripActiveRef = useRef(false);
  const tripStartTimeRef = useRef<number>(0);
  const tripWaypointsRef = useRef<TripWaypoint[]>([]);
  const tripPathRef = useRef<{lat: number; lng: number}[]>([]); // raw GPS points for distance
  const lastWaypointTimeRef = useRef<number>(0);
  const WAYPOINT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // Live elapsed timer
  useEffect(() => {
    if (!tripActive) return;
    const id = setInterval(() => setTripElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [tripActive]);

  // Haversine distance between two coords (returns km)
  const haversine = (a: {lat: number; lng: number}, b: {lat: number; lng: number}): number => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(h));
  };

  const calcDistance = (path: {lat: number; lng: number}[]): number => {
    let total = 0;
    for (let i = 1; i < path.length; i++) total += haversine(path[i - 1], path[i]);
    return total;
  };

  // Reverse geocode via Nominatim (called from RN side, no CORS issue)
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { "Accept-Language": "en", "User-Agent": "TracE-App/1.0" } }
      );
      const data = await res.json();
      const a = data.address || {};
      return (
        a.neighbourhood || a.suburb || a.city_district || a.town ||
        a.village || a.city || a.county || data.display_name?.split(",")[0] || "Unknown"
      );
    } catch {
      return "Unknown";
    }
  };

  // Format elapsed seconds as  "0h 12m 34s"
  const fmtElapsed = (secs: number): string => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const fmtDuration = (ms: number): string => {
    const secs = Math.floor(ms / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Format current time as "10:32 AM"
  const fmtTime = (): string =>
    new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const handleStartTrip = useCallback(() => {
    const now = Date.now();
    tripStartTimeRef.current = now;
    tripWaypointsRef.current = [];
    tripPathRef.current = [];
    lastWaypointTimeRef.current = 0; // force first GPS update to capture a waypoint immediately
    tripActiveRef.current = true;

    setTripElapsed(0);
    setTripActive(true);

    // Start the route on the map immediately — no waiting for GPS
    webViewRef.current?.injectJavaScript(`window.startTrip(); true;`);

    // Capture starting location in background (doesn't block the UI)
    if (Platform.OS !== "web") {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then(async (loc) => {
          const { latitude, longitude } = loc.coords;
          tripPathRef.current.push({ lat: latitude, lng: longitude });
          const place = await reverseGeocode(latitude, longitude);
          const wp: TripWaypoint = { t: fmtTime(), lat: latitude, lng: longitude, p: place };
          tripWaypointsRef.current.push(wp);
          lastWaypointTimeRef.current = Date.now();
          const lbl = place.replace(/'/g, "\\'");
          webViewRef.current?.injectJavaScript(
            `window.updateTrip(${latitude},${longitude});
             window.addTripWaypoint(${latitude},${longitude},'${lbl}',false);
             window.centerOnMe(${latitude},${longitude}); true;`
          );
        })
        .catch(() => {}); // location unavailable — watcher will pick it up
    }
  }, []);

  const handleEndTrip = useCallback(async () => {
    tripActiveRef.current = false;
    setTripActive(false);

    const endTime = Date.now();
    const durationMs = endTime - tripStartTimeRef.current;
    const distanceKm = parseFloat(calcDistance(tripPathRef.current).toFixed(2));
    const waypoints = tripWaypointsRef.current;

    webViewRef.current?.injectJavaScript(`window.endTrip(); true;`);

    const record: TripRecord = {
      id: String(Date.now()),
      date: todayStr(),
      startTime: tripStartTimeRef.current,
      endTime,
      durationMs,
      distanceKm,
      waypoints,
    };
    setTripSummary(record);
  }, []);

  const handleSaveTripAndClose = useCallback(async (record: TripRecord) => {
    if (!token) { setTripSummary(null); return; }
    setSavingTrip(true);
    try {
      const content = JSON.stringify({
        startTime: record.startTime,
        endTime: record.endTime,
        durationMs: record.durationMs,
        distanceKm: record.distanceKm,
        waypoints: record.waypoints,
      });
      const res = await fetch(`${API_BASE}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-TE-Token": token },
        body: JSON.stringify({
          itemType: "Travel",
          itemTypeLevel: "0,0",
          itemContent: content,
          status: "trip",
          createdDate: record.date,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newPlace: TravelPlace = {
          id: String(data.id ?? data.rowId ?? Date.now()),
          title: content,
          address: "",
          latitude: 0,
          longitude: 0,
          visitDate: record.date,
          status: "trip",
        };
        setPlaces((prev) => [...prev, newPlace]);
        // Draw the saved trip on the map
        if (webViewRef.current) {
          const wJson = JSON.stringify(record.waypoints).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
          webViewRef.current.injectJavaScript(`window.addSavedTrip('${newPlace.id}','${wJson}'); true;`);
        }
      }
    } catch (err) {
      console.warn("[travel] save trip error:", err);
    }
    setSavingTrip(false);
    setTripSummary(null);
  }, [token]);

  // Live location
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // Start watching location when the screen mounts (non-blocking)
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || !active) return;
        locationSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          (loc) => {
            // Sync part — always safe
            const { latitude, longitude } = loc.coords;
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(
                `window.updateMyLocation(${latitude},${longitude}); true;`
              );
            }
            if (!tripActiveRef.current) return;
            // Append to raw path for distance calculation
            tripPathRef.current.push({ lat: latitude, lng: longitude });
            // Update live polyline
            webViewRef.current?.injectJavaScript(`window.updateTrip(${latitude},${longitude}); true;`);
            // Async waypoint capture — fire and forget, errors swallowed
            const now = Date.now();
            if (now - lastWaypointTimeRef.current >= WAYPOINT_INTERVAL_MS) {
              lastWaypointTimeRef.current = now;
              const captureLat = latitude;
              const captureLng = longitude;
              reverseGeocode(captureLat, captureLng)
                .then((place) => {
                  if (!tripActiveRef.current) return;
                  const timeLabel = fmtTime();
                  const wp: TripWaypoint = { t: timeLabel, lat: captureLat, lng: captureLng, p: place };
                  tripWaypointsRef.current.push(wp);
                  const lbl = place.replace(/'/g, "\\'");
                  webViewRef.current?.injectJavaScript(
                    `window.addTripWaypoint(${captureLat},${captureLng},'${lbl}',false); true;`
                  );
                })
                .catch(() => {});
            }
          }
        );
      } catch {
        // expo-location not available in this binary or permission denied — fail silently
      }
    })();
    return () => {
      active = false;
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  }, []);

  // ── Inject markers into WebView ──
  const injectMarkers = useCallback(
    (list: TravelPlace[]) => {
      if (!webViewRef.current) return;
      let js = "window.clearMarkers();";
      for (const p of list) {
        if (p.status === "trip") {
          // Parse saved trip and draw its route
          try {
            const data = JSON.parse(p.title);
            if (data.waypoints?.length) {
              const wJson = JSON.stringify(data.waypoints).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
              js += `window.addSavedTrip('${p.id}','${wJson}');`;
            }
          } catch {}
          continue;
        }
        const t = p.title.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
        if (p.status === "to-visit") {
          js += `window.addWishlistMarker('${p.id}',${p.latitude},${p.longitude},'${t}');`;
        } else {
          js += `window.addMarker('${p.id}',${p.latitude},${p.longitude},'${t}','${p.visitDate}');`;
        }
      }
      const nonTripCount = list.filter((p) => p.status !== "trip" && p.latitude !== 0).length;
      if (nonTripCount > 0) js += "window.fitToMarkers();";
      webViewRef.current.injectJavaScript(js + " true;");
    },
    []
  );

  // ── Fetch places from backend ──
  const loadPlaces = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/travel/list`, {
        headers: { "X-TE-Token": token },
      });
      if (!res.ok) {
        console.warn("[travel] /travel/list failed:", res.status);
        setPlacesLoaded(true);
        return;
      }
      const data = await res.json();
      const list: TravelPlace[] = data.places ?? [];
      setPlaces(list);
      setPlacesLoaded(true);
    } catch (err) {
      console.warn("[travel] loadPlaces error:", err);
      setPlacesLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  // Once BOTH the map is ready AND places are loaded, inject all markers
  useEffect(() => {
    if (mapReady && placesLoaded) {
      injectMarkers(places);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, placesLoaded]);

  // ── WebView message handler ──
  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === "ready") {
          setMapReady(true);
          // Push current location immediately once the map is ready
          if (Platform.OS !== "web") {
            Location.getForegroundPermissionsAsync().then(({ status }) => {
              if (status === "granted") {
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                  .then((loc) => {
                    webViewRef.current?.injectJavaScript(
                      `window.updateMyLocation(${loc.coords.latitude},${loc.coords.longitude}); true;`
                    );
                  })
                  .catch(() => {});
              }
            });
          }
        } else if (msg.type === "locateMe") {
          if (Platform.OS !== "web") {
            Location.getForegroundPermissionsAsync().then(({ status }) => {
              if (status === "granted") {
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
                  .then((loc) => {
                    webViewRef.current?.injectJavaScript(
                      `window.centerOnMe(${loc.coords.latitude},${loc.coords.longitude}); true;`
                    );
                  })
                  .catch(() => {});
              }
            });
          }
        } else if (msg.type === "delete") {
          const id = String(msg.id);
          Alert.alert(
            "Remove place?",
            "This will remove the pin from your map.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: () => {
                  setPlaces((prev) => prev.filter((p) => p.id !== id));
                  if (token) {
                    fetch(`${API_BASE}/delete`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "X-TE-Token": token,
                      },
                      body: JSON.stringify({ id }),
                    }).catch((err) => console.warn("[travel] delete error:", err));
                  }
                },
              },
            ]
          );
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    [token]
  );

  // ── Confirm add (from map search) ──
  const handleConfirmAdd = useCallback(async (status: "visited" | "to-visit") => {
    if (!pendingPlace || !token) return;
    setAdding(true);

    const lat = parseFloat(pendingPlace.lat);
    const lng = parseFloat(pendingPlace.lon);
    const title = pendingPlace.name || pendingPlace.display_name.split(",")[0].trim();
    const itemTypeLevel = `${lat},${lng}`;

    try {
      const res = await fetch(`${API_BASE}/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TE-Token": token,
        },
        body: JSON.stringify({
          itemType: "Travel",
          itemTypeLevel,
          itemContent: title,
          status,
          createdDate: status === "visited" ? confirmDate : todayStr(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newPlace: TravelPlace = {
          id: String(data.id ?? data.rowId ?? Date.now()),
          title,
          address: pendingPlace.display_name,
          latitude: lat,
          longitude: lng,
          visitDate: status === "visited" ? confirmDate : "",
          status,
        };
        setPlaces((prev) => [...prev, newPlace]);

        // Inject just this new marker
        if (webViewRef.current) {
          const t = title.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
          let js: string;
          if (status === "to-visit") {
            js = `window.addWishlistMarker('${newPlace.id}',${lat},${lng},'${t}'); window.fitToMarkers(); true;`;
          } else {
            js = `window.addMarker('${newPlace.id}',${lat},${lng},'${t}','${confirmDate}'); window.fitToMarkers(); true;`;
          }
          webViewRef.current.injectJavaScript(js);
        }
      } else {
        console.warn("[travel] /add failed:", res.status);
      }
    } catch (err) {
      console.warn("[travel] add error:", err);
    }

    setAdding(false);
    setPendingPlace(null);
  }, [pendingPlace, token, confirmDate]);

  // ── Add to wishlist from list view ──
  const handleAddWishlistItem = useCallback(async () => {
    const text = wishlistText.trim();
    if (!text || !token) return;
    setAddingWishlist(true);
    try {
      const res = await fetch(`${API_BASE}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-TE-Token": token },
        body: JSON.stringify({
          itemType: "Travel",
          itemTypeLevel: "0,0",
          itemContent: text,
          status: "to-visit",
          createdDate: todayStr(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newPlace: TravelPlace = {
          id: String(data.id ?? data.rowId ?? Date.now()),
          title: text,
          address: text,
          latitude: 0,
          longitude: 0,
          visitDate: "",
          status: "to-visit",
        };
        setPlaces((prev) => [...prev, newPlace]);
        setWishlistText("");
      } else {
        console.warn("[travel] wishlist add failed:", res.status);
      }
    } catch (err) {
      console.warn("[travel] wishlist add error:", err);
    }
    setAddingWishlist(false);
  }, [wishlistText, token]);

  const handleCancelAdd = useCallback(() => {
    setPendingPlace(null);
  }, []);

  const handlePlaceSelect = useCallback((result: NominatimResult) => {
    setPendingPlace(result);
    setConfirmDate(todayStr());
  }, []);

  const shortTitle = useMemo(() => {
    if (!pendingPlace) return "";
    return pendingPlace.name || pendingPlace.display_name.split(",")[0].trim();
  }, [pendingPlace]);

  const shortAddress = useMemo(() => {
    if (!pendingPlace) return "";
    const parts = pendingPlace.display_name.split(",").map((s) => s.trim());
    return parts.slice(1, 4).join(", ");
  }, [pendingPlace]);

  return (
    <View style={styles.container}>
      {/* Map fills the full screen */}
      <MapWebView webViewRef={webViewRef} onMessage={onMessage} />

      {/* Overlay: header + search */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color={AppColors.textPrimary}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[styles.backBtn, showList && styles.toggleBtnActive]}
            onPress={() => { setShowList((v) => !v); setPendingPlace(null); }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showList
              ? <MaterialIcons name="map" size={20} color={AppColors.textPrimary} />
              : <MaterialIcons name="format-list-bulleted" size={20} color={AppColors.textPrimary} />}
          </TouchableOpacity>
        </View>

        {/* Search bar — only in map view, no confirm card, no active trip */}
        {!showList && !pendingPlace && !tripActive && (
          <View style={styles.searchWrap}>
            <PlaceSearch
              onSelect={handlePlaceSelect}
              placeholder="Search places in India…"
            />
          </View>
        )}

        {/* Active trip banner — replaces search bar while trip is running */}
        {!showList && tripActive && (
          <View style={styles.tripBanner}>
            <View style={styles.tripBannerLeft}>
              <View style={styles.tripDot} />
              <View>
                <Text style={styles.tripTimer}>{fmtElapsed(tripElapsed)}</Text>
                <Text style={styles.tripSubText}>
                  {tripWaypointsRef.current.length > 0
                    ? tripWaypointsRef.current[tripWaypointsRef.current.length - 1].p
                    : "Locating…"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.endTripBtn}
              onPress={handleEndTrip}
              activeOpacity={0.8}
            >
              <Text style={styles.endTripBtnText}>End Trip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom button row — GPS (right) and Start Trip (left), same height */}
      {!showList && !pendingPlace && !tripActive && (
        <View style={[styles.bottomBtnRow, { bottom: insets.bottom + 24 }]}>
          <TouchableOpacity
            style={styles.startTripBtn}
            onPress={handleStartTrip}
            activeOpacity={0.85}
          >
            <MaterialIcons name="directions-walk" size={20} color="#fff" />
            <Text style={styles.startTripBtnText}>Start Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gpsFabBtn}
            onPress={() => {
              if (Platform.OS !== "web") {
                Location.getForegroundPermissionsAsync().then(({ status }) => {
                  if (status === "granted") {
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                      .then((loc) => {
                        webViewRef.current?.injectJavaScript(
                          `window.centerOnMe(${loc.coords.latitude},${loc.coords.longitude}); true;`
                        );
                      })
                      .catch(() => {});
                  }
                });
              }
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="gps-fixed" size={22} color={AppColors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* List view — full screen, own header */}
      {showList && (
        <View style={[styles.listView, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.listHeader}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setShowList(false); setListSearch(""); }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="map" size={20} color={AppColors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.listHeaderTitle}>My Travels</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search bar */}
          <View style={styles.listSearchWrap}>
            <MaterialIcons name="search" size={18} color={AppColors.gray400} />
            <TextInput
              style={styles.listSearchInput}
              placeholder="Search places…"
              placeholderTextColor={AppColors.gray400}
              value={listSearch}
              onChangeText={setListSearch}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Visited section ── */}
            {(() => {
              const visited = places.filter((p) => !p.status || p.status === "visited");
              const filtered = [...visited]
                .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
                .filter((p) =>
                  listSearch.trim() === "" ||
                  p.title.toLowerCase().includes(listSearch.toLowerCase())
                );
              return (
                <>
                  <View style={styles.sectionHeader}>
                    <View style={styles.placePinDot} />
                    <Text style={styles.sectionTitle}>Visited</Text>
                    <Text style={styles.sectionCount}>{visited.length}</Text>
                  </View>
                  {visited.length === 0 ? (
                    <View style={styles.listEmpty}>
                      <MaterialIcons name="place" size={36} color={AppColors.gray300} />
                      <Text style={styles.listEmptyTitle}>No places yet</Text>
                      <Text style={styles.listEmptySubtitle}>Search on the map and mark as Visited</Text>
                    </View>
                  ) : filtered.length === 0 ? (
                    <View style={styles.listEmpty}>
                      <Text style={styles.listEmptySubtitle}>No visited places match "{listSearch}"</Text>
                    </View>
                  ) : filtered.map((place) => (
                    <View key={place.id} style={styles.placeRow}>
                      <View style={styles.placePinDot} />
                      <View style={styles.placeInfo}>
                        <Text style={styles.placeTitle} numberOfLines={1}>{place.title}</Text>
                        <Text style={styles.placeDate}>{formatDateDisplay(place.visitDate)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.placeDelete}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        onPress={() => {
                          Alert.alert(
                            "Remove place?",
                            `Remove "${place.title}" from your visited list?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => {
                                  setPlaces((prev) => prev.filter((p) => p.id !== place.id));
                                  if (webViewRef.current) {
                                    webViewRef.current.injectJavaScript(`window.removeMarker('${place.id}'); true;`);
                                  }
                                  if (token) {
                                    fetch(`${API_BASE}/delete`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", "X-TE-Token": token },
                                      body: JSON.stringify({ id: place.id }),
                                    }).catch((err) => console.warn("[travel] delete error:", err));
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      >
                        <MaterialIcons name="delete-outline" size={18} color={AppColors.red500} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              );
            })()}

            {/* ── Want to Visit section ── */}
            {(() => {
              const wishlist = places.filter((p) => p.status === "to-visit");
              const filtered = wishlist.filter((p) =>
                listSearch.trim() === "" ||
                p.title.toLowerCase().includes(listSearch.toLowerCase())
              );
              return (
                <>
                  <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                    <View style={styles.wishPinDot} />
                    <Text style={styles.sectionTitle}>Want to Visit</Text>
                    <Text style={styles.sectionCount}>{wishlist.length}</Text>
                  </View>

                  {/* Inline add form */}
                  <View style={styles.wishlistAddRow}>
                    <TextInput
                      style={styles.wishlistInput}
                      placeholder="Add a place or note…"
                      placeholderTextColor={AppColors.gray400}
                      value={wishlistText}
                      onChangeText={setWishlistText}
                      onSubmitEditing={handleAddWishlistItem}
                      returnKeyType="done"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={[styles.wishlistAddBtn, (!wishlistText.trim() || addingWishlist) && styles.wishlistAddBtnDisabled]}
                      onPress={handleAddWishlistItem}
                      disabled={!wishlistText.trim() || addingWishlist}
                      activeOpacity={0.8}
                    >
                      {addingWishlist
                        ? <ActivityIndicator size="small" color={AppColors.white} />
                        : <MaterialIcons name="add" size={20} color={AppColors.white} />}
                    </TouchableOpacity>
                  </View>

                  {wishlist.length === 0 ? (
                    <View style={styles.listEmpty}>
                      <MaterialIcons name="bookmark-border" size={36} color={AppColors.gray300} />
                      <Text style={styles.listEmptyTitle}>Your wishlist is empty</Text>
                      <Text style={styles.listEmptySubtitle}>Type above or search on the map</Text>
                    </View>
                  ) : filtered.length === 0 ? (
                    <View style={styles.listEmpty}>
                      <Text style={styles.listEmptySubtitle}>No wishlist items match "{listSearch}"</Text>
                    </View>
                  ) : filtered.map((place) => (
                    <View key={place.id} style={styles.placeRow}>
                      <View style={styles.wishPinDot} />
                      <View style={styles.placeInfo}>
                        <Text style={styles.placeTitle} numberOfLines={2}>{place.title}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.placeDelete}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        onPress={() => {
                          Alert.alert(
                            "Remove place?",
                            `Remove "${place.title}" from your wishlist?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => {
                                  setPlaces((prev) => prev.filter((p) => p.id !== place.id));
                                  if (webViewRef.current) {
                                    webViewRef.current.injectJavaScript(`window.removeMarker('${place.id}'); true;`);
                                  }
                                  if (token) {
                                    fetch(`${API_BASE}/delete`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", "X-TE-Token": token },
                                      body: JSON.stringify({ id: place.id }),
                                    }).catch((err) => console.warn("[travel] delete error:", err));
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      >
                        <MaterialIcons name="delete-outline" size={18} color={AppColors.red500} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              );
            })()}

            {/* ── Trips section ── */}
            {(() => {
              const trips = places.filter((p) => p.status === "trip");
              return (
                <>
                  <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                    <View style={styles.tripPinDot} />
                    <Text style={styles.sectionTitle}>Trips</Text>
                    <Text style={styles.sectionCount}>{trips.length}</Text>
                  </View>
                  {trips.length === 0 ? (
                    <View style={styles.listEmpty}>
                      <MaterialIcons name="directions-car" size={36} color={AppColors.gray300} />
                      <Text style={styles.listEmptyTitle}>No trips yet</Text>
                      <Text style={styles.listEmptySubtitle}>Tap "Start Trip" on the map to record a route</Text>
                    </View>
                  ) : trips.map((trip) => {
                    let data: { durationMs?: number; distanceKm?: number; waypoints?: TripWaypoint[]; startTime?: number } | null = null;
                    try { data = JSON.parse(trip.title); } catch {}
                    const wps = data?.waypoints ?? [];
                    return (
                      <TripRowItem
                        key={trip.id}
                        trip={trip}
                        data={data}
                        wps={wps}
                        fmtDuration={fmtDuration}
                        onDelete={() => {
                          Alert.alert(
                            "Delete trip?",
                            "This will permanently remove the trip and its route from your map.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => {
                                  setPlaces((prev) => prev.filter((p) => p.id !== trip.id));
                                  webViewRef.current?.injectJavaScript(`window.removeSavedTrip('${trip.id}'); true;`);
                                  if (token) {
                                    fetch(`${API_BASE}/delete`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", "X-TE-Token": token },
                                      body: JSON.stringify({ id: trip.id }),
                                    }).catch((e) => console.warn("[travel] delete trip error:", e));
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      />
                    );
                  })}
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* Trip summary modal */}
      {tripSummary && (
        <View style={[styles.tripSummaryOverlay, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.handle} />
          <Text style={styles.tripSummaryTitle}>Trip Complete</Text>
          <View style={styles.tripSummaryStats}>
            <View style={styles.tripStat}>
              <MaterialIcons name="timer" size={20} color="#F97316" />
              <Text style={styles.tripStatValue}>{fmtDuration(tripSummary.durationMs)}</Text>
              <Text style={styles.tripStatLabel}>Duration</Text>
            </View>
            <View style={styles.tripStatDivider} />
            <View style={styles.tripStat}>
              <MaterialIcons name="straighten" size={20} color="#F97316" />
              <Text style={styles.tripStatValue}>{tripSummary.distanceKm.toFixed(1)} km</Text>
              <Text style={styles.tripStatLabel}>Distance</Text>
            </View>
            <View style={styles.tripStatDivider} />
            <View style={styles.tripStat}>
              <MaterialIcons name="place" size={20} color="#F97316" />
              <Text style={styles.tripStatValue}>{tripSummary.waypoints.length}</Text>
              <Text style={styles.tripStatLabel}>Stops</Text>
            </View>
          </View>

          {tripSummary.waypoints.length > 0 && (
            <ScrollView style={styles.tripWpList} showsVerticalScrollIndicator={false}>
              {tripSummary.waypoints.map((wp, i) => (
                <View key={i} style={styles.tripWpRow}>
                  <View style={styles.tripWpDot} />
                  <Text style={styles.tripWpText}>{wp.t} — {wp.p}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.saveTripBtn, savingTrip && { opacity: 0.7 }]}
            onPress={() => handleSaveTripAndClose(tripSummary)}
            disabled={savingTrip}
            activeOpacity={0.85}
          >
            {savingTrip
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveTripBtnText}>Save Trip</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.discardTripBtn}
            onPress={() => setTripSummary(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.discardTripBtnText}>Discard</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation card */}
      {!showList && pendingPlace && (
        <View style={[styles.confirmCard, { paddingBottom: insets.bottom + 16 }]}>
          {/* Drag handle */}
          <View style={styles.handle} />

          <Text style={styles.confirmTitle}>{shortTitle}</Text>
          {shortAddress ? (
            <Text style={styles.confirmAddress} numberOfLines={2}>
              {shortAddress}
            </Text>
          ) : null}

          {/* Date picker row */}
          <View style={styles.datePicker}>
            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => setConfirmDate((d) => shiftDate(d, -1))}
              activeOpacity={0.7}
            >
              <MaterialIcons name="chevron-left" size={24} color={AppColors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.dateDisplay}>
              <MaterialIcons name="calendar-today" size={14} color={AppColors.textSecondary} />
              <Text style={styles.dateText}>{formatDateDisplay(confirmDate)}</Text>
            </View>
            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => {
                const next = shiftDate(confirmDate, 1);
                if (next <= todayStr()) setConfirmDate(next);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={confirmDate >= todayStr() ? AppColors.gray300 : AppColors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* Action buttons */}
          <View style={styles.confirmBtnRow}>
            <TouchableOpacity
              style={[styles.addBtn, styles.addBtnVisited, adding && styles.addBtnDisabled]}
              onPress={() => handleConfirmAdd("visited")}
              activeOpacity={0.85}
              disabled={adding}
            >
              {adding ? (
                <ActivityIndicator size="small" color={AppColors.textPrimary} />
              ) : (
                <Text style={styles.addBtnText}>✓ Visited</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addBtn, styles.addBtnWishlist, adding && styles.addBtnDisabled]}
              onPress={() => handleConfirmAdd("to-visit")}
              activeOpacity={0.85}
              disabled={adding}
            >
              <Text style={styles.addBtnTextWishlist}>★ Want to Visit</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancelAdd}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.gray100,
  },
  webView: {
    flex: 1,
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.gray100,
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
    backgroundColor: AppColors.gray100,
  },
  webFallbackText: {
    fontSize: 15,
    color: AppColors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // ── Top overlay ──
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleBtnActive: {
    backgroundColor: AppColors.primarySolid,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: AppColors.textPrimary,
    backgroundColor: AppColors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchWrap: {
    backgroundColor: AppColors.white,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  // ── Confirmation card ──
  confirmCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AppColors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: AppColors.gray200,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: AppColors.textPrimary,
    marginBottom: 4,
  },
  confirmAddress: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },

  // ── Date picker ──
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: AppColors.gray100,
    borderRadius: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  dateArrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "600",
    color: AppColors.textPrimary,
  },

  // ── Buttons ──
  confirmBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  addBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  addBtnVisited: {
    backgroundColor: AppColors.primarySolid,
  },
  addBtnWishlist: {
    backgroundColor: "#2563EB",
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  addBtnTextWishlist: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    fontWeight: "500",
  },

  // ── List view ──
  listView: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AppColors.white,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  listHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  listSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: AppColors.gray100,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  listSearchInput: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textPrimary,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  listEmpty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  listEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: AppColors.gray400,
  },
  listEmptySubtitle: {
    fontSize: 12,
    color: AppColors.gray400,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
    marginBottom: 4,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.gray400,
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
    gap: 12,
  },
  placePinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppColors.primarySolid,
    borderWidth: 2,
    borderColor: AppColors.textPrimary,
  },
  wishPinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#1D4ED8",
  },
  wishlistAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 10,
  },
  wishlistInput: {
    flex: 1,
    backgroundColor: AppColors.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: AppColors.textPrimary,
  },
  wishlistAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  wishlistAddBtnDisabled: {
    opacity: 0.45,
  },
  placeInfo: {
    flex: 1,
  },
  placeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: AppColors.textPrimary,
    marginBottom: 2,
  },
  placeDate: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  placeDelete: {
    padding: 4,
  },

  // ── Trip dots ──
  tripPinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F97316",
  },

  // ── Bottom button row (Start Trip + GPS) ──
  bottomBtnRow: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  startTripBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F97316",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  startTripBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  gpsFabBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 6,
  },

  // ── Active trip banner ──
  tripBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tripBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  tripDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F97316",
  },
  tripTimer: {
    fontSize: 17,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  tripSubText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    maxWidth: 180,
  },
  endTripBtn: {
    backgroundColor: "#F97316",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  endTripBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Trip summary modal ──
  tripSummaryOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AppColors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: "65%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 14,
  },
  tripSummaryTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: AppColors.textPrimary,
    textAlign: "center",
    marginBottom: 16,
  },
  tripSummaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  tripStat: {
    alignItems: "center",
    gap: 4,
  },
  tripStatValue: {
    fontSize: 17,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  tripStatLabel: {
    fontSize: 11,
    color: AppColors.textSecondary,
  },
  tripStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#FFE4C7",
  },
  tripWpList: {
    maxHeight: 160,
    marginBottom: 16,
  },
  tripWpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  tripWpDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F97316",
  },
  tripWpText: {
    fontSize: 13,
    color: AppColors.textPrimary,
    flex: 1,
  },
  saveTripBtn: {
    backgroundColor: "#F97316",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  saveTripBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  discardTripBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 4,
  },
  discardTripBtnText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
});
