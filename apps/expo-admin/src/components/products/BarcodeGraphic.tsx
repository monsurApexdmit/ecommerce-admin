import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

type BarcodeGraphicProps = {
  value: string;
  singleBarWidth?: number;
  height?: number;
  lineColor?: string;
  backgroundColor?: string;
};

function encodeValueToBinary(value: string) {
  const normalized = value.trim() || "0";
  const chunks = normalized
    .split("")
    .map((character, index) => {
      const charCode = character.charCodeAt(0);
      const next = ((charCode + 17) * (index + 3)) % 127;
      return next.toString(2).padStart(7, "0");
    })
    .join("0");

  return `1010${chunks}1110101`;
}

function drawRect(x: number, y: number, rectWidth: number, height: number) {
  return `M${x},${y}h${rectWidth}v${height}h-${rectWidth}z`;
}

function buildPath(binary: string, singleBarWidth: number, height: number) {
  const rects: string[] = [];
  let run = 0;
  let x = 0;

  for (let index = 0; index < binary.length; index += 1) {
    x = index * singleBarWidth;

    if (binary[index] === "1") {
      run += 1;
      continue;
    }

    if (run > 0) {
      rects.push(drawRect(x - singleBarWidth * run, 0, singleBarWidth * run, height));
      run = 0;
    }
  }

  if (run > 0) {
    rects.push(drawRect(x - singleBarWidth * (run - 1), 0, singleBarWidth * run, height));
  }

  return rects.join(" ");
}

export function BarcodeGraphic({
  value,
  singleBarWidth = 2,
  height = 72,
  lineColor = "#000000",
  backgroundColor = "#FFFFFF",
}: BarcodeGraphicProps) {
  const binary = useMemo(() => encodeValueToBinary(value), [value]);
  const width = binary.length * singleBarWidth;
  const path = useMemo(
    () => buildPath(binary, singleBarWidth, height),
    [binary, singleBarWidth, height],
  );

  if (!value.trim()) {
    return (
      <View style={[styles.empty, { backgroundColor, height }]}>
        <Text style={styles.emptyText}>Barcode unavailable</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height, backgroundColor }}>
      <Svg
        width="100%"
        height="100%"
        fill={lineColor}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <Path d={path} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  emptyText: {
    fontSize: 12,
    textAlign: "center",
  },
});
