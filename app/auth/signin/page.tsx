"use client";

import { useState } from "react";
import { signIn, getProviders } from "next-auth/react";
import { useEffect } from "react";
import { LogIn, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Provider {
  id: string;
  name: string;
  type: string;
}

export default function SignInPage() {
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getProviders().then((p) => {
      if (p) setProviders(p);
    });
  }, []);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid credentials");
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-center">
            <LogIn className="h-5 w-5" />
            Sign in to Ollama Admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.github && (
            <>
              <Button
                className="w-full"
                onClick={() => signIn("github", { callbackUrl: "/" })}
              >
                <Github className="mr-2 h-4 w-4" />
                Sign in with GitHub
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[hsl(var(--card))] px-2 text-[hsl(var(--muted-foreground))]">
                    or
                  </span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleCredentials} className="space-y-3" aria-label="Sign in">
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && (
              <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
            )}
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
