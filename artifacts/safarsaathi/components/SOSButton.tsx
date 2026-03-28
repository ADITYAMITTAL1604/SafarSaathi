import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface SOSButtonProps {
  onPress: () => void;
  size?: number;
  pulsing?: boolean;
}

export default function SOSButton({ onPress, size = 72, pulsing = false }: SOSButtonProps) {
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    if (pulsing) {
      ringScale.value = withRepeat(
        withSequence(withTiming(1.8, { duration: 1000 }), withTiming(1, { duration: 0 })),
        -1,
        false
      );
      ringOpacity.value = withRepeat(
        withSequence(withTiming(0, { duration: 1000 }), withTiming(0.6, { duration: 0 })),
        -1,
        false
      );
      scale.value = withRepeat(
        withSequence(withTiming(1.05, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        false
      );
    } else {
      scale.value = withTiming(1);
      ringOpacity.value = withTiming(0);
    }
  }, [pulsing]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    scale.value = withSequence(withTiming(0.9, { duration: 80 }), withTiming(1, { duration: 80 }));
    onPress();
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size * 1.8,
            height: size * 1.8,
            borderRadius: (size * 1.8) / 2,
            backgroundColor: Colors.danger,
          },
          ringStyle,
        ]}
      />
      <Animated.View style={buttonStyle}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.85}
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: Colors.danger,
            },
          ]}
        >
          <Text style={[styles.label, { fontSize: size * 0.24 }]}>SOS</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  label: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
});
