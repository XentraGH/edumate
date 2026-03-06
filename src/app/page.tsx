'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { 
  Send, 
  Plus, 
  Trash2, 
  LogOut, 
  User, 
  Loader2,
  Menu,
  X,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  Globe,
  BookOpen,
  GraduationCap,
  Square,
  Copy,
  Check
} from 'lucide-react'

interface User {
  id: string
  username: string
  createdAt: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  isStreaming?: boolean
  searchResults?: SearchResult[]
}

interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages?: Message[]
}

interface SearchResult {
  url: string
  name: string
  snippet: string
  host_name: string
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

const STREAM_DELAY = 8 // ms per character - fast but smooth

// Code block component with copy button
function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  
  const language = className?.replace('language-', '') || 'code'
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between bg-zinc-800 text-zinc-400 text-xs px-4 py-2 rounded-t-lg">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-b-lg overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  )
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthMode, setIsAuthMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingRef = useRef<boolean>(false)

  useEffect(() => {
    checkAuth()
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (user) {
      fetchConversations()
    }
  }, [user])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [inputMessage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setIsAuthLoading(true)

    try {
      const res = await fetch(`/api/auth/${isAuthMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setAuthError(data.error || 'An error occurred')
        return
      }

      setUser(data.user)
      setUsername('')
      setPassword('')
    } catch {
      setAuthError('An error occurred')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setConversations([])
    setCurrentConversation(null)
    setMessages([])
  }

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    }
  }

  const selectConversation = async (conv: Conversation) => {
    try {
      const res = await fetch(`/api/conversations/${conv.id}`)
      const data = await res.json()
      setCurrentConversation(data.conversation)
      setMessages(data.conversation.messages || [])
      if (isMobile) {
        setSidebarOpen(false)
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error)
    }
  }

  const createNewConversation = async () => {
    setCurrentConversation(null)
    setMessages([])
    textareaRef.current?.focus()
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      setConversations(conversations.filter(c => c.id !== id))
      if (currentConversation?.id === id) {
        setCurrentConversation(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const stopStreaming = useCallback(() => {
    streamingRef.current = false
    setIsStreaming(false)
    setIsSending(false)
    setMessages(prev => prev.map(m => 
      m.isStreaming ? { ...m, isStreaming: false } : m
    ))
  }, [])

  const streamMessage = useCallback((fullText: string, conversationId: string, searchResults?: SearchResult[]) => {
    streamingRef.current = true
    setIsStreaming(true)

    const messageId = generateId()
    let currentIndex = 0
    
    setMessages(prev => [...prev, {
      id: messageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isStreaming: true,
      searchResults,
    }])

    const interval = setInterval(() => {
      if (!streamingRef.current) {
        clearInterval(interval)
        return
      }

      currentIndex += 2 // Add 2 chars at a time for speed
      
      if (currentIndex >= fullText.length) {
        clearInterval(interval)
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { ...m, content: fullText, isStreaming: false }
            : m
        ))
        setIsSending(false)
        setIsStreaming(false)
        return
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, content: fullText.slice(0, currentIndex) }
          : m
      ))
    }, STREAM_DELAY)

    if (!currentConversation) {
      fetchConversations()
      setCurrentConversation({ 
        id: conversationId, 
        title: 'New Chat', 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString() 
      })
    }
  }, [currentConversation])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isSending) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setIsSending(true)

    const tempUserMsg: Message = {
      id: generateId(),
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const allMessages = messages
        .filter(m => !m.isStreaming)
        .map(m => ({ role: m.role, content: m.content }))
      
      allMessages.push({ role: 'user', content: userMessage })

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          conversationId: currentConversation?.id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      streamMessage(data.message, data.conversationId, data.searchResults)
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
      setAuthError(error instanceof Error ? error.message : 'Failed to send message')
      setTimeout(() => setAuthError(''), 5000)
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isStreaming) {
        sendMessage()
      }
    }
  }

  // Message content component with markdown
  const MessageContent = ({ content, isStreaming }: { content: string; isStreaming?: boolean }) => {
    return (
      <div className={cn("markdown-content", isStreaming && "streaming-text")}>
        <ReactMarkdown
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-zinc-900 underline hover:text-zinc-600">
                {children}
              </a>
            ),
            pre: ({ children }) => {
              const codeElement = children as React.ReactElement
              const code = codeElement?.props?.children || ''
              const className = codeElement?.props?.className || ''
              return <CodeBlock className={className}>{String(code).replace(/\n$/, '')}</CodeBlock>
            },
            code: ({ className, children }) => {
              if (!className || !className.startsWith('language-')) {
                return <code className="bg-zinc-200 text-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
              }
              return <code className={className}>{children}</code>
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="w-14 h-14 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shadow-sm">
            <GraduationCap className="w-9 h-9 text-zinc-900" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
          <div className="absolute top-20 right-20 w-72 h-72 bg-zinc-800 rounded-full blur-3xl opacity-20 animate-pulse" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-zinc-700 rounded-full blur-3xl opacity-10" />
          
          <div className="relative z-10 animate-in fade-in slide-in-from-left duration-500">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300 cursor-pointer">
                <GraduationCap className="w-7 h-7 text-zinc-900" />
              </div>
              <span className="text-xl font-semibold text-white">EduMate</span>
            </div>
          </div>
          
          <div className="relative z-10 animate-in fade-in slide-in-from-bottom duration-500 delay-200">
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Your personal<br />learning companion.
            </h1>
            <p className="text-zinc-400 text-base max-w-md leading-relaxed">
              Master any subject with AI-powered tutoring. Languages, Science, History, Math, Coding, and more.
            </p>
            
            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-4 text-zinc-300 group animate-in fade-in slide-in-from-left duration-400 delay-300">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:border-zinc-600 group-hover:scale-110 transition-all duration-300 cursor-pointer">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span>Personalized learning</span>
              </div>
              <div className="flex items-center gap-4 text-zinc-300 group animate-in fade-in slide-in-from-left duration-400 delay-400">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:border-zinc-600 group-hover:scale-110 transition-all duration-300 cursor-pointer">
                  <Globe className="w-4 h-4" />
                </div>
                <span>Real-time web resources</span>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 text-zinc-600 text-sm animate-in fade-in duration-500 delay-500">
            © 2026 EduMate
          </div>
        </div>
        
        {/* Right side - Auth Form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white relative overflow-hidden">
          {/* Auth Card */}
          <div className="relative z-10 w-full max-w-sm animate-in fade-in slide-in-from-right duration-500">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
              <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shadow-lg shadow-zinc-200/20 animate-in zoom-in duration-300 cursor-pointer">
                <GraduationCap className="w-6 h-6 text-zinc-900" />
              </div>
              <span className="text-xl font-semibold text-zinc-900 animate-in fade-in slide-in-from-left duration-300 delay-100">EduMate</span>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100 hover:shadow-2xl hover:shadow-zinc-200/60 transition-shadow duration-300">
              <div className="mb-6 animate-in fade-in slide-in-from-bottom duration-400">
                <h2 className="text-2xl font-semibold text-zinc-900 mb-1">
                  {isAuthMode === 'login' ? 'Welcome back' : 'Create account'}
                </h2>
                <p className="text-zinc-500 text-sm">
                  {isAuthMode === 'login' ? 'Sign in to continue learning' : 'Start your learning journey'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom duration-400 delay-100">
                  <Label htmlFor="username" className="text-zinc-700 text-sm font-medium">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                    className="h-11 bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-900/10 rounded-xl transition-all duration-200 hover:border-zinc-300"
                  />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom duration-400 delay-200">
                  <Label htmlFor="password" className="text-zinc-700 text-sm font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="h-11 bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-900/10 rounded-xl transition-all duration-200 hover:border-zinc-300"
                  />
                </div>
                
                {authError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 animate-in fade-in zoom-in duration-300">
                    <p className="text-red-600 text-sm">{authError}</p>
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl shadow-lg shadow-zinc-900/10 transition-all duration-200 active:scale-[0.98] animate-in fade-in slide-in-from-bottom duration-400 delay-300 cursor-pointer"
                  disabled={isAuthLoading}
                >
                  {isAuthLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {isAuthMode === 'login' ? 'Continue' : 'Get Started'}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center animate-in fade-in duration-400 delay-400">
                <button
                  onClick={() => {
                    setIsAuthMode(isAuthMode === 'login' ? 'signup' : 'login')
                    setAuthError('')
                  }}
                  className="text-zinc-500 hover:text-zinc-900 text-sm transition-colors duration-200 hover:underline underline-offset-4 cursor-pointer"
                >
                  {isAuthMode === 'login' 
                    ? "Don't have an account? Sign up" 
                    : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200 cursor-pointer"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "bg-zinc-50 border-r border-zinc-200 flex flex-col transition-all duration-300 ease-out",
        isMobile 
          ? `fixed inset-y-0 left-0 z-50 w-72 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : sidebarOpen ? 'w-72' : 'w-0'
      )}>
        {sidebarOpen && (
          <>
            <div className="p-4 border-b border-zinc-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shadow-sm hover:scale-105 transition-transform duration-200">
                    <GraduationCap className="w-5 h-5 text-zinc-900" />
                  </div>
                  <span className="text-lg font-semibold text-zinc-900">
                    EduMate
                  </span>
                </div>
                {isMobile && (
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-3">
              <button 
                onClick={createNewConversation}
                className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-xl shadow-md shadow-zinc-900/10 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            <ScrollArea className="flex-1 px-3">
              <div className="space-y-0.5 pb-2">
                {conversations.map((conv, index) => (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={cn(
                      "group flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all duration-200 animate-in fade-in slide-in-from-left",
                      currentConversation?.id === conv.id
                        ? "bg-zinc-200 text-zinc-900"
                        : "text-zinc-600 hover:bg-zinc-100",
                      `delay-${index * 50}`
                    )}
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 truncate text-sm">{conv.title}</span>
                    <button
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className={cn(
                        "opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer",
                        currentConversation?.id === conv.id
                          ? "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-300"
                          : "text-zinc-400 hover:text-red-500 hover:bg-red-50"
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-zinc-400 text-sm">No conversations</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-zinc-200 p-3">
              <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer group">
                <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center shadow-md shadow-zinc-900/10 group-hover:scale-105 transition-transform duration-200">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{user.username}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-7 h-7 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-zinc-100 bg-white flex items-center px-4 gap-3 sticky top-0 z-30">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-base font-medium text-zinc-900 truncate flex-1">
            {currentConversation?.title || 'New chat'}
          </h1>
          

        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center mb-5 shadow-xl shadow-zinc-200/50 animate-in zoom-in duration-500">
                  <GraduationCap className="w-10 h-10 text-zinc-900" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 mb-2 animate-in fade-in slide-in-from-bottom duration-400 delay-100">
                  What would you like to learn?
                </h2>
                <p className="text-zinc-500 text-sm max-w-xs animate-in fade-in slide-in-from-bottom duration-400 delay-200">
                  Ask me anything and I'll help you learn!
                </p>
              </div>
            )}
            
            <div className="space-y-5">
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 animate-in fade-in slide-in-from-bottom duration-300",
                    msg.role === 'user' ? "justify-end" : "justify-start",
                    `delay-${index * 50}`
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                      <GraduationCap className="w-3.5 h-3.5 text-zinc-900" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2.5 max-w-[85%]">
                    {msg.searchResults && msg.searchResults.length > 0 && (
                      <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                          <Globe className="w-3 h-3" />
                          <span>Educational Resources</span>
                        </div>
                        {msg.searchResults.map((result, i) => (
                          <a
                            key={i}
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group p-1.5 -mx-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] text-zinc-400 mt-0.5 font-mono">[{i + 1}]</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-zinc-700 group-hover:underline truncate">
                                    {result.name}
                                  </span>
                                  <ExternalLink className="w-2.5 h-2.5 text-zinc-400 flex-shrink-0" />
                                </div>
                                <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{result.snippet}</p>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        "px-4 py-2.5 text-[15px] leading-relaxed",
                        msg.role === 'user'
                          ? "bg-zinc-900 text-white rounded-2xl rounded-br-md shadow-md shadow-zinc-900/10"
                          : "bg-zinc-100 text-zinc-800 rounded-2xl rounded-bl-md"
                      )}
                    >
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      ) : (
                        <MessageContent content={msg.content} isStreaming={msg.isStreaming} />
                      )}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-zinc-700/10">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {isSending && messages.every(m => !m.isStreaming) && (
                <div className="flex gap-3 animate-in fade-in duration-200">
                  <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <GraduationCap className="w-3.5 h-3.5 text-zinc-900" />
                  </div>
                  <div className="flex items-center gap-1 py-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-100 bg-white p-4 sticky bottom-0">
          <div className="max-w-2xl mx-auto">
            <div className="relative bg-zinc-50 border border-zinc-200 rounded-2xl shadow-sm focus-within:border-zinc-300 focus-within:shadow-md transition-all duration-200">
              <Textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                className="w-full min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent text-zinc-900 placeholder:text-zinc-400 focus:ring-0 focus:outline-none text-[15px] leading-relaxed px-4 py-3 pr-24"
                rows={1}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                {isStreaming && (
                  <button 
                    onClick={stopStreaming}
                    type="button"
                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-95 transition-all duration-200 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
                <button 
                  onClick={sendMessage}
                  type="button"
                  disabled={!inputMessage.trim() || isStreaming}
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer",
                    inputMessage.trim() && !isStreaming
                      ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/10 hover:bg-zinc-800 active:scale-95"
                      : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-zinc-400 mt-2.5">
              EduMate helps you learn. Ask about any subject!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
