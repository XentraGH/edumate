import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
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

    const user = await db.user.findUnique({
      where: { username },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    const isValid = verifyPassword(password, user.password)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    await createSession({ id: user.id, username: user.username })

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
    })
  } catch (error: any) {
    console.error('Login error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
