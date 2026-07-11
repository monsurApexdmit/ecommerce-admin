import { Redirect } from "expo-router"
import { useAuth } from "@/context/AuthContext"

export default function Index() {
  const { session, bootstrapped } = useAuth()
  if (!bootstrapped) return null
  return <Redirect href={session ? "/tabs" : "/auth/login"} />
}
