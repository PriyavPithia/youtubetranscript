"use client"

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LoadingDots from '@/components/LoadingDots'
import { API_BASE_URL } from '@/config/api'

// Define the Step type
type Step = {
  name: string;
  status: 'upcoming' | 'current' | 'completed';
};

interface TranscriptEntry {
  id: number;
  text: string;
  start: number;
  duration: number;
}

interface SummaryEntry {
  text: string;
  ref_id: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSource {
  text: string;
  start: number;
  duration: number;
}

function Page() {
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [summary, setSummary] = useState<SummaryEntry[]>([])
  const [notes, setNotes] = useState<string>("")
  const [transcriptLoading, setTranscriptLoading] = useState<boolean>(false)
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false)
  const [notesLoading, setNotesLoading] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [summarySteps, setSummarySteps] = useState<Step[]>([
    { name: 'Prepare', status: 'upcoming' },
    { name: 'Chunk', status: 'upcoming' },
    { name: 'Summarize', status: 'upcoming' },
    { name: 'Finalize', status: 'upcoming' }
  ]);
  const [notesSteps, setNotesSteps] = useState<Step[]>([
    { name: 'Prepare', status: 'upcoming' },
    { name: 'Generate', status: 'upcoming' },
    { name: 'Finalize', status: 'upcoming' }
  ]);
  const transcriptRef = useRef<HTMLDivElement>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSources, setChatSources] = useState<ChatSource[]>([])
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [isAiResponding, setIsAiResponding] = useState(false)
  const [highlightedEntryId, setHighlightedEntryId] = useState<number | null>(null);
  const [isTranscriptProcessed, setIsTranscriptProcessed] = useState(false);

  useEffect(() => {
    if (chatContainerRef.current) {
      const scrollArea = chatContainerRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [chatMessages]);

  const handleTranscriptSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTranscriptLoading(true)
    setError("")
    setTranscript([])
    setSummary([])
    setProgress(0)
    setStatus("")

    const eventSource = new EventSource(`${API_BASE_URL}/api/transcript?video_url=${encodeURIComponent(videoUrl)}`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.error) {
        setError(data.error)
        setTranscriptLoading(false)
        eventSource.close()
      } else if (data.progress) {
        setProgress(data.progress)
        setStatus(data.status)
        if (data.progress === 100) {
          setTranscript(data.transcript)
          setTranscriptLoading(false)
          setIsTranscriptProcessed(true)  // Add this line
          eventSource.close()
        }
      }
    }

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      setError("An error occurred while processing the video. Please try again later or check the server logs for more information.")
      setTranscriptLoading(false)
      eventSource.close()
    }
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleSummarySubmit = async () => {
    setSummaryLoading(true)
    setError("")
    setSummary([])
    setProgress(0)
    setStatus("")

    try {
      const response = await fetch(`${API_BASE_URL}/api/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("Failed to get response reader")
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const messages = new TextDecoder().decode(value).split('\n\n')
        for (const message of messages) {
          if (message.startsWith('data: ')) {
            const data = JSON.parse(message.slice(6))
            if (data.error) {
              setError(data.error)
              setSummaryLoading(false)
            } else if (data.progress) {
              setProgress(data.progress)
              setStatus(data.status)
              updateSummarySteps(data.status)
              if (data.progress === 100) {
                setSummary(data.summary)
                setSummaryLoading(false)
                // Add summary to chat messages
                setChatMessages(prev => [...prev, { role: 'assistant', content: `Summary:\n\n${data.summary[0].text}` }])
              }
            }
          }
        }
      }
    } catch (error) {
      setError("An error occurred while summarizing the transcript")
      setSummaryLoading(false)
    }
  }

  const handleMakeNotes = async () => {
    setNotesLoading(true)
    setError("")
    setNotes("")
    setProgress(0)
    setStatus("")

    try {
      const response = await fetch(`${API_BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("Failed to get response reader")
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const messages = new TextDecoder().decode(value).split('\n\n')
        for (const message of messages) {
          if (message.startsWith('data: ')) {
            const data = JSON.parse(message.slice(6))
            if (data.error) {
              setError(data.error)
              setNotesLoading(false)
            } else if (data.progress) {
              setProgress(data.progress)
              setStatus(data.status)
              updateNotesSteps(data.status)
              if (data.progress === 100 && data.notes) {
                const notesText = data.notes
                setNotes(notesText)
                setNotesLoading(false)
                // Add notes to chat messages
                setChatMessages(prev => [...prev, { 
                  role: 'assistant', 
                  content: `Study Notes:\n\n${notesText}`
                }])
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in handleMakeNotes:', error)
      setError("An error occurred while generating notes")
      setNotesLoading(false)
    }
  }

  const updateSummarySteps = (status: string) => {
    setSummarySteps(steps => {
      const newSteps = [...steps];
      if (status.includes("Preparing")) {
        newSteps[0].status = 'current';
      } else if (status.includes("chunk")) {
        newSteps[0].status = 'completed';
        newSteps[1].status = 'current';
        newSteps[2].status = 'current';
      } else if (status.includes("Finalizing")) {
        newSteps[0].status = 'completed';
        newSteps[1].status = 'completed';
        newSteps[2].status = 'completed';
        newSteps[3].status = 'current';
      }
      return newSteps;
    });
  }

  const updateNotesSteps = (status: string) => {
    setNotesSteps(steps => {
      const newSteps = [...steps];
      if (status.includes("Preparing")) {
        newSteps[0].status = 'current';
      } else if (status.includes("Finalizing")) {
        newSteps[0].status = 'completed';
        newSteps[1].status = 'completed';
        newSteps[2].status = 'current';
      } else {
        newSteps[0].status = 'completed';
        newSteps[1].status = 'current';
      }
      return newSteps;
    });
  }

  const scrollToNearestTranscriptEntry = (refNumber: number) => {
    if (transcriptRef.current) {
      const transcriptEntries = Array.from(transcriptRef.current.querySelectorAll('.transcript-entry'));
      let closestEntry = transcriptEntries[0];
      let smallestDifference = Infinity;

      for (const entry of transcriptEntries) {
        const entryId = parseInt((entry as HTMLElement).dataset.id || '0');
        const difference = Math.abs(entryId - (refNumber - 1)); // Subtract 1 here
        if (difference < smallestDifference) {
          smallestDifference = difference;
          closestEntry = entry;
        }
      }

      if (closestEntry) {
        closestEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedEntryId(parseInt((closestEntry as HTMLElement).dataset.id || '0'));

        // Remove the timeout that was clearing the highlight
        // setTimeout(() => {
        //   setHighlightedEntryId(null);
        // }, 2000);
      }
    }
  };

  const renderChatMessage = (content: string) => {
    return (
      <div className="markdown-content space-y-4 text-black">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-4 text-black block" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-6 mb-3 text-black block" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-4 mb-2 text-black block" {...props} />,
            p: ({node, children, ...props}) => {
              const text = Array.isArray(children) ? children.join('') : children?.toString() || '';
              return <p className="text-base text-black mb-4" {...props}>{processTextWithReferences(text)}</p>;
            },
            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 text-black text-base" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 text-black text-base" {...props} />,
            li: ({node, children, ...props}) => {
              const childrenArray = React.Children.toArray(children);
              return (
                <li className="mb-2 text-base text-black flex items-start" {...props}>
                  <span className="mr-2">•</span>
                  <span className="flex-1">
                    {childrenArray.map((child, index) => 
                      typeof child === 'string' ? processTextWithReferences(child) : child
                    )}
                  </span>
                </li>
              );
            },
            strong: ({node, ...props}) => <strong className="text-base font-bold text-black" {...props} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !isTranscriptProcessed) return

    const userMessage: ChatMessage = { role: 'user', content: chatInput }
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsAiResponding(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: chatInput }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }

      const data = await response.json()
      console.log("Received data from server:", data)  // Add this line for debugging

      if (data.error) {
        throw new Error(data.error)
      }

      const assistantMessage: ChatMessage = { role: 'assistant', content: data.answer }
      setChatMessages(prev => [...prev, assistantMessage])
      
      // Log the top chunks for debugging
      console.log("Top chunks used for this response:", data.top_chunks)
    } catch (error: unknown) {
      console.error('Error in chat:', error)
      if (error instanceof Error) {
        setError("An error occurred while processing your message: " + error.message)
      } else {
        setError("An unknown error occurred while processing your message")
      }
    } finally {
      setIsAiResponding(false)
    }
  }

  const clearHighlight = () => {
    setHighlightedEntryId(null);
  };

  const processTextWithReferences = (text: string) => {
    const parts = text.split(/(\[\d+(?:,\s*\d+)*\])/)
    return parts.map((part, index) => {
      const match = part.match(/\[(\d+(?:,\s*\d+)*)\]/)
      if (match) {
        const refNumbers = match[1].split(',').map(num => num.trim())
        return (
          <React.Fragment key={index}>
            {refNumbers.map((refNumber, i) => (
              <button
                key={i}
                className="inline-flex items-center justify-center font-bold text-white bg-[#3180DB] bg-opacity-60 rounded-full w-[26px] h-[26px] text-xs cursor-pointer ml-1 hover:bg-opacity-100"
                onClick={() => scrollToNearestTranscriptEntry(parseInt(refNumber))}
              >
                {refNumber}
              </button>
            ))}
          </React.Fragment>
        )
      }
      return part
    })
  }

  return (
    <div className="flex h-screen">
      <div className="w-[40%] flex flex-col bg-white overflow-hidden"> {/* Changed bg-neutral-100 to bg-white */}
        <div className="p-6 pb-4 pr-12"> {/* Reduced padding */}
          <div className="flex items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 mr-4">TRANSCRIPT</h2>
            <form onSubmit={handleTranscriptSubmit} className="flex-grow">
              <div className="flex items-center bg-white rounded-[15px] overflow-hidden border border-gray-300">
                <Input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Enter YouTube Video URL"
                  className="flex-grow h-10 text-sm focus:ring-0 focus:outline-none border-none rounded-none text-black" 
                />
                <Button 
                  type="submit" 
                  disabled={transcriptLoading}
                  className="h-10 px-4 text-sm focus:ring-0 focus:outline-none bg-[#3180DB] hover:bg-[#2670CB] text-white rounded-none" 
                >
                  {transcriptLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {transcriptLoading ? 'Processing...' : 'Transcribe'}
                </Button>
              </div>
            </form>
          </div>
        </div>
        
        <ScrollArea className="flex-grow px-8 custom-scrollbar" ref={transcriptRef}>
          <div className="pr-8 pl-2"> {/* Added pl-2 for left padding */}
            <AnimatePresence>
              {transcript.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card 
                    className={`mb-5 transcript-entry hover:bg-gray-50 transition-colors duration-200 rounded-[15px] border border-gray-200 shadow-[0_0_8px_rgba(0,0,0,0.05)] ${
                      entry.id === highlightedEntryId ? 'bg-blue-50' : 'bg-white'
                    }`} 
                    data-id={entry.id}
                  >
                    <CardContent className="p-4 flex items-start">
                      <span className="font-bold text-white bg-[#3180DB] bg-opacity-60 rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0 text-base">
                        {entry.id + 1}
                      </span>
                      <span className="text-sm text-black flex-grow pr-4">
                        {processTextWithReferences(entry.text)}
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>

      <div className="w-[60%] flex flex-col p-8 bg-neutral-100"> {/* Added bg-neutral-100 */}
        <h2 className="text-2xl font-bold mb-4 text-black text-center">CHATBOT</h2>
        
        {/* Chat messages */}
        <ScrollArea className="flex-grow mb-6 pr-4" ref={chatContainerRef}>
          <div className="pr-4">
            <AnimatePresence>
              {chatMessages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`} 
                >
                  <span className={`inline-block ${
                    message.role === 'user' 
                      ? 'p-3 bg-blue-100' 
                      : 'p-5 border border-gray-200 bg-white'
                  } rounded-[15px] text-black text-base whitespace-normal`}>
                    {message.role === 'user' 
                      ? message.content 
                      : renderChatMessage(message.content)}
                  </span>
                </motion.div>
              ))}
              {isAiResponding && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="mb-4 text-left"
                >
                  <span className="inline-block p-3 rounded-[15px] bg-gray-50 text-black text-sm">
                    <LoadingDots />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Summarize and Make Notes buttons */}
        <div className="mb-4 flex space-x-3">
          <Button 
            onClick={handleSummarySubmit} 
            disabled={summaryLoading || notesLoading}
            className="h-10 px-4 text-sm focus:ring-0 focus:outline-none bg-[#3180DB] hover:bg-[#2670CB] text-white rounded-[8px]"
          >
            {summaryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {summaryLoading ? 'Summarizing...' : 'Summarize'}
          </Button>
          <Button 
            onClick={handleMakeNotes} 
            disabled={summaryLoading || notesLoading}
            className="h-10 px-4 text-sm focus:ring-0 focus:outline-none bg-[#3180DB] hover:bg-[#2670CB] text-white rounded-[8px] font-bold"
          >
            {notesLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {notesLoading ? 'Generating Study Notes...' : 'Make Study Notes'}
          </Button>
        </div>

        {/* Chat input form */}
        <form onSubmit={handleChatSubmit} className="flex">
          <div className="flex flex-grow items-center bg-white rounded-[15px] overflow-hidden border border-gray-300">
            <Input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isTranscriptProcessed ? "Ask a question about the transcript..." : "Process a transcript first"}
              className="flex-grow h-12 text-md focus:ring-0 focus:outline-none border-none rounded-none pl-4 text-black"
              disabled={!isTranscriptProcessed}
            />
            <Button 
              type="submit"
              className="h-12 px-6 text-md focus:ring-0 focus:outline-none bg-[#3180DB] hover:bg-[#2670CB] text-white rounded-none"
              disabled={!isTranscriptProcessed}
            >
              Send
            </Button>
          </div>
        </form>

        {/* Add this above the chat input form */}
        <div className="mb-2 text-sm">
          {isTranscriptProcessed ? (
            <span className="text-green-600">Transcript processed. You can now chat!</span>
          ) : (
            <span className="text-red-600">Please process a transcript before chatting.</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default Page
