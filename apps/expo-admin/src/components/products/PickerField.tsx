import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

type Option = {
  label: string;
  value: string;
};

type PickerFieldProps = {
  label: string;
  placeholder: string;
  value?: string;
  options: Option[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
};

export function PickerField({
  label,
  placeholder,
  value,
  options,
  onChange,
  allowEmpty = false,
}: PickerFieldProps) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setVisible(true)}>
        <Text style={[styles.fieldText, !selected ? styles.placeholder : null]}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.options}>
              {allowEmpty ? (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange("");
                    setVisible(false);
                  }}
                >
                  <Text style={styles.optionText}>None</Text>
                </Pressable>
              ) : null}
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={styles.option}
                  onPress={() => {
                    onChange(option.value);
                    setVisible(false);
                  }}
                >
                  <Text style={styles.optionText}>{option.label}</Text>
                  {option.value === value ? (
                    <Ionicons name="checkmark" size={18} color={colors.primaryDark} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  field: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fieldText: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  placeholder: {
    color: colors.muted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  options: {
    gap: 8,
  },
  option: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
});
