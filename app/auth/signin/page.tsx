"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { useTranslations } from "next-intl";

export default function SignInPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        if (!data.hasAdmin) router.push("/setup");
      })
      .catch(() => {});
  }, [router]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(t("invalidCredentials"));
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[hsl(var(--background))] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08)_0%,transparent_60%)]">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-md">
          <Image src="/logo.jpeg" alt="Ollama Admin" width={56} height={56} priority />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>
        </div>
      </div>

      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="pt-6">
          <form onSubmit={handleCredentials} className="space-y-4" aria-label={t("title")}>
            <Input
              label={t("username")}
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <div className="relative">
              <Input
                label={t("password")}
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-[hsl(var(--destructive))]">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={loading} size="lg">
              {t("signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
