
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Message, Contact } from './types';
import { bluetoothService } from './services/bluetoothService';
import { getSmartReplies, translateMessage } from './services/geminiService';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [deviceName, setDeviceName] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Contact state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactId, setNewContactId] = useState('');

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  // Load contacts from localStorage
  useEffect(() => {
    const savedContacts = localStorage.getItem('bluechat_contacts');
    if (savedContacts) {
      try {
        setContacts(JSON.parse(savedContacts));
      } catch (e) {
        console.error("Failed to parse contacts", e);
      }
    }
  }, []);

  // Save contacts to localStorage
  useEffect(() => {
    localStorage.setItem('bluechat_contacts', JSON.stringify(contacts));
  }, [contacts]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((text: string, sender: 'me' | 'other' | 'ai') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  // Handle incoming bluetooth messages
  useEffect(() => {
    bluetoothService.setOnMessage((msg) => {
      addMessage(msg, 'other');
    });
  }, [addMessage]);

  // Update AI Smart Replies
  useEffect(() => {
    const updateReplies = async () => {
      if (messages.length > 0 && messages[messages.length - 1].sender === 'other') {
        setIsAiLoading(true);
        const history = messages.map(m => ({ text: m.text, sender: m.sender }));
        const suggestions = await getSmartReplies(history);
        setSmartReplies(suggestions);
        setIsAiLoading(false);
      } else {
        setSmartReplies([]);
      }
    };
    updateReplies();
  }, [messages]);

  const handleConnect = async () => {
    try {
      setStatus(AppState.SCANNING);
      setError(null);
      const name = await bluetoothService.scanAndConnect();
      setDeviceName(name);
      setStatus(AppState.CONNECTED);
      setIsContactsOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao conectar");
      setStatus(AppState.ERROR);
    }
  };

  const handleSendMessage = async (textOverride?: string) => {
    const text = textOverride || inputText;
    if (!text.trim()) return;

    try {
      await bluetoothService.sendMessage(text);
      addMessage(text, 'me');
      if (!textOverride) setInputText('');
      setSmartReplies([]);
    } catch (err) {
      setError("Falha ao enviar mensagem");
    }
  };

  const handleTranslate = async (id: string, text: string) => {
    setIsAiLoading(true);
    const translated = await translateMessage(text);
    setMessages(prev => prev.map(m => 
      m.id === id ? { ...m, text: `${m.text}\n\n[Traduzido: ${translated}]` } : m
    ));
    setIsAiLoading(false);
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactId.trim()) return;
    const newContact: Contact = {
      id: Date.now().toString(),
      name: newContactName,
      deviceId: newContactId
    };
    setContacts([...contacts, newContact]);
    setNewContactName('');
    setNewContactId('');
    setIsAddContactModalOpen(false);
  };

  const removeContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
  };

  const LandingView = (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl"></div>

      {showInstallBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-blue-600 p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-bounce">
           <div className="flex items-center space-x-3">
              <i className="fa-solid fa-mobile-screen-button text-xl"></i>
              <p className="text-sm font-bold leading-tight">Instale o BlueChat no seu Celular!</p>
           </div>
           <button onClick={handleInstallClick} className="bg-white text-blue-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider">Instalar Agora</button>
        </div>
      )}

      <div className="w-full max-w-md text-center space-y-8 relative z-10">
        <div className="relative">
           <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full blur opacity-25"></div>
           <div className="relative bg-slate-800 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 border border-slate-700 shadow-2xl">
              <i className={`fa-brands fa-bluetooth text-4xl text-blue-400 ${status === AppState.SCANNING ? 'animate-pulse' : ''}`}></i>
           </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">BlueChat AI</h1>
          <p className="text-slate-400 text-sm max-w-[280px] mx-auto leading-relaxed">
            Mensagens seguras via Bluetooth com assistência inteligente.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleConnect}
            disabled={status === AppState.SCANNING || status === AppState.CONNECTING}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all rounded-2xl font-bold shadow-xl shadow-blue-900/40 flex items-center justify-center space-x-2 active:scale-95"
          >
            <i className="fa-solid fa-magnifying-glass text-sm"></i>
            <span>{status === AppState.SCANNING ? 'Buscando...' : 'Buscar Dispositivo'}</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsContactsOpen(true)}
              className="py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all rounded-2xl font-semibold flex items-center justify-center space-x-2 active:scale-95"
            >
              <i className="fa-solid fa-address-book text-sm text-blue-400"></i>
              <span>Contatos</span>
            </button>
            <button
              onClick={() => setIsHelpOpen(true)}
              className="py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all rounded-2xl font-semibold flex items-center justify-center space-x-2 active:scale-95"
            >
              <i className="fa-solid fa-circle-info text-sm text-cyan-400"></i>
              <span>Instalar</span>
            </button>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 pt-4 uppercase tracking-[0.2em] font-bold">
          CONEXÃO PONTO-A-PONTO
        </p>
      </div>

      {/* Help Modal com Instruções de Instalação */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsHelpOpen(false)}></div>
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl p-6 overflow-y-auto max-screen-h-[90vh] space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center space-x-2">
                <i className="fa-solid fa-mobile-screen text-cyan-400"></i>
                <span>Como Instalar no Celular?</span>
              </h3>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 p-2">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-8 py-2">
              <div className="space-y-4">
                <h4 className="flex items-center space-x-2 font-bold text-slate-100">
                  <i className="fa-brands fa-android text-green-500 text-xl"></i>
                  <span>No Android (Chrome)</span>
                </h4>
                <ol className="space-y-3 text-sm text-slate-400 list-decimal pl-5">
                  <li>Toque nos <span className="text-white font-bold">três pontinhos (⋮)</span> no canto superior.</li>
                  <li>Selecione <span className="text-white font-bold">"Instalar aplicativo"</span>.</li>
                  <li>Confirme e o ícone aparecerá na sua tela inicial!</li>
                </ol>
              </div>

              <div className="space-y-4">
                <h4 className="flex items-center space-x-2 font-bold text-slate-100">
                  <i className="fa-brands fa-apple text-slate-100 text-xl"></i>
                  <span>No iPhone (Safari)</span>
                </h4>
                <ol className="space-y-3 text-sm text-slate-400 list-decimal pl-5">
                  <li>Toque no botão de <span className="text-white font-bold">Compartilhar</span> (ícone quadrado com seta).</li>
                  <li>Role para baixo e toque em <span className="text-white font-bold">"Adicionar à Tela de Início"</span>.</li>
                  <li>Toque em <span className="text-white font-bold">Adicionar</span> no topo da tela.</li>
                </ol>
              </div>

              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <p className="text-xs text-blue-400 leading-relaxed">
                  <i className="fa-solid fa-lightbulb mr-2"></i>
                  <strong>Dica:</strong> Uma vez instalado, o app funcionará em tela cheia e será muito mais rápido de abrir!
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-4 bg-blue-600 rounded-2xl font-bold text-white shadow-lg shadow-blue-900/40"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 relative overflow-hidden">
      {status !== AppState.CONNECTED ? LandingView : (
        <>
          {/* Header */}
          <header className="sticky top-0 z-10 glass px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-inner">
                <i className="fa-solid fa-user text-lg"></i>
              </div>
              <div>
                <h2 className="text-sm font-semibold">{deviceName}</h2>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Conectado</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setIsContactsOpen(true)}
                className="text-slate-400 hover:text-white p-2 transition-colors"
                title="Contatos"
              >
                <i className="fa-solid fa-address-book"></i>
              </button>
              <button 
                onClick={() => { bluetoothService.disconnect(); setStatus(AppState.IDLE); }}
                className="text-slate-400 hover:text-white p-2 transition-colors"
                title="Sair"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
          </header>

          {/* Messages Area */}
          <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 opacity-50">
                <i className="fa-regular fa-comments text-4xl"></i>
                <p>Nenhuma mensagem ainda.</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-md relative group transition-all hover:scale-[1.01] ${
                  msg.sender === 'me' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <div className="flex items-center justify-between mt-1 text-[10px] opacity-60">
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.sender === 'other' && (
                      <button 
                        onClick={() => handleTranslate(msg.id, msg.text)}
                        className="ml-2 hover:text-blue-400 transition-colors flex items-center space-x-1"
                      >
                        <i className="fa-solid fa-language text-[12px]"></i>
                        <span>Traduzir</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isAiLoading && (
              <div className="flex justify-start">
                 <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700 flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                 </div>
              </div>
            )}
          </main>

          {/* Message Input Area */}
          <footer className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
            {smartReplies.length > 0 && (
              <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide pb-2">
                <div className="flex-shrink-0 bg-blue-500/20 text-blue-400 p-2 rounded-full text-xs">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                {smartReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(reply)}
                    className="flex-shrink-0 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-slate-800 rounded-2xl flex items-center px-4 py-1 border border-slate-700 focus-within:border-blue-500 transition-all">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-500"
                />
              </div>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim()}
                className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/30 disabled:opacity-50 hover:bg-blue-500 transition-all active:scale-95"
              >
                <i className="fa-solid fa-paper-plane text-sm"></i>
              </button>
            </div>
          </footer>
        </>
      )}

      {/* Contacts Side Drawer */}
      {isContactsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsContactsOpen(false)}
          ></div>
          <div className="relative w-full max-w-sm bg-slate-900 h-full shadow-2xl flex flex-col transform transition-transform animate-slide-in-right">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
              <h2 className="text-lg font-bold flex items-center space-x-2">
                <i className="fa-solid fa-address-book text-blue-400"></i>
                <span>Contatos</span>
              </h2>
              <button onClick={() => setIsContactsOpen(false)} className="text-slate-400 hover:text-white p-2">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3 opacity-60">
                  <i className="fa-solid fa-users-slash text-4xl"></i>
                  <p>Sua lista está vazia.</p>
                </div>
              ) : (
                contacts.map(contact => (
                  <div key={contact.id} className="bg-slate-800 border border-slate-700 p-3 rounded-xl flex items-center justify-between group">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                        {contact.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{contact.name}</p>
                        <p className="text-[10px] text-slate-500 truncate uppercase tracking-tighter">{contact.deviceId}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={handleConnect}
                        className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg"
                        title="Conectar"
                      >
                        <i className="fa-solid fa-plug"></i>
                      </button>
                      <button 
                        onClick={() => removeContact(contact.id)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                        title="Remover"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800">
              <button 
                onClick={() => setIsAddContactModalOpen(true)}
                className="w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                <span>Adicionar Contato</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {isAddContactModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsAddContactModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-6">
            <h3 className="text-xl font-bold text-center">Novo Contato</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-1">Nome do Contato</label>
                <input 
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Ex: Celular de João"
                  className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-1">ID do Dispositivo (Opcional)</label>
                <input 
                  type="text"
                  value={newContactId}
                  onChange={(e) => setNewContactId(e.target.value)}
                  placeholder="Ex: 00:11:22:33:44:55"
                  className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={() => setIsAddContactModalOpen(false)}
                className="flex-1 py-3 text-slate-400 font-semibold hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddContact}
                disabled={!newContactName.trim() || !newContactId.trim()}
                className="flex-1 py-3 bg-blue-600 rounded-xl font-semibold shadow-lg shadow-blue-900/20 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for animations */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default App;
