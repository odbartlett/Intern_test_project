"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';

interface ChatConfig {
  api: string;
  headers: {
    Authorization: string;
  };
  initialMessages?: Array<{
    id: string;
    role: "user" | "system" | "assistant";
    content: string;
  }>;
}

export default function Chat() {
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat(chatConfig || {});

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch chat history from Supabase
  const fetchChatHistory = async (userId: string) => {
    const { data, error } = await supabase
      .from("chat_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching chat history:", error);
      return [];
    }
    return data;
  };

  // Initialize session and fetch chat history
  const initializeChat = async (session: any) => {
    if (!session) return;

    setUser(session.user);
    const history = await fetchChatHistory(session.user.id);

    setChatConfig({
      api: "/api/chat",
      headers: { Authorization: `Bearer ${session.access_token}` },
      initialMessages: history.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "system" | "assistant",
        content: msg.message,
      })),
    });
  };

  // Listen for authentication state changes
  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      initializeChat(session);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      initializeChat(session);
    });

    fetchSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // User authentication handlers
  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) console.error("Error signing up:", error);
  };

  const handleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) console.error("Error signing in:", error);
    else initializeChat(data.session);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error signing out:", error);
    else setUser(null);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-purple-700 to-indigo-900 text-white p-4">
        <h1 className="text-4xl font-bold mb-4">Sign In</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-2 p-2 rounded-lg bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-2 p-2 rounded-lg bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSignIn}
          className="bg-blue-500 hover:bg-blue-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Sign In
        </button>
        <button
          onClick={handleSignUp}
          className="mt-2 bg-green-500 hover:bg-green-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-purple-700 to-indigo-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-4 text-center">Intern Test Project</h1>
      <button
        onClick={handleSignOut}
        className="bg-red-500 hover:bg-red-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        Sign Out
      </button>
      <div className="flex-grow overflow-auto mb-4 rounded-lg bg-black bg-opacity-30 p-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex items-start space-x-2 mb-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <Bot size={20} />
                </div>
              )}
              <div
                className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-lg ${
                  message.role === "user" ? "bg-indigo-600" : "bg-gray-700"
                }`}
              >
                {message.content}
              </div>
              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <User size={20} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center space-x-2"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Bot size={20} />
            </div>
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <span className="animate-pulse">Typing</span>
              <span className="animate-pulse delay-100">.</span>
              <span className="animate-pulse delay-200">.</span>
              <span className="animate-pulse delay-300">.</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="flex-grow rounded-full px-4 py-2 bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="bg-blue-500 hover:bg-blue-600 rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <Send size={24} />
        </button>
      </form>
    </div>
  );
}
