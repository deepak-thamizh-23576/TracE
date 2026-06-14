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
  AppState,
  BackHandler,
  KeyboardAvoidingView,
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
import { router, Stack } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { AppColors } from "@/constants/colors";
import { TravelPlace, TripRecord, TripWaypoint } from "@/constants/tasks";
import { TRAVEL_MAP_HTML } from "@/constants/travelMapHtml";
import PlaceSearch from "@/components/tasks/PlaceSearch";
import type { NominatimResult } from "@/components/tasks/PlaceSearch";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

const PENDING_TRIP_KEY = "te_pending_trip";
const ACTIVE_TRIP_KEY  = "te_active_trip";  // mid-trip snapshot, saved every waypoint
const TRIP_NOTIF_ID    = "te-trip-active";  // persistent notification shown during a trip

// ─── Trip notification helper (module-level, no re-render cost) ───────────────
// Posts or updates the sticky non-clearable trip notification.
// On Android, `ongoing: true` + `sticky: true` prevents the user from swiping it away.
async function postTripNotification(elapsedSecs: number, lastPlace: string): Promise<void> {
  const h = Math.floor(elapsedSecs / 3600);
  const m = Math.floor((elapsedSecs % 3600) / 60);
  const s = elapsedSecs % 60;
  const timeStr = h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
    : `${m}m ${String(s).padStart(2, "0")}s`;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: TRIP_NOTIF_ID,
      content: {
        title: `Trip in progress \u00b7 ${timeStr}`,
        body: lastPlace ? `\u{1F4CD} ${lastPlace}` : "Tracking your route…",
        data: {},
        color: "#00C6B3",
        sticky: true,       // non-dismissible by swipe (Android isOngoing)
        autoDismiss: false, // don\'t dismiss on tap
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch {
    // Notification permission not granted — fail silently
  }
}

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

// ──────────── Trip detection helper ────────────
// The Catalyst DataStore may not preserve the "trip" status value, causing it
// to fall back to "visited". Detect trips by content shape as a reliable fallback.
function isTrip(place: TravelPlace): boolean {
  if (place.status === "trip") return true;
  try {
    const d = JSON.parse(place.title);
    return typeof d.startTime === "number" && typeof d.endTime === "number";
  } catch {
    return false;
  }
}

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
  const [activeSection, setActiveSection] = useState<"explored" | "to-explore" | "live-tracking" | null>(null);

  // Confirmation card state
  const [pendingPlace, setPendingPlace] = useState<NominatimResult | null>(null);
  const [confirmDate, setConfirmDate] = useState<string>(todayStr());
  const [confirmNotes, setConfirmNotes] = useState<string>("");

  // Notes editing in list view
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editNotesText, setEditNotesText] = useState<string>("");

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
  const lastWaypointTimeRef    = useRef<number>(0);
  const backgroundStartTimeRef  = useRef<number>(0); // tracks when app went to background
  const tripNotifTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastWaypointNameRef     = useRef<string>("");  // last reverse-geocoded place for notification
  const WAYPOINT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // Set up Android notification channel for the persistent trip notification
  useEffect(() => {
    if (Platform.OS !== "android") return;
    Notifications.setNotificationChannelAsync("trip", {
      name: "Active Trip",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: null,
      enableVibrate: false,
      showBadge: false,
    }).catch(() => {});
    // Request notification permission (Android 13+ requires explicit grant)
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);

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

    // Clear any leftover mid-trip snapshot, then request background location
    AsyncStorage.removeItem(ACTIVE_TRIP_KEY).catch(() => {});
    if (Platform.OS !== "web") {
      // On Android 11+: must request foreground first (done at mount), then background
      // On iOS: triggers the "Always Allow" prompt if not yet granted
      Location.requestBackgroundPermissionsAsync().catch(() => {});
    }

    // ── Start persistent trip notification ──
    if (Platform.OS === "android") {
      lastWaypointNameRef.current = "";
      // Post an initial notification immediately (elapsed = 0)
      postTripNotification(0, "");
      // Update every second — replaces the notification in-place via the same identifier
      tripNotifTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - tripStartTimeRef.current) / 1000);
        postTripNotification(elapsed, lastWaypointNameRef.current);
      }, 1000);
    }
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
          lastWaypointNameRef.current = place; // feed starting location into the notification
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

    // Stop the notification update timer and dismiss the notification
    if (tripNotifTimerRef.current !== null) {
      clearInterval(tripNotifTimerRef.current);
      tripNotifTimerRef.current = null;
    }
    Notifications.dismissNotificationAsync(TRIP_NOTIF_ID).catch(() => {});

    // Clear the mid-trip snapshot — we're building a final record now
    AsyncStorage.removeItem(ACTIVE_TRIP_KEY).catch(() => {});

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

    // Persist immediately so a network failure or app kill can't erase the trip
    AsyncStorage.setItem(PENDING_TRIP_KEY, JSON.stringify(record)).catch(() => {});

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
        // Clear the persisted pending trip only after a confirmed save
        AsyncStorage.removeItem(PENDING_TRIP_KEY).catch(() => {});
        AsyncStorage.removeItem(ACTIVE_TRIP_KEY).catch(() => {});
        setSavingTrip(false);
        setTripSummary(null);
      } else {
        // Non-2xx from server — keep modal open so user can retry
        setSavingTrip(false);
        Alert.alert("Save failed", "Couldn't save your trip. Check your connection and tap Save again.");
      }
    } catch (err) {
      // Network error (e.g. mid-flight network switch) — keep modal open so user can retry
      console.warn("[travel] save trip error:", err);
      setSavingTrip(false);
      Alert.alert("Network error", "Couldn't reach the server. Your trip data is safe — tap Save again when connected.");
    }
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
          { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 15000 },
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
                  // Update notification body with latest place name
                  lastWaypointNameRef.current = place;
                  // Progressive save — if app is killed mid-trip, this data survives
                  AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({
                    id: String(tripStartTimeRef.current),
                    date: todayStr(),
                    startTime: tripStartTimeRef.current,
                    waypoints: tripWaypointsRef.current,
                    path: tripPathRef.current,
                  })).catch(() => {});
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
        if (isTrip(p)) {
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
      const nonTripCount = list.filter((p) => !isTrip(p) && p.latitude !== 0).length;
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
      // Parse out notes from title in case backend hasn't been redeployed yet
      const list: TravelPlace[] = (data.places ?? []).map((p: TravelPlace) => {
        if (p.title && p.title.includes("|||")) {
          const sepIdx = p.title.indexOf("|||");
          const cleanTitle = p.title.slice(0, sepIdx).trim();
          const parsedNotes = p.title.slice(sepIdx + 3).trim();
          return { ...p, title: cleanTitle, notes: parsedNotes || p.notes };
        }
        return p;
      });
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

  // Recover any unsaved trip (completed but not saved, OR interrupted mid-trip)
  useEffect(() => {
    AsyncStorage.getItem(PENDING_TRIP_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const record: TripRecord = JSON.parse(raw);
            if (Date.now() - record.endTime < 24 * 60 * 60 * 1000) {
              Alert.alert(
                "Unsaved trip found",
                "A trip that wasn't saved was found. Would you like to save it now?",
                [
                  { text: "Discard", style: "destructive", onPress: () => AsyncStorage.removeItem(PENDING_TRIP_KEY).catch(() => {}) },
                  { text: "Save", onPress: () => setTripSummary(record) },
                ]
              );
            } else {
              AsyncStorage.removeItem(PENDING_TRIP_KEY).catch(() => {});
            }
          } catch {
            AsyncStorage.removeItem(PENDING_TRIP_KEY).catch(() => {});
          }
          return; // don't also check ACTIVE_TRIP_KEY in the same session
        }
        // No completed pending trip — check for a mid-trip snapshot (app was killed while recording)
        AsyncStorage.getItem(ACTIVE_TRIP_KEY)
          .then((activeRaw) => {
            if (!activeRaw) return;
            try {
              const snap: {
                id: string; date: string; startTime: number;
                waypoints: TripWaypoint[];
                path: { lat: number; lng: number }[];
              } = JSON.parse(activeRaw);
              const age = Date.now() - snap.startTime;
              if (age < 24 * 60 * 60 * 1000 && snap.waypoints?.length > 0) {
                const startedAt = new Date(snap.startTime)
                  .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                Alert.alert(
                  "Interrupted trip found",
                  `A trip started at ${startedAt} was cut short (app was closed or screen locked too long). Save what was recorded?`,
                  [
                    { text: "Discard", style: "destructive", onPress: () => AsyncStorage.removeItem(ACTIVE_TRIP_KEY).catch(() => {}) },
                    {
                      text: "Save",
                      onPress: () => {
                        const record: TripRecord = {
                          id: snap.id || String(snap.startTime),
                          date: snap.date || todayStr(),
                          startTime: snap.startTime,
                          endTime: snap.startTime + age,
                          durationMs: age,
                          distanceKm: parseFloat(calcDistance(snap.path ?? []).toFixed(2)),
                          waypoints: snap.waypoints,
                        };
                        AsyncStorage.removeItem(ACTIVE_TRIP_KEY).catch(() => {});
                        setTripSummary(record);
                      },
                    },
                  ]
                );
              } else {
                AsyncStorage.removeItem(ACTIVE_TRIP_KEY).catch(() => {});
              }
            } catch {
              AsyncStorage.removeItem(ACTIVE_TRIP_KEY).catch(() => {});
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn user if the app was backgrounded for a while during an active trip
  // (location tracking pauses on iOS when the screen locks without background permission)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundStartTimeRef.current = Date.now();
      } else if (nextState === "active" && tripActiveRef.current) {
        const bgMs = Date.now() - backgroundStartTimeRef.current;
        if (bgMs > 30_000) {
          Alert.alert(
            "Tracking may have paused",
            "The app was in the background — iOS/Android may have paused location tracking. Some distance or stops in that gap may be missing.",
            [{ text: "OK" }]
          );
        }
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (mapReady && placesLoaded) {
      injectMarkers(places);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, placesLoaded]);

  // Android hardware back — when list view is open, close it instead of exiting the screen
  useEffect(() => {
    if (!showList) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeSection) {
        setActiveSection(null);
      } else {
        setShowList(false);
        setListSearch("");
      }
      return true; // consume the event
    });
    return () => sub.remove();
  }, [showList, activeSection]);

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
    // Remove preview pin before adding the real marker
    webViewRef.current?.injectJavaScript(`window.removePreviewPin(); true;`);

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
          itemContent: confirmNotes.trim() ? `${title}|||${confirmNotes.trim()}` : title,
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
          notes: confirmNotes.trim() || undefined,
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
    setConfirmNotes("");
    setPendingPlace(null);
  }, [pendingPlace, token, confirmDate, confirmNotes]);

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
    setConfirmNotes("");
    setEditingNotesId(null);
    webViewRef.current?.injectJavaScript(`window.removePreviewPin(); true;`);
  }, []);

  const handleSaveNotes = useCallback(async (place: TravelPlace, newNotes: string) => {
    const trimmed = newNotes.trim();
    const newContent = trimmed ? `${place.title}|||${trimmed}` : place.title;
    setPlaces((prev) => prev.map((p) => p.id === place.id ? { ...p, notes: trimmed || undefined } : p));
    setEditingNotesId(null);
    if (token) {
      fetch(`${API_BASE}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-TE-Token": token },
        body: JSON.stringify({ id: place.id, itemContent: newContent }),
      }).catch((err) => console.warn("[travel] notes update error:", err));
    }
  }, [token]);

  const handlePlaceSelect = useCallback((result: NominatimResult) => {
    setPendingPlace(result);
    setConfirmDate(todayStr());
    setConfirmNotes("");
    // Fly the map to the selected place and show a preview pin
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lng) && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `map.setView([${lat}, ${lng}], 14); window.showPreviewPin(${lat}, ${lng}); true;`
      );
    }
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
      {/* Disable iOS swipe-back when list view is open so back returns to map, not tasks */}
      <Stack.Screen options={{ gestureEnabled: !showList }} />
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
            onPress={() => { setShowList((v) => !v); setPendingPlace(null); setActiveSection(null); }}
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
              onPress={() => {
                if (activeSection) {
                  setActiveSection(null);
                } else {
                  setShowList(false);
                  setListSearch("");
                }
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name={activeSection ? "arrow-back" : "map"}
                size={20}
                color={AppColors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.listHeaderTitle}>
              {activeSection === "explored"
                ? "Explored"
                : activeSection === "to-explore"
                ? "To Explore"
                : activeSection === "live-tracking"
                ? "Live Tracking"
                : "My Travels"}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* ── Cards view ── */}
          {!activeSection && (
            <View style={styles.summaryCardsWrap}>
              <View style={styles.summaryRow}>
                <TouchableOpacity
                  style={[styles.summaryCard, styles.summaryCardExplored]}
                  onPress={() => setActiveSection("explored")}
                  activeOpacity={0.75}
                >
                  <MaterialIcons name="place" size={28} color="#FFD900" />
                  <Text style={styles.summaryCardCount}>
                    {places.filter((p) => !isTrip(p) && (!p.status || p.status === "visited")).length}
                  </Text>
                  <Text style={styles.summaryCardLabel}>Explored</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.summaryCard, styles.summaryCardToExplore]}
                  onPress={() => setActiveSection("to-explore")}
                  activeOpacity={0.75}
                >
                  <MaterialIcons name="bookmark" size={28} color="#2563EB" />
                  <Text style={styles.summaryCardCount}>
                    {places.filter((p) => p.status === "to-visit").length}
                  </Text>
                  <Text style={styles.summaryCardLabel}>To Explore</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.summaryRow}>
                <TouchableOpacity
                  style={[styles.summaryCard, styles.summaryCardTracking, { flex: 1 }]}
                  onPress={() => setActiveSection("live-tracking")}
                  activeOpacity={0.75}
                >
                  <MaterialIcons name="directions-walk" size={28} color="#F97316" />
                  <Text style={styles.summaryCardCount}>
                    {places.filter((p) => isTrip(p)).length}
                  </Text>
                  <Text style={styles.summaryCardLabel}>Live Tracking</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Explored section ── */}
          {activeSection === "explored" && (() => {
            const visited = places
              .filter((p) => !isTrip(p) && (!p.status || p.status === "visited"))
              .sort((a, b) => b.visitDate.localeCompare(a.visitDate));
            return (
              <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                {visited.length === 0 ? (
                  <View style={styles.listEmpty}>
                    <MaterialIcons name="place" size={36} color={AppColors.gray300} />
                    <Text style={styles.listEmptyTitle}>No places yet</Text>
                    <Text style={styles.listEmptySubtitle}>Search on the map and mark as Explored</Text>
                  </View>
                ) : visited.map((place) => (
                  <View key={place.id} style={styles.placeRowWrap}>
                    <View style={styles.placeRow}>
                      <View style={styles.placePinDot} />
                      <View style={styles.placeInfo}>
                        <Text style={styles.placeTitle} numberOfLines={1}>{place.title}</Text>
                        <Text style={styles.placeDate}>{formatDateDisplay(place.visitDate)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.placeNoteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        onPress={() => { setEditingNotesId(place.id); setEditNotesText(place.notes ?? ""); }}
                      >
                        <MaterialIcons name={place.notes ? "notes" : "note-add"} size={17} color={place.notes ? AppColors.textSecondary : AppColors.gray300} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.placeDelete}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        onPress={() => {
                          Alert.alert(
                            "Remove place?",
                            `Remove "${place.title}" from your explored list?`,
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
                    {editingNotesId === place.id ? (
                      <View style={styles.notesEditWrap}>
                        <TextInput
                          style={styles.notesEditInput}
                          value={editNotesText}
                          onChangeText={setEditNotesText}
                          placeholder="Add a note about this place…"
                          placeholderTextColor={AppColors.gray400}
                          multiline
                          autoFocus
                          blurOnSubmit
                        />
                        <View style={styles.notesBtnRow}>
                          <TouchableOpacity style={styles.notesCancelBtn} onPress={() => setEditingNotesId(null)}>
                            <Text style={styles.notesCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.notesSaveBtn} onPress={() => handleSaveNotes(place, editNotesText)}>
                            <Text style={styles.notesSaveText}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : place.notes ? (
                      <TouchableOpacity
                        style={styles.notesDisplayRow}
                        activeOpacity={0.7}
                        onPress={() => { setEditingNotesId(place.id); setEditNotesText(place.notes ?? ""); }}
                      >
                        <Text style={styles.placeNotes}>{place.notes}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            );
          })()}

          {/* ── To Explore section ── */}
          {activeSection === "to-explore" && (() => {
            const wishlist = places.filter((p) => p.status === "to-visit");
            return (
              <ScrollView
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
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
                    <Text style={styles.listEmptyTitle}>Your list is empty</Text>
                    <Text style={styles.listEmptySubtitle}>Type above or search on the map</Text>
                  </View>
                ) : wishlist.map((place) => (
                  <View key={place.id} style={styles.placeRowWrap}>
                    <View style={styles.placeRow}>
                      <View style={styles.wishPinDot} />
                      <View style={styles.placeInfo}>
                        <Text style={styles.placeTitle} numberOfLines={2}>{place.title}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.placeNoteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        onPress={() => { setEditingNotesId(place.id); setEditNotesText(place.notes ?? ""); }}
                      >
                        <MaterialIcons name={place.notes ? "notes" : "note-add"} size={17} color={place.notes ? AppColors.textSecondary : AppColors.gray300} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.placeDelete}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        onPress={() => {
                          Alert.alert(
                            "Remove place?",
                            `Remove "${place.title}" from your list?`,
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
                    {editingNotesId === place.id ? (
                      <View style={styles.notesEditWrap}>
                        <TextInput
                          style={styles.notesEditInput}
                          value={editNotesText}
                          onChangeText={setEditNotesText}
                          placeholder="Add a note about this place…"
                          placeholderTextColor={AppColors.gray400}
                          multiline
                          autoFocus
                          blurOnSubmit
                        />
                        <View style={styles.notesBtnRow}>
                          <TouchableOpacity style={styles.notesCancelBtn} onPress={() => setEditingNotesId(null)}>
                            <Text style={styles.notesCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.notesSaveBtn} onPress={() => handleSaveNotes(place, editNotesText)}>
                            <Text style={styles.notesSaveText}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : place.notes ? (
                      <TouchableOpacity
                        style={styles.notesDisplayRow}
                        activeOpacity={0.7}
                        onPress={() => { setEditingNotesId(place.id); setEditNotesText(place.notes ?? ""); }}
                      >
                        <Text style={styles.placeNotes}>{place.notes}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            );
          })()}

          {/* ── Live Tracking section ── */}
          {activeSection === "live-tracking" && (() => {
            const trips = places.filter((p) => isTrip(p));
            return (
              <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
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
              </ScrollView>
            );
          })()}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "position" : "padding"}
          keyboardVerticalOffset={insets.bottom}
          style={[styles.confirmCard, { paddingBottom: insets.bottom + 16 }]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
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

            {/* Notes */}
            <Text style={styles.notesLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Anything to remember about this place…"
              placeholderTextColor={AppColors.gray400}
              value={confirmNotes}
              onChangeText={setConfirmNotes}
              multiline
              blurOnSubmit
              autoCorrect={false}
            />

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
          </ScrollView>
        </KeyboardAvoidingView>
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
  placeRowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  placeNoteBtn: {
    padding: 4,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textSecondary,
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: AppColors.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: AppColors.textPrimary,
    marginBottom: 16,
    minHeight: 70,
    textAlignVertical: "top",
  },
  notesEditWrap: {
    paddingBottom: 12,
  },
  notesEditInput: {
    backgroundColor: AppColors.gray100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: AppColors.textPrimary,
    marginBottom: 8,
    minHeight: 60,
    textAlignVertical: "top",
  },
  notesBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  notesCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  notesCancelText: {
    fontSize: 13,
    color: AppColors.textSecondary,
    fontWeight: "500",
  },
  notesSaveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: AppColors.primarySolid,
    borderRadius: 8,
  },
  notesSaveText: {
    fontSize: 13,
    color: AppColors.textPrimary,
    fontWeight: "700",
  },
  notesDisplayRow: {
    paddingBottom: 10,
    paddingLeft: 22,
  },
  placeNotes: {
    fontSize: 12,
    color: AppColors.textSecondary,
    lineHeight: 17,
    fontStyle: "italic",
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

  // ── Summary cards ──
  summaryCardsWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: AppColors.white,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: AppColors.gray100,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCardExplored: {
    borderTopWidth: 3,
    borderTopColor: AppColors.primarySolid,
  },
  summaryCardToExplore: {
    borderTopWidth: 3,
    borderTopColor: "#2563EB",
  },
  summaryCardTracking: {
    borderTopWidth: 3,
    borderTopColor: "#F97316",
  },
  summaryCardCount: {
    fontSize: 26,
    fontWeight: "700",
    color: AppColors.textPrimary,
    marginTop: 4,
  },
  summaryCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: AppColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
