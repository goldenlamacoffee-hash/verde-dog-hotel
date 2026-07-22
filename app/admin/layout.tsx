// Bare passthrough layout for the /admin segment.
// Auth guards live in app/admin/(protected)/layout.tsx only.
// The login page lives in app/admin/(auth)/login/ and is never wrapped by a guard.
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
