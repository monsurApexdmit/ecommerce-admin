import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

type Props = {
  visible: boolean;
  onScanned: (barcode: string) => void;
  onClose: () => void;
};

export function BarcodeScannerModal({ visible, onScanned, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      if (!permission?.granted) requestPermission();
    }
    return () => {
      if (cooldown.current) clearTimeout(cooldown.current);
    };
  }, [visible]);

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScanned(data);
    onClose();
    // reset after close so next open works immediately
    cooldown.current = setTimeout(() => setScanned(false), 1500);
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Scan Barcode</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Camera */}
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"] }}
            onBarcodeScanned={scanned ? undefined : handleBarcode}
          >
            {/* Viewfinder overlay */}
            <View style={styles.overlay}>
              <View style={styles.topFade} />
              <View style={styles.middleRow}>
                <View style={styles.sideFade} />
                <View style={styles.finder}>
                  {/* Corner marks */}
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                  {/* Scan line */}
                  <View style={styles.scanLine} />
                </View>
                <View style={styles.sideFade} />
              </View>
              <View style={styles.bottomFade}>
                <Text style={styles.hint}>Point the camera at a product barcode</Text>
              </View>
            </View>
          </CameraView>
        ) : (
          <View style={styles.permissionWrap}>
            <Ionicons name="camera-outline" size={56} color={colors.muted} />
            <Text style={styles.permissionText}>Camera access is required to scan barcodes.</Text>
            <Pressable style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Grant Permission</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const FINDER_SIZE = 240;
const CORNER_SIZE = 24;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: "#000",
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  topFade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  middleRow: {
    flexDirection: "row",
    height: FINDER_SIZE,
  },
  sideFade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  finder: {
    width: FINDER_SIZE,
    height: FINDER_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "#fff",
  },
  tl: { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
  tr: { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },
  bl: { bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
  br: { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },
  scanLine: {
    position: "absolute",
    top: "50%",
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.85,
  },
  bottomFade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    paddingTop: 24,
  },
  hint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  permissionWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
    backgroundColor: colors.background,
  },
  permissionText: {
    color: colors.muted,
    fontSize: 15,
    textAlign: "center",
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  permissionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
