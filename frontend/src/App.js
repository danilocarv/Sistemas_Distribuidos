/* --- IMPORTAÇÕES --- */
import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { useTheme } from './ThemeContext';
import { FaTrash, FaSignOutAlt, FaSun, FaMoon } from 'react-icons/fa';
import './App.css';

/* --- CÉREBRO DA AUTENTICAÇÃO --- */
const AuthContext = createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    setIsLoading(false);
  }, []);

  // CONEXÃO DO SOCKET COM TOKEN
  useEffect(() => {
    if (token) {
      const newSocket = io({
        auth: { token }
      });
      setSocket(newSocket);
      return () => {
        newSocket.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [token]);

  const login = async (email, password) => {
    const response = await axios.post('/api/auth/login', { email, password });
    const { user, token } = response.data;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    setToken(token);
    navigate('/');
  };

  const register = async (name, email, password) => {
    await axios.post('/api/auth/register', { name, email, password });
    navigate('/login');
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setToken(null);
    navigate('/login');
  };

  const value = { user, token, socket, isAuthenticated: !!token, isLoading, login, register, logout };

  if (isLoading) return <div className="container">Carregando...</div>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const useAuth = () => useContext(AuthContext);

/* --- COMPONENTES VISUAIS --- */
const ThemeSwitch = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className={`theme-switch ${theme}`} onClick={toggleTheme}>
      <div className="switch-knob">
        {theme === 'light' ? <FaSun size={12} color="#F6E05E" /> : <FaMoon size={12} color="#4A5568" />}
      </div>
    </div>
  );
};

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await login(email, password); } catch (err) { alert('Falha no login'); }
  };
  return (
    <div className="auth-wrapper"><div className="auth-container">
      <div className="auth-header"><h1>Login</h1><ThemeSwitch /></div>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label>Senha</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">Entrar</button>
      </form>
      <p className="auth-link">Sem conta? <Link to="/register">Registre-se</Link></p>
    </div></div>
  );
}

