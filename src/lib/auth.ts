import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { db } from './db'

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'apenai-secret-key-change-in-production'
)

export interface SessionUser {
  id: string
  username: string
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY)

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return {
      id: payload.userId as string,
      username: payload.username as string,
    }
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session) return null

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true, createdAt: true },
  })

  return user
}
