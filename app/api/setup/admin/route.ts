import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json(
      { error: "Admin user already exists" },
      { status: 409 }
    );
  }

  const { username, password } = await req.json();

  if (!username || username.length < 3) {
    return NextResponse.json(
      { error: "Username must be at least 3 characters" },
      { status: 400 }
    );
  }

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const hashed = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      password: hashed,
      role: "admin",
    },
  });

  return NextResponse.json(
    { id: user.id, username: user.username },
    { status: 201 }
  );
}
