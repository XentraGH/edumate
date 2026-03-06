import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface SearchResult {
  url: string
  name: string
  snippet: string
  host_name: string
}

// Keywords that indicate user wants web resources
const SEARCH_KEYWORDS = [
  'video', 'videos', 'watch', 'youtube', 'link', 'links', 'website', 'websites',
  'resource', 'resources', 'article', 'articles', 'tutorial', 'tutorials',
  'show me', 'find', 'search', 'look up', 'latest', 'recent', 'news',
  'online', 'page', 'blog', 'documentation', 'docs', 'reference'
]

function shouldSearch(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  return SEARCH_KEYWORDS.some(keyword => lowerQuery.includes(keyword))
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages, conversationId } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      )
    }

    let conversation
    let conversationTitle = 'New Chat'

    if (conversationId) {
      conversation = await db.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
      })
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      conversationTitle = conversation.title
    } else {
      const firstUserMessage = messages.find((m: Message) => m.role === 'user')
      if (firstUserMessage) {
        conversationTitle = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
      }
      
      conversation = await db.conversation.create({
        data: {
          title: conversationTitle,
          userId: user.id,
        },
      })
    }

    const lastUserMessage = messages.filter((m: Message) => m.role === 'user').pop()
    if (lastUserMessage) {
      await db.message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: lastUserMessage.content,
        },
      })
    }

    // EduMate Education System Prompt
    const systemPrompt: Message = {
      role: 'system',
      content: `You are EduMate, a friendly and knowledgeable AI educational assistant. You help students learn and understand various subjects.

## Subjects You Help With:
- **Languages** - You can help with any language. Just ask! (e.g., "Help me with Spanish", "Teach me Japanese")
- **Science** - Physics, Chemistry, Biology, Earth Science, Astronomy
- **History** - World History, Civilizations, Wars, Historical Figures, Events
- **Mathematics** - Algebra, Calculus, Geometry, Statistics, Arithmetic
- **Coding** - Programming languages, algorithms, debugging, best practices
- **General** - Any other educational topics

## Your Approach:
1. Be encouraging and patient
2. Explain concepts clearly with examples
3. Use analogies to make complex topics easier
4. Ask follow-up questions to check understanding
5. Provide practice problems when appropriate
6. Celebrate student progress

## Response Formatting:
Use markdown for better readability:
- **Bold** for emphasis
- *Italic* for subtle emphasis
- # Headings for sections
- ## Subheadings
- - Bullet points for lists
- 1. Numbered lists for steps
- \`code\` for inline code
- \`\`\`language for code blocks
- > Blockquotes for important notes

## When User Asks for Resources/Videos:
- Provide direct links from search results
- Describe what each resource contains
- Recommend the best ones

Always be helpful and supportive in the student's learning journey!`,
    }

    let allMessages = [systemPrompt, ...messages]
    let searchResults: SearchResult[] = []
    let showSearchResults = false

    // Only search when user explicitly asks for resources
    if (lastUserMessage && shouldSearch(lastUserMessage.content)) {
      showSearchResults = true
      try {
        const zai = await ZAI.create()
        const searchResult = await zai.functions.invoke("web_search", {
          query: lastUserMessage.content,
          num: 5
        })
        
        if (Array.isArray(searchResult) && searchResult.length > 0) {
          searchResults = searchResult
          
          const searchContext = searchResult.map((r: SearchResult, i: number) => 
            `[${i + 1}] ${r.name}\n${r.snippet}\nURL: ${r.url}`
          ).join('\n\n')
          
          const systemPromptWithSearch: Message = {
            role: 'system',
            content: `${systemPrompt.content}

## Current Date: ${new Date().toLocaleDateString()}

## Search Results Found:
${searchContext}

The user asked for resources. Present these search results helpfully:
- Describe what each link contains
- Mention the source/website
- Recommend the most relevant ones
- Use the URL format: [Title](URL)`,
          }
          
          allMessages = [systemPromptWithSearch, ...messages]
        }
      } catch (searchError) {
        console.error('Web search failed:', searchError)
      }
    }

    // Use z-ai-web-dev-sdk for chat completions
    const zai = await ZAI.create()
    
    let assistantMessage = ''
    try {
      const completion = await zai.chat.completions.create({
        model: 'openai/gpt-oss-safeguard-20b',
        messages: allMessages,
        temperature: 1,
        max_tokens: 8192,
        top_p: 1,
      })
      assistantMessage = completion.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'
    } catch (aiError) {
      console.error('AI completion error:', aiError)
      return NextResponse.json(
        { error: 'AI service error: ' + (aiError instanceof Error ? aiError.message : 'Unknown error') },
        { status: 500 }
      )
    }

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantMessage,
      },
    })

    return NextResponse.json({
      message: assistantMessage,
      conversationId: conversation.id,
      searchResults: showSearchResults && searchResults.length > 0 ? searchResults : undefined,
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
