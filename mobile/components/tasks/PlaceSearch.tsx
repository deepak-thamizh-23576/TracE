import { AppColors } from "@/constants/colors";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface NominatimResult {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
}

interface PlaceSearchProps {
  onSelect: (result: NominatimResult) => void;
  placeholder?: string;
}

export default function PlaceSearch({ onSelect, placeholder = "Search places…" }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (text: string) => {
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&countrycodes=in&addressdetails=0`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "User-Agent": "TrackEverythingApp/1.0",
        },
      });
      if (!res.ok) throw new Error("Nominatim error");
      const data: NominatimResult[] = await res.json();
      setResults(data);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // 1s debounce to respect Nominatim's 1 req/sec rate limit
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const handleSelect = (item: NominatimResult) => {
    setQuery("");
    setResults([]);
    onSelect(item);
  };

  // Format a Nominatim display_name into a short readable label
  const shortName = (item: NominatimResult) => {
    // display_name is usually "Place, Area, City, State, Country"
    // Take first 2 parts for the title, rest as subtitle
    const parts = item.display_name.split(", ");
    return {
      primary: parts.slice(0, 2).join(", "),
      secondary: parts.slice(2, 4).join(", "),
    };
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <MaterialIcons name="search" size={18} color={AppColors.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={AppColors.gray400}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color={AppColors.textSecondary} style={styles.loader} />}
        {!loading && query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {results.length > 0 && (
        <FlatList
          style={styles.dropdown}
          data={results}
          keyExtractor={(item) => String(item.place_id)}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={false}
          renderItem={({ item, index }) => {
            const { primary, secondary } = shortName(item);
            return (
              <TouchableOpacity
                style={[styles.resultItem, index < results.length - 1 && styles.resultBorder]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.resultPrimary} numberOfLines={1}>{primary}</Text>
                {secondary ? (
                  <Text style={styles.resultSecondary} numberOfLines={1}>{secondary}</Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.gray100,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: AppColors.textPrimary,
    padding: 0,
  },
  loader: {
    marginLeft: 8,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },
  clearText: {
    fontSize: 12,
    color: AppColors.gray400,
  },
  dropdown: {
    backgroundColor: AppColors.white,
    borderRadius: 14,
    marginTop: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  resultItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  resultBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.gray200,
  },
  resultPrimary: {
    fontSize: 14,
    fontWeight: "600",
    color: AppColors.textPrimary,
    marginBottom: 2,
  },
  resultSecondary: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
});