function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register } = useAuth();
  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await register(name, email, password); } catch (err) { alert('Falha no registro'); }
  };
  return (
    <div className="auth-wrapper"><div className="auth-container">
      <div className="auth-header"><h1>Registro</h1><ThemeSwitch /></div>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>Nome</label><input type="text" value={name} onChange={e => setName(e.target.value)} required />
        <label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label>Senha</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">Criar Conta</button>
      </form>
      <p className="auth-link">Já tem conta? <Link to="/login">Faça login</Link></p>
    </div></div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div>Carregando...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

const Header = ({ title, showBackButton, onBackClick }) => {
  const { logout } = useAuth();
  return (
    <div className="header">
      {showBackButton && <button className="back-button" onClick={onBackClick}>← Voltar</button>}
      <div className="header-center"><h1>{title}</h1><ThemeSwitch /></div>
      <div className="header-controls"><button className="logout-button" onClick={logout}><FaSignOutAlt /></button></div>
    </div>
  );
};

function MainListPage() {
  const { socket } = useAuth(); 
  const [listas, setListas] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [itens, setItens] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newListName, setNewListName] = useState('');

  // Busca inicial
  useEffect(() => {
    if (socket) axios.get('/api/lists/').then(res => setListas(res.data)).catch(console.error);
  }, [socket]);
  
  // LISTENERS DO SOCKET (AQUI ESTÁ A SINCRONIZAÇÃO)
  useEffect(() => {
    if (!socket) return;

    // Handlers
    const handleItemAdd = (item) => setItens(prev => [...prev, item]); // Pode ser simples assim agora
    const handleItemUpdate = (item) => setItens(prev => prev.map(i => i.id === item.id ? item : i));
    const handleItemDelete = ({ itemId }) => setItens(prev => prev.filter(i => i.id !== itemId));
    
    // Como removemos o setListas manual, podemos confiar cegamente no socket
    const handleListAdd = (lista) => setListas(prev => [...prev, lista]);
    const handleListDel = ({ id }) => setListas(prev => prev.filter(l => l.id !== id));

    socket.on('item_adicionado', handleItemAdd);
    socket.on('item_atualizado', handleItemUpdate);
    socket.on('item_deletado', handleItemDelete);
    socket.on('nova_lista_para_todos', handleListAdd);
    socket.on('lista_removida_de_todos', handleListDel);

    return () => {
      socket.off('item_adicionado');
      socket.off('item_atualizado');
      socket.off('item_deletado');
      socket.off('nova_lista_para_todos');
      socket.off('lista_removida_de_todos');
    };
  }, [selectedList, socket]);

  const handleSelectList = (lista) => {
    setSelectedList(lista);
    socket.emit('entrar_lista', lista.id);
    axios.get(`/api/items/${lista.id}`).then(res => setItens(res.data));
  };

  // Voltar para a seleção de listas
  const handleBack = () => {
    if (socket && selectedList) {
        socket.emit('sair_lista', selectedList.id); // Sai da sala
    }
    setSelectedList(null);
    setItens([]);
  };

  // Criar nova lista
  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
        // Envia o pedido para o backend
        await axios.post('/api/lists/', { nome: newListName });
        
        // --- REMOVA ESTA LINHA ---
        // setListas(prev => [...prev, res.data]); 
        // -------------------------

        // Apenas limpe o input. O Socket vai avisar e a lista vai aparecer sozinha.
        setNewListName('');
    } catch (err) {
        alert("Erro ao criar lista.");
    }
  };

  // Apagar lista
  const handleDeleteList = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Tem certeza? Isso apagará todos os itens.")) return;
    try {
        await axios.delete(`/api/lists/${id}`);
        
        // --- REMOVA ESTA LINHA ---
        // setListas(prev => prev.filter(l => l.id !== id));
        // -------------------------
        
    } catch (err) {
        alert("Erro ao apagar lista.");
    }
  };

  // Adicionar Item
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !selectedList) return;
    socket.emit('adicionar_item', { listId: selectedList.id, nomeItem: newItemName });
    setNewItemName('');
  };

  const handleDeleteItem = (e, itemId) => {
    e.stopPropagation();
    socket.emit('deletar_item', { listId: selectedList.id, itemId });
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (newListName.trim()) {
        const res = await axios.post('/api/lists/', { nome: newListName });
        setNewListName('');
        socket.emit('lista_criada', res.data);
        setListas(prev => [...prev, res.data]);
    }
  };
  
  const handleDeleteList = async (e, listId) => {
    e.stopPropagation();
    await axios.delete(`/api/lists/${listId}`);
    socket.emit('lista_deletada', { listId });
    setListas(prev => prev.filter(l => l.id !== listId));
  };

  const handleToggleItem = (item) => {
    socket.emit('marcar_item', { listId: selectedList.id, itemId: item.id, checked: !item.checked });
  };

  if (!selectedList) {
    return (
      <div className="App"><div className="container">
        <Header title="Minhas Listas" showBackButton={false} />
        <ul className="list-selection">{listas.map(l => (
          <li key={l.id} onClick={() => handleSelectList(l)}><span>{l.nome}</span><button className="delete-btn" onClick={e => handleDeleteList(e, l.id)}><FaTrash /></button></li>
        ))}</ul>
        <form onSubmit={handleCreateList} className="new-list-form">
          <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Nome da nova lista" />
          <button type="submit">Criar</button>
        </form>
      </div></div>
    );
  }

  return (
    <div className="App"><div className="container">
      <Header title={selectedList.nome} showBackButton={true} onBackClick={() => setSelectedList(null)} />
      <form onSubmit={handleAddItem} className="add-item-form">
        <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Novo item" />
        <button type="submit">Add</button>
      </form>
      <ul className="item-list">{itens.map(i => (
        <li key={i.id} onClick={() => handleToggleItem(i)} className={`list-item ${i.checked ? 'checked' : ''}`}>
          <span>{i.nome}</span>
          <button className="delete-btn" onClick={e => handleDeleteItem(e, i.id)}><FaTrash /></button>
        </li>
      ))}</ul>
    </div></div>
  );
}

function App() {
  return <AuthProvider><Routes><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/*" element={<ProtectedRoute><MainListPage /></ProtectedRoute>} /></Routes></AuthProvider>;
}

export default App;