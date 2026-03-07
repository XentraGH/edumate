import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { createSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 30 characters' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if database is connected
    try {
      await db.$connect()
    } catch (connectError) {
      console.error('Database connection error:', connectError)
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      )
    }

    const existingUser = await db.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = hashPassword(password)

    const user = await db.user.create({
      data: {
        username,
        password: hashedPassword,
      },
      select: { id: true, username: true, createdAt: true },
    })

    await createSession(user)

    return NextResponse.json({ user })
  } catch (error: any) {
    console.error('Signup error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })
    
    // Handle specific Prisma errors
    if (error?.code === 'P1001') {
      return NextResponse.json(
        { error: 'Cannot reach database server. Please check your connection.' },
        { status: 503 }
      )
    }
    if (error?.code === 'P1002') {
      return NextResponse.json(
        { error: 'Database connection timed out. Please try again.' },
        { status: 503 }
      )
    }
    if (error?.code === 'P2021') {
      return NextResponse.json(
        { error: 'Database tables not found. Please run database migrations.' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error?.message : undefined },
      { status: 500 }
    )
  }
}
