import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const zai = await ZAI.create()
    
    const searchResult = await zai.functions.invoke("web_search", {
      query: query,
      num: 5
    })

    return NextResponse.json({
      results: searchResult
    })
  } catch (error) {
    console.error('Web search error:', error)
    return NextResponse.json(
      { error: 'Failed to perform web search: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
