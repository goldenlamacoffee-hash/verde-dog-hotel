export default function AuthErrorPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="mx-auto max-w-sm space-y-4 p-8 text-center">
        <h1 className="font-serif text-2xl font-bold text-foreground">Chyba přihlášení</h1>
        <p className="text-muted-foreground">
          Přihlášení se nezdařilo. Odkaz mohl vypršet nebo být neplatný.
        </p>
        <a
          href="/auth/login"
          className="inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Zpět na přihlášení
        </a>
      </div>
    </div>
  )
}
