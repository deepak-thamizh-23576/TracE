import { AppColors } from "@/constants/colors";
import { Linking, StyleProp, Text, TextStyle } from "react-native";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

interface LinkTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
}

/**
 * Renders text with any http/https URLs as tappable links.
 */
export default function LinkText({ text, style, linkStyle }: LinkTextProps) {
  const parts = text.split(URL_REGEX);

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // Reset lastIndex since we reuse the regex
          URL_REGEX.lastIndex = 0;
          return (
            <Text
              key={i}
              style={[{ color: AppColors.primarySolid, textDecorationLine: "underline" }, linkStyle]}
              onPress={() => Linking.openURL(part)}
              suppressHighlighting
            >
              {part}
            </Text>
          );
        }
        URL_REGEX.lastIndex = 0;
        return part ? <Text key={i}>{part}</Text> : null;
      })}
    </Text>
  );
}
