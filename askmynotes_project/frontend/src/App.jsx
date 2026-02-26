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
  X,
  Mic,
  Activity,
  Volume2,
  VolumeX
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
  const [quizStep, setQuizStep] = useState('landing'); // landing, quiz, results
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [mcqCount, setMcqCount] = useState(5);
  const [shortCount, setShortCount] = useState(3);
  const [chatSessions, setChatSessions] = useState([]); // New state for multi-chat sessions

  const [sessionId, setSessionId] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const recognitionRef = useRef(null);

  const [authState, setAuthState] = useState('loading'); // loading, unauthenticated, authenticated
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // login, register
  const [authError, setAuthError] = useState(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const chatEndRef = useRef(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const res = await api.checkAuth();
      if (res.data.authenticated) {
        setAuthState('authenticated');
        setCurrentUser(res.data.user);
        fetchSubjects();
      } else {
        setAuthState('unauthenticated');
      }
    } catch {
      setAuthState('unauthenticated');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (authMode === 'login') {
        const res = await api.login(credentials.username, credentials.password);
        setCurrentUser(res.data.user);
      } else {
        const res = await api.register(credentials.username, credentials.password);
        setCurrentUser(res.data.user);
      }
      setAuthState('authenticated');
      fetchSubjects();
    } catch (err) {
      setAuthError(err.response?.data?.error || "Authentication failed");
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setAuthState('unauthenticated');
      setCurrentUser(null);
      setSubjects([]);
      setSelectedSubject(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  useEffect(() => {
    if (authState === 'authenticated') {
      fetchSubjects();
    }
  }, [authState]);

  useEffect(() => {
    if (selectedSubject) {
      fetchNotes(selectedSubject.id);
      fetchChatSessions(selectedSubject.id);

      // We don't fetch chat history immediately anymore, we wait for a session to be selected.
      // But if there are no existing sessions, we'll just prep a brand new session ID.
      // fetchChatSessions handles setting the default/initial session ID.

      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setQuizResponse(null);
      setQuizStep('landing');
      setCurrentQuestionIdx(0);
      setUserAnswers({});
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

  const fetchChatSessions = async (id) => {
    try {
      const res = await api.getChatSessions(id);
      setChatSessions(res.data.sessions);

      // If there are existing sessions, auto-select the most recent one to show its history
      if (res.data.sessions.length > 0) {
        const latestSessionId = res.data.sessions[0].id;
        setSessionId(latestSessionId);
        fetchChatHistory(id, latestSessionId);
      } else {
        // No sessions exist yet, initialize a blank slate
        setSessionId(Math.random().toString(36).substring(2, 15)); // Brand new unique session
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to fetch chat sessions:", err);
    }
  };

  const handleNewChat = () => {
    if (!selectedSubject) return;
    setSessionId(Math.random().toString(36).substring(2, 15));
    setMessages([]);
    setActiveTab('chat');
  };

  const handleDeleteChatSession = async (e, sessionIdToDelete) => {
    e.stopPropagation();
    if (!selectedSubject || !window.confirm("Delete this chat session permanently?")) return;

    try {
      await api.deleteChatSession(selectedSubject.id, sessionIdToDelete);
      // Refresh list
      fetchChatSessions(selectedSubject.id);
    } catch (err) {
      setError("Failed to delete chat session.");
    }
  };

  const fetchChatHistory = async (subjectId, sessionIdToFetch) => {
    try {
      const res = await api.getChatHistory(subjectId, sessionIdToFetch);
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

  const speakText = (text, confidence) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Clean text for speech
    const cleanText = text.replace(/[*#_]/g, '');
    let fullSpeech = cleanText;

    if (confidence !== undefined && confidence !== null && confidence > 0) {
      fullSpeech += `. Confidence level is ${Math.round(confidence)} percent.`;
    }

    const utterance = new SpeechSynthesisUtterance(fullSpeech);
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech Recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(transcript);

      const lowerTranscript = transcript.toLowerCase();
      if (lowerTranscript.includes("start the quiz") || lowerTranscript.includes("start quiz")) {
        setActiveTab('study');
        handleGenerateQuiz();
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSubject || isThinking) return;

    const query = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { type: 'user', content: query }]);
    setIsThinking(true);

    try {
      const res = await api.sendChatMessage(selectedSubject.id, query, sessionId);
      setMessages(prev => [...prev, {
        type: 'bot',
        content: res.data.response,
        citations: res.data.citations,
        confidence: res.data.confidence
      }]);
      speakText(res.data.response, res.data.confidence);
    } catch (err) {
      setMessages(prev => [...prev, { type: 'bot', content: "Error communicating with AI." }]);
    } finally {
      setIsThinking(false);
      // Refresh the chat sessions in the sidebar so the latest message shows as the title
      if (selectedSubject) {
        fetchChatSessions(selectedSubject.id);
      }
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedSubject) return;
    setIsThinking(true);
    try {
      const res = await api.generateQuiz(selectedSubject.id, mcqCount, shortCount);
      setQuizResponse(res.data);
      setQuizStep('quiz');
      setCurrentQuestionIdx(0);
      setUserAnswers({});
    } catch (err) {
      setError("Failed to generate quiz.");
    } finally {
      setIsThinking(false);
    }
  };

  const handleClearQuiz = () => {
    setQuizResponse(null);
    setQuizStep('landing');
    setCurrentQuestionIdx(0);
    setUserAnswers({});
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

  const InteractiveQuiz = ({ quiz }) => {
    if (!quiz || !quiz.questions) return null;
    const questions = quiz.questions;
    const currentQ = questions[currentQuestionIdx];
    const isFinished = currentQuestionIdx === questions.length - 1;

    const handleAnswer = (val) => {
      setUserAnswers(prev => ({ ...prev, [currentQ.id]: val }));
    };

    const nextQuestion = () => {
      if (!isFinished) setCurrentQuestionIdx(prev => prev + 1);
      else setQuizStep('results');
    };

    if (quizStep === 'results') {
      const totalMCQs = questions.filter(q => q.type === 'mcq').length;
      const score = questions.filter(q => q.type === 'mcq' && userAnswers[q.id] === q.answer).length;

      return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="glass-card p-10 text-center border-indigo-500/20">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="text-indigo-400" size={32} />
            </div>
            <h3 className="text-3xl font-bold mb-2">Quiz Complete!</h3>
            <p className="text-slate-400 mb-8">Great job reviewing your notes.</p>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-10">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-2xl font-bold text-indigo-400">{score}/{totalMCQs}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">MCQ Score</div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-2xl font-bold text-purple-400">{Math.round((score / totalMCQs) * 100)}%</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Accuracy</div>
              </div>
            </div>

            <button onClick={handleClearQuiz} className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-sm font-bold">
              Retake Different Quiz
            </button>
          </div>

          <div className="space-y-4 pt-10">
            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">Review Your Answers</h4>
            {questions.map((q, idx) => (
              <div key={q.id} className="glass-card p-6 border-white/5">
                <div className="text-[10px] text-slate-500 mb-1">Question {idx + 1} • {q.type.toUpperCase()}</div>
                <div className="font-medium mb-4">{q.question}</div>
                <div className="flex flex-col md:flex-row gap-4 text-xs">
                  <div className="flex-1">
                    <span className="text-slate-500 block mb-1">Your Choice:</span>
                    <span className={q.type === 'mcq' ? (userAnswers[q.id] === q.answer ? 'text-emerald-400' : 'text-red-400') : 'text-slate-300 font-medium'}>
                      {userAnswers[q.id] || "Empty"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <span className="text-slate-500 block mb-1">{q.type === 'mcq' ? 'Correct Option:' : 'Model Answer:'}</span>
                    <span className="text-indigo-300 font-medium">{q.answer}</span>
                  </div>
                </div>
                {q.type === 'mcq' && q.explanation && (
                  <div className="mt-4 pt-4 border-t border-white/5 text-[11px] text-slate-400 leading-relaxed">
                    <span className="text-indigo-400/80 font-bold uppercase tracking-tighter mr-2">Context & Explanation:</span>
                    <span className="opacity-80 italic">{q.explanation}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={currentQuestionIdx}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="max-w-2xl mx-auto"
      >
        <div className="mb-8 flex justify-between items-center text-xs text-slate-500 uppercase font-bold tracking-widest">
          <span>Question {currentQuestionIdx + 1} of {questions.length}</span>
          <span className="text-indigo-400">{Math.round(((currentQuestionIdx) / questions.length) * 100)}% Progress</span>
        </div>

        <div className="glass-card p-8 border-indigo-500/10 mb-8">
          <h3 className="text-xl font-medium leading-relaxed mb-10">{currentQ.question}</h3>

          {currentQ.type === 'mcq' ? (
            <div className="grid gap-3">
              {currentQ.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  className={`p-4 rounded-xl text-left border transition-all text-sm font-medium flex items-center gap-4 ${userAnswers[currentQ.id] === opt
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                    : 'bg-white/5 border-white/5 hover:border-white/10 text-slate-400 hover:text-white'
                    }`}
                >
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] ${userAnswers[currentQ.id] === opt ? 'bg-indigo-500 border-indigo-400' : 'border-slate-700'
                    }`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              className="w-full bg-black/30 border border-white/5 rounded-2xl p-6 text-sm focus:outline-none focus:border-indigo-500/30 transition-all min-height-[150px]"
              placeholder="Type your explanation here..."
              value={userAnswers[currentQ.id] || ""}
              onChange={(e) => handleAnswer(e.target.value)}
            />
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={nextQuestion}
            disabled={!userAnswers[currentQ.id]}
            className="gradient-btn px-10 py-3 rounded-xl disabled:opacity-50 flex items-center gap-2"
          >
            {isFinished ? "Finish Quiz" : "Next Question"} <Send size={16} />
          </button>
        </div>
      </motion.div>
    );
  };

  if (authState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-background overflow-hidden relative">
        {/* Animated Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] pointer-events-none"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 max-w-md w-full border-white/10 relative z-10"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 gradient-btn rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20">
              <Sparkles size={32} />
            </div>
            <h1 className="text-3xl font-bold mb-2">AskMyNotes</h1>
            <p className="text-slate-400 text-sm">Sign in to access your intelligent study space.</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Username</label>
              <input
                type="text"
                autoComplete="username"
                value={credentials.username}
                onChange={e => setCredentials({ ...credentials, username: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-medium placeholder:text-slate-600"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Password</label>
              <input
                type="password"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                value={credentials.password}
                onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-medium placeholder:text-slate-600"
                placeholder="Enter your password"
                required
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs font-medium">
                <AlertCircle size={14} />
                {authError}
              </div>
            )}

            <button type="submit" className="w-full gradient-btn py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-4">
              {authMode === 'login' ? 'Sign In' : 'Create Account'} <ChevronRight size={18} />
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign In"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 glass border-r h-full flex flex-col p-6">
        <div
          onClick={() => setSelectedSubject(null)}
          className="flex items-center gap-3 mb-10 cursor-pointer hover:opacity-80 transition-opacity"
          title="Return to Home"
        >
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
            <div key={s.id} className="space-y-2">
              <motion.div
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
                  className="w-8 h-8 flex items-center justify-center bg-transparent hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all border border-transparent hover:border-red-500/20 hover:shadow-sm"
                  title="Delete Subject"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>

              {/* Nested Chat Sessions UI (ChatGPT style) when subject is active */}
              {selectedSubject?.id === s.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="ml-6 pl-3 border-l-2 border-white/10 space-y-2 mb-4"
                >
                  <button
                    onClick={handleNewChat}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-all border border-indigo-500/20"
                  >
                    <Plus size={14} /> New Chat
                  </button>

                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {chatSessions.map((session, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSessionId(session.id);
                          fetchChatHistory(s.id, session.id);
                          setActiveTab('chat');
                        }}
                        className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${sessionId === session.id ? 'bg-white/10 text-white font-medium shadow-sm' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <MessageSquare size={12} className={sessionId === session.id ? 'text-indigo-400' : 'opacity-50'} />
                          <span className="truncate">{session.title}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteChatSession(e, session.id)}
                          className={`flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all rounded hover:bg-red-500/20 md:hidden ${sessionId === session.id ? 'opacity-100 text-slate-400' : ''}`}
                          title="Delete Chat"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {chatSessions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-600 italic">No chat history.</div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          ))}
          {subjects.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm italic">No subjects yet. Create one above!</div>
          )}
        </div>

        {/* User Profile / Logout */}
        <div className="pt-6 border-t border-white/5 flex flex-col gap-4 mt-auto">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm">
              {currentUser?.username.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 truncate">
              <div className="text-sm font-bold text-slate-200 truncate">{currentUser?.username || 'User'}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Standard User</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 rounded-xl text-slate-400 hover:text-red-400 transition-all text-sm font-bold"
          >
            Logout
          </button>
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
            <div className="border-b border-white/5 flex items-center justify-between bg-black/5" style={{ padding: '0.8rem 2rem' }}>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{selectedSubject.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                  <FileText size={14} /> {notes.length} uploaded materials
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Voice Toggle */}
                <button
                  onClick={() => {
                    setIsVoiceEnabled(!isVoiceEnabled);
                    if (isVoiceEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
                  }}
                  className={`flex items-center justify-center w-[38px] h-[38px] rounded-xl transition-all font-bold ${isVoiceEnabled ? 'soft-active-btn' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                  title={isVoiceEnabled ? "Mute Voice Tutor" : "Enable Voice Tutor"}
                >
                  {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>

                {/* Upload Button */}
                <label className={`flex items-center gap-2 px-4 h-[38px] rounded-xl text-[13px] font-bold transition-all cursor-pointer ${isUploading ? 'bg-indigo-500/50 text-white cursor-not-allowed' : 'soft-active-btn'}`}>
                  {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  Upload Notes
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                </label>

                <div className="w-[1px] h-8 bg-white/10 mx-1"></div>

                {/* Tabs */}
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-2 px-4 h-[38px] rounded-xl text-[13px] font-bold transition-all ${activeTab === 'chat' ? 'soft-active-btn' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                >
                  <MessageSquare size={16} /> Chat
                </button>

                <button
                  onClick={() => setActiveTab('files')}
                  className={`flex items-center gap-2 px-4 h-[38px] rounded-xl text-[13px] font-bold transition-all ${activeTab === 'files' ? 'soft-active-btn' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                >
                  <FileText size={16} /> Files
                </button>

                <button
                  onClick={() => setActiveTab('study')}
                  className={`flex items-center gap-2 px-4 h-[38px] rounded-xl text-[13px] font-bold transition-all ${activeTab === 'study' ? 'soft-active-btn' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                >
                  <BookOpen size={16} /> Study Mode
                </button>
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
                      <div
                        key={n.id}
                        onClick={() => setPreviewFile(n)}
                        className="group glass-card p-6 flex items-center justify-between border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.03] transition-all cursor-pointer relative overflow-hidden"
                      >
                        {/* Interactive hover glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/[0.02] to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

                        <div className="flex items-center gap-4 relative z-10">
                          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/10 group-hover:scale-110 transition-all duration-300">
                            <FileText size={22} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-200 group-hover:text-white transition-colors">{n.filename}</div>
                            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mt-0.5">Uploaded {new Date(n.uploaded_at).toLocaleDateString()}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 relative z-10">
                          <div className="mr-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                            Quick View <ChevronRight size={12} />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(n.id);
                            }}
                            className="w-10 h-10 flex items-center justify-center bg-transparent hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20 hover:shadow-sm"
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

                      {quizStep === 'landing' ? (
                        <div className="space-y-8">
                          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                            <div className="flex flex-col items-center gap-3 glass-card p-4 border-white/5 w-full md:w-32">
                              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">MCQ Count</span>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={mcqCount}
                                onChange={(e) => setMcqCount(parseInt(e.target.value) || 0)}
                                className="bg-transparent text-2xl font-bold text-indigo-400 w-full text-center focus:outline-none"
                              />
                            </div>
                            <div className="flex flex-col items-center gap-3 glass-card p-4 border-white/5 w-full md:w-32">
                              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Short Answer</span>
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={shortCount}
                                onChange={(e) => setShortCount(parseInt(e.target.value) || 0)}
                                className="bg-transparent text-2xl font-bold text-purple-400 w-full text-center focus:outline-none"
                              />
                            </div>
                          </div>

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
                                <Sparkles /> Generate Brain Quiz
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <InteractiveQuiz quiz={quizResponse} />
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
                  className="glass-card p-2 flex items-center gap-2 shadow-2xl relative"
                >
                  <button
                    type="button"
                    onClick={startListening}
                    disabled={isThinking || !notes.length}
                    className={`w-12 h-12 flex flex-shrink-0 items-center justify-center rounded-2xl transition-all ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
                    title="Voice Input (STT)"
                  >
                    {isListening ? <Activity size={20} /> : <Mic size={20} />}
                  </button>
                  <input
                    type="text"
                    placeholder="Ask about your notes..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isThinking || !notes.length}
                    className="flex-1 min-w-0 bg-transparent px-4 py-3 focus:outline-none text-sm placeholder:text-slate-600"
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
    </div >
  );
};


export default App;
