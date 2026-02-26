import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  MessageSquare,
  BookOpen,
  Upload,
  Trash2,
  ChevronRight,
  Send,
  Sparkles,
  CheckCircle,
  AlertCircle,
  FileText,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from './api';

const App = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [notes, setNotes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'study'
  const [quizResponse, setQuizResponse] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchNotes(selectedSubject.id);
      fetchChatHistory(selectedSubject.id);
      setQuizResponse(null);
      setActiveTab('chat');
    }
  }, [selectedSubject]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSubjects = async () => {
    try {
      const res = await api.getSubjects();
      setSubjects(res.data.subjects);
    } catch (err) {
      setError("Failed to load subjects.");
    }
  };

  const fetchNotes = async (id) => {
    try {
      const res = await api.getSubjectNotes(id);
      setNotes(res.data.notes);
    } catch (err) {
      setError("Failed to load notes.");
    }
  };

  const fetchChatHistory = async (id) => {
    try {
      const res = await api.getChatHistory(id);
      setMessages(res.data.history.map(m => ({
        type: 'user', content: m.query, ...m
      }))); // This is a bit simplified, usually we'd interleaved

      // Map to proper display format
      const formatted = [];
      res.data.history.forEach(m => {
        formatted.push({ type: 'user', content: m.query });
        formatted.push({
          type: 'bot',
          content: m.response,
          citations: m.citations,
          confidence: m.confidence
        });
      });
      setMessages(formatted);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    try {
      await api.createSubject(newSubjectName);
      setNewSubjectName('');
      fetchSubjects();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create subject.");
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!window.confirm("Delete this subject and all its notes?")) return;
    try {
      await api.deleteSubject(id);
      if (selectedSubject?.id === id) setSelectedSubject(null);
      fetchSubjects();
    } catch (err) {
      setError("Failed to delete subject.");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedSubject) return;
    setIsUploading(true);
    try {
      await api.uploadNote(selectedSubject.id, file);
      fetchNotes(selectedSubject.id);
      setError(null);
    } catch (err) {
      setError("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSubject || isThinking) return;

    const query = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { type: 'user', content: query }]);
    setIsThinking(true);

    try {
      const res = await api.sendChatMessage(selectedSubject.id, query);
      setMessages(prev => [...prev, {
        type: 'bot',
        content: res.data.response,
        citations: res.data.citations,
        confidence: res.data.confidence
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { type: 'bot', content: "Error communicating with AI." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedSubject) return;
    setIsThinking(true);
    try {
      const res = await api.generateQuiz(selectedSubject.id);
      setQuizResponse(res.data.response);
    } catch (err) {
      setError("Failed to generate quiz.");
    } finally {
      setIsThinking(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm("Delete this file? This will remove it from the subject's context.")) return;
    try {
      await api.deleteNote(noteId);
      fetchNotes(selectedSubject.id);
    } catch (err) {
      setError("Failed to delete note.");
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm("Clear all messages for this subject?")) return;
    // Logic for clearing chat would go here, maybe we just clear local state for now
    // Since there isn't a specific 'clear' endpoint yet, but let's just clear state
    setMessages([]);
  };

  const DocumentPreviewer = ({ file, onClose }) => {
    if (!file) return null;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-overlay"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="modal-content"
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="flex items-center gap-3">
              <FileText className="text-indigo-400" size={20} />
              <span className="font-bold text-slate-200">{file.filename}</span>
            </div>
            <button className="close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <iframe
            src={file.page ? `${file.file_url}#page=${file.page}` : file.file_url}
            className="preview-iframe"
            title="Document Preview"
          ></iframe>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 glass border-r h-full flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 gradient-btn rounded-xl flex items-center justify-center p-0">
            <Sparkles size={20} />
          </div>
          <h1 className="text-xl font-bold brand-font tracking-tight">AskMyNotes</h1>
        </div>

        <form onSubmit={handleCreateSubject} className="mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="New Subject..."
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
            />
            <button type="submit" className="absolute right-2 top-1.5 p-1.5 gradient-btn rounded-lg">
              <Plus size={16} />
            </button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {subjects.map(s => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setSelectedSubject(s)}
              className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${selectedSubject?.id === s.id
                ? 'bg-indigo-600/20 border-indigo-500/30 border shadow-lg shadow-indigo-500/10'
                : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${selectedSubject?.id === s.id ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`}></div>
                <div>
                  <div className="font-semibold text-sm">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.note_count} Notes</div>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteSubject(s.id); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
          {subjects.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm italic">No subjects yet. Create one above!</div>
          )}
        </div>

        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            System Connected
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full flex flex-col relative overflow-hidden">
        {error && (
          <motion.div
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-50 glass-card bg-red-500/10 border-red-500/20 px-6 py-3 flex items-center gap-3"
          >
            <AlertCircle className="text-red-400" size={18} />
            <span className="text-sm text-red-200">{error}</span>
            <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-200">Dismiss</button>
          </motion.div>
        )}

        {selectedSubject ? (
          <>
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/5">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{selectedSubject.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                  <FileText size={14} /> {notes.length} uploaded materials
                </div>
              </div>
              <div className="flex gap-4">
                <label className="gradient-btn cursor-pointer py-2 px-4 text-sm font-medium">
                  {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  Upload Notes
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                </label>
                <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'chat' ? 'bg-indigo-600/20 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <MessageSquare size={16} /> Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('files')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'files' ? 'bg-indigo-600/20 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <FileText size={16} /> Files
                  </button>
                  <button
                    onClick={() => setActiveTab('study')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'study' ? 'bg-indigo-600/20 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <BookOpen size={16} /> Study Mode
                  </button>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-12">
              <AnimatePresence mode="wait">
                {activeTab === 'chat' ? (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="max-w-4xl mx-auto space-y-8 pb-32"
                  >
                    {messages.length === 0 && (
                      <div className="text-center py-20">
                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                          <MessageSquare className="text-indigo-400" size={28} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Start your interaction</h3>
                        <p className="text-slate-500 max-w-sm mx-auto">Ask questions about your notes, and the AI will provide answers with citations.</p>
                      </div>
                    )}
                    {messages.map((m, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: m.type === 'user' ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] p-6 rounded-3xl ${m.type === 'user'
                          ? 'bg-indigo-600/80 text-white rounded-tr-none shadow-lg shadow-indigo-500/10'
                          : 'glass-card rounded-tl-none'
                          }`}>
                          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>

                          {m.citations && m.citations.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-1.5">
                                <CheckCircle size={10} className="text-indigo-400" /> Source Citations
                              </div>
                              <div className="space-y-2">
                                {m.citations.map((c, ci) => (
                                  <div
                                    key={ci}
                                    onClick={() => {
                                      const noteObj = notes.find(n => n.filename === c.filename);
                                      if (noteObj) {
                                        setPreviewFile({ ...noteObj, page: c.page });
                                      }
                                    }}
                                    className="text-xs text-slate-400 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 hover:border-indigo-500/30 transition-all group"
                                  >
                                    <span className="text-indigo-300 font-semibold group-hover:text-indigo-200">{c.filename}</span> (Pg {c.page})
                                    <div className="italic text-[11px] mt-1 line-clamp-1 opacity-60">"...{c.snippet}..."</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {m.confidence > 0 && (
                            <div className="mt-3 text-[10px] text-right text-slate-500 font-medium">
                              AI Confidence: <span className={
                                m.confidence >= 75 ? "text-emerald-400" :
                                  m.confidence >= 60 ? "text-amber-400" :
                                    m.confidence >= 30 ? "text-orange-400" : "text-red-400"
                              }>
                                {m.confidence >= 75 ? "High" :
                                  m.confidence >= 60 ? "Medium" :
                                    m.confidence >= 30 ? "Low" : "Not Found"}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {isThinking && activeTab === 'chat' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                      >
                        <div className="glass-card rounded-3xl rounded-tl-none p-4 flex items-center gap-3">
                          <div className="flex gap-1.5">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                          </div>
                          <span className="text-xs font-medium text-indigo-300">Processing Notes...</span>
                        </div>
                      </motion.div>
                    )}
                    <div ref={chatEndRef} />
                  </motion.div>
                ) : activeTab === 'files' ? (
                  <motion.div
                    key="files"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="max-w-4xl mx-auto space-y-6"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Uploaded Materials</h3>
                      <div className="text-xs text-slate-500">{notes.length} Files Total</div>
                    </div>
                    {notes.map(n => (
                      <div key={n.id} className="glass-card p-6 flex items-center justify-between border-white/5 hover:border-white/10 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-indigo-400">
                            <FileText size={24} />
                          </div>
                          <div>
                            <div className="font-semibold">{n.filename}</div>
                            <div className="text-xs text-slate-500">Uploaded on {new Date(n.uploaded_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setPreviewFile(n)}
                            className="p-2.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all"
                            title="View File"
                          >
                            <Send size={18} className="-rotate-45" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            className="p-2.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                            title="Delete File"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <div className="text-center py-20 glass-card">
                        <Upload className="mx-auto text-slate-600 mb-4" size={48} />
                        <div className="text-slate-400">No materials uploaded for this subject.</div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="study"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="max-w-3xl mx-auto"
                  >
                    <div className="glass-card p-10 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                        <BookOpen size={200} />
                      </div>
                      <h3 className="text-2xl font-bold mb-4">Brain Quiz Generator</h3>
                      <p className="text-slate-400 mb-8 max-w-md mx-auto">
                        Generate exactly 5 MCQs and 3 Short-Answer questions based on everything you've uploaded for this subject.
                      </p>

                      {!quizResponse ? (
                        <button
                          onClick={handleGenerateQuiz}
                          disabled={isThinking}
                          className="mx-auto gradient-btn py-4 px-10 text-lg rounded-2xl shadow-xl shadow-indigo-600/20"
                        >
                          {isThinking ? (
                            <>
                              <Loader2 className="animate-spin" /> Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles /> Generate Quiz Now
                            </>
                          )}
                        </button>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-left bg-black/20 p-8 rounded-3xl border border-white/5 backdrop-blur-sm"
                        >
                          <div className="flex justify-between items-center mb-6">
                            <div className="badge bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Generated Result</div>
                            <button onClick={() => setQuizResponse(null)} className="text-sm text-slate-500 hover:text-slate-300">Clear & Retake</button>
                          </div>
                          <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {quizResponse}
                          </div>
                        </motion.div>
                      )}

                      {!notes.length && (
                        <div className="mt-8 text-amber-400 text-sm flex items-center justify-center gap-2">
                          <AlertCircle size={16} /> Upload notes first to enable Study Mode.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat Input */}
            {activeTab === 'chat' && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8">
                <form
                  onSubmit={handleSendMessage}
                  className="glass-card p-2 flex items-center gap-2 shadow-2xl"
                >
                  <input
                    type="text"
                    placeholder="Ask about CCN.pdf..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isThinking || !notes.length}
                    className="flex-1 bg-transparent px-6 py-3 focus:outline-none text-sm placeholder:text-slate-600"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isThinking || !notes.length}
                    className="w-12 h-12 gradient-btn rounded-2xl flex items-center justify-center p-0"
                  >
                    {isThinking ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </form>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
            {/* Background blobs for depth */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-xl z-10"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-24 h-24 bg-indigo-600/10 rounded-[3rem] flex items-center justify-center mx-auto mb-10 border border-indigo-500/20 shadow-inner"
              >
                <Sparkles className="text-indigo-400" size={40} />
              </motion.div>
              <h2 className="text-5xl font-extrabold tracking-tight mb-6 gradient-text">Elevate Your Studies</h2>
              <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-md mx-auto">
                Upload your notes and let AI transform them into an interactive study companion. Ask questions, generate quizzes, and master your subjects.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-6 text-left border-white/10 hover:border-indigo-500/30 transition-all">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4">
                    <MessageSquare className="text-indigo-400" size={20} />
                  </div>
                  <div className="text-base font-bold mb-1">Contextual Chat</div>
                  <div className="text-xs text-slate-500">Query your notes with AI that understands context and provides citations.</div>
                </div>
                <div className="glass-card p-6 text-left border-white/10 hover:border-purple-500/30 transition-all">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
                    <BookOpen className="text-purple-400" size={20} />
                  </div>
                  <div className="text-base font-bold mb-1">AI Assessments</div>
                  <div className="text-xs text-slate-500">Instant quiz generation to test your knowledge and prepare for exams.</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
      <AnimatePresence>
        {previewFile && <DocumentPreviewer file={previewFile} onClose={() => setPreviewFile(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default App;
