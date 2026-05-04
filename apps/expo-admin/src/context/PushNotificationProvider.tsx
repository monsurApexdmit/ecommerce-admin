import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  attachMobileNotificationResponseListener,
  detachMobileNotificationResponseListener,
  ensureMobileNotificationPermissions,
} from "@/lib/mobile-notifications";

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const { bootstrapped, session } = useAuth();

  useEffect(() => {
    void attachMobileNotificationResponseListener();

    return () => {
      detachMobileNotificationResponseListener();
    };
  }, []);

  useEffect(() => {
    if (!bootstrapped || !session?.token) return;
    void ensureMobileNotificationPermissions();
  }, [bootstrapped, session?.token]);

  return children;
}
