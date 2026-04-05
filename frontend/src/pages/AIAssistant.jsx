import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { FiSend, FiUser, FiCpu, FiBarChart2, FiPlus, FiMessageSquare, FiTrash2, FiMenu } from 'react-icons/fi';
import { getChats, sendChatMessage, getDashboardInfo, getChatSessions, deleteChatSession } from '../api';
import toast from 'react-hot-toast';

export default function AIAssistant() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchChats(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSessions = async () => {
    try {
      const { data } = await getChatSessions();
      if (!Array.isArray(data)) throw new Error("Invalid API Response");
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load chat sessions. Please check server connection.');
      setSessions([]);
    }
  };

  const fetchChats = async (sessionId) => {
    try {
      const { data } = await getChats(sessionId);
      if (!Array.isArray(data)) throw new Error("Invalid API Response");
      const formatted = data.map(msg => ({
        ...msg,
        role: msg.role === 'model' ? 'assistant' : 'user'
      }));
      setMessages(formatted);
    } catch (error) {
      toast.error('Failed to load chat history');
      setMessages([]);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const handleDeleteSession = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteChatSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) {
        startNewChat();
      }
      toast.success('Chat deleted');
    } catch (error) {
      toast.error('Failed to delete chat');
    }
  };

  const handleSend = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const messageText = textOverride || input;
    if (!messageText.trim()) return;

    if (!textOverride) setInput('');
    setIsLoading(true);

    const tempId = Date.now();
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: messageText }]);

    try {
      const payload = { message: messageText };
      if (activeSessionId) payload.sessionId = activeSessionId;
      
      const { data } = await sendChatMessage(payload);
      
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        { id: data.id, role: 'user', content: messageText },
        { id: data.id + '_reply', role: 'assistant', content: data.reply }
      ]);
      
      // If this was a new chat, we're now in an active session
      if (!activeSessionId && data.sessionId) {
        setActiveSessionId(data.sessionId);
        await fetchSessions(); // Refresh sidebar title
      }
    } catch (error) {
      toast.error('Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportProgress = async () => {
    setIsImporting(true);
    try {
      const { data } = await getDashboardInfo();
      const pct = data.totalMarks > 0 ? Math.round((data.marksCovered / data.totalMarks)*100) : 0;
      const progressSummary = `I want to share my current study progress for analysis. I am studying for CA ${data.level}. I have completed ${data.completedChapters} out of ${data.totalChapters} chapters, covering ${data.marksCovered} marks (${pct}% of the syllabus). My confidence score is ${data.confidenceScore}%. Based on this, what should I focus on next? Please advise.`;
      
      await handleSend(null, progressSummary);
    } catch (error) {
      toast.error('Failed to import progress');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
      
      {/* History Sidebar */}
      <div className={`${sidebarOpen ? 'w-64 border-r' : 'w-0'} transition-all duration-300 ease-in-out border-[var(--border)] bg-[var(--surface-hover)] flex flex-col shrink-0 overflow-hidden`}>
        <div className="p-4">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center gap-2 justify-center py-2.5 px-4 bg-[var(--primary)] hover:bg-blue-600 text-white rounded-xl transition-colors font-medium text-sm"
          >
            <FiPlus /> New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2 mt-2">History</p>
          {sessions.length === 0 ? (
             <p className="text-sm text-[var(--text-muted)] px-2 italic">No earlier chats</p>
          ) : (
            sessions.map(s => (
              <div 
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-sm transition-colors ${
                  activeSessionId === s.id ? 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FiMessageSquare className="shrink-0" />
                  <span className="truncate">{s.title}</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 shrink-0 transition-opacity"
                  title="Delete chat"
                >
                  <FiTrash2 className="text-xs" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
             <button 
               onClick={() => setSidebarOpen(!sidebarOpen)}
               className="p-1.5 hover:bg-[var(--surface-hover)] rounded-md text-[var(--text-muted)] md:hidden block"
             >
               <FiMenu className="text-lg" />
             </button>
             <h2 className="text-lg font-bold text-[var(--primary)] flex items-center gap-2">
               <FiCpu className="text-xl hidden sm:block" /> AI Assistant
             </h2>
             <p className="text-xs text-[var(--text-muted)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-full border border-[var(--border)] hidden sm:block">Powered by Groq</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
               onClick={() => setSidebarOpen(!sidebarOpen)}
               className="p-2 hover:bg-[var(--surface-hover)] rounded-lg text-[var(--text-muted)] hidden md:block border border-transparent hover:border-[var(--border)] transition-colors"
               title="Toggle Sidebar"
             >
               <FiMenu />
             </button>
            <button 
              onClick={handleImportProgress} 
              disabled={isLoading || isImporting}
              className="btn-secondary text-sm flex items-center gap-2 py-1.5 px-3"
            >
              <FiBarChart2 className="text-lg sm:text-sm" /> 
              <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Import Study Progress'}</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center space-y-4 m-auto max-w-lg">
               <div className="w-16 h-16 rounded-3xl bg-[var(--surface-hover)] flex items-center justify-center border border-[var(--border)] text-2xl text-[var(--primary)] shadow-lg">
                 <FiCpu />
               </div>
               <div>
                 <h3 className="text-xl font-medium text-[var(--text)] mb-2">How can I help you prepare?</h3>
                 <p className="text-sm mt-2">I can simplify tough CA concepts, help you draft a solid 1.5-day exam roadmap, or explain complex calculations step-by-step.</p>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full">
                  <button onClick={() => setInput("Explain AS-2 Valuation of Inventories simply.")} className="text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--primary)] transition-colors text-sm text-[var(--text)]">
                    Explain AS-2 Valuation of Inventories simply.
                  </button>
                  <button onClick={() => setInput("How should I plan my last 1.5 days for Audit?")} className="text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--primary)] transition-colors text-sm text-[var(--text)]">
                    How should I plan my last 1.5 days for Audit?
                  </button>
               </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-full sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--primary)]'}`}>
                  {msg.role === 'user' ? <FiUser /> : <FiCpu />}
                </div>
                <div className={`py-3 px-4 rounded-2xl text-sm leading-relaxed overflow-x-auto ${
                  msg.role === 'user' 
                    ? 'bg-[var(--primary)] text-white rounded-tr-none' 
                    : 'bg-[var(--surface-hover)] text-[var(--text)] border border-[var(--border)] rounded-tl-none prose prose-invert prose-sm max-w-none'
                }`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[80%] flex-row">
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--primary)]">
                  <FiCpu />
                </div>
                <div className="py-4 px-5 rounded-2xl text-sm bg-[var(--surface-hover)] border border-[var(--border)] rounded-tl-none flex items-center gap-1.5 h-11">
                  <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <form onSubmit={(e) => handleSend(e)} className="flex items-end gap-2 relative max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(null);
                }
              }}
              placeholder="Message your CA Assistant..."
              disabled={isLoading}
              className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-2xl py-3.5 pl-4 pr-12 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] resize-none text-[var(--text)] overflow-hidden transition-all shadow-sm"
              rows="1"
              style={{ minHeight: '52px', maxHeight: '160px' }}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="absolute right-2 bottom-2 w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg disabled:shadow-none"
            >
              <FiSend className="text-sm block ml-0.5" />
            </button>
          </form>
          <div className="text-center mt-2">
             <span className="text-[10px] text-[var(--text-muted)] font-medium">Assistant can make mistakes. Verify important formulas and tax provisions.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
