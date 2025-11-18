/* --- IMPORTAÇÕES --- */
import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { useTheme } from './ThemeContext';
import { FaTrash, FaMoon, FaSun, FaSignOutAlt } from 'react-icons/fa';
import './App.css';

/* --- CÉREBRO DA AUTENTICAÇÃO (AuthContext) --- */
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

  const value = {
    user,
    token,
    socket,
    isAuthenticated: !!token,
    isLoading,
    login,
    register,
    logout
  };

  if (isLoading) {
    return <div className="container">Carregando...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

/* --- PÁGINAS DE LOGIN/REGISTO --- */
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao fazer login.');
    }
  };

  return (
    <div className="auth-container">
      <h1>Login</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="error-message">{error}</p>}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
        <button type="submit">Entrar</button>
      </form>
      <p className="auth-link">Não tem uma conta? <Link to="/register">Registe-se aqui</Link></p>
    </div>
  );
}

function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao registar.');
    }
  };

  return (
    <div className="auth-container">
      <h1>Registo</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="error-message">{error}</p>}
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha (mín. 6 caracteres)" required />
        <button type="submit">Criar Conta</button>
      </form>
      <p className="auth-link">Já tem uma conta? <Link to="/login">Faça login</Link></p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="container">Carregando...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

/* --- COMPONENTES PRINCIPAIS --- */

const ThemeToggleButton = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button className="theme-toggle-button" onClick={toggleTheme} title="Alterar Tema">
      {theme === 'light' ? <FaMoon /> : <FaSun />}
    </button>
  );
};

// --- HEADER MODIFICADO ---
const Header = ({ title, showBackButton, onBackClick }) => {
  const { logout } = useAuth();
  
  return (
    <div className="header">
      {showBackButton && (
        <button className="back-button" onClick={onBackClick}>← Voltar</button>
      )}
      
      {/* CENTRO: Título + Botão de Tema */}
      <div className="header-center">
        <h1>{title}</h1>
        <ThemeToggleButton />
      </div>

      {/* DIREITA: Apenas Botão de Sair */}
      <div className="header-controls">
        <button className="logout-button" onClick={logout} title="Sair">
          <FaSignOutAlt />
        </button>
      </div>
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

  const fetchListas = () => {
    axios.get('/api/lists/').then(response => {
      setListas(response.data);
    }).catch(err => console.error("Falha ao buscar listas:", err));
  };

  useEffect(() => {
    if (socket) fetchListas();
  }, [socket]);
  
  useEffect(() => {
    if (!socket) return; 
    const handleNovaLista = (novaLista) => setListas(prev => [...prev, novaLista]);
    const handleListaRemovida = ({ id }) => setListas(prev => prev.filter(l => l.id !== id));
    const handleItemAdicionado = (novoItem) => {
      if (selectedList && novoItem.listId === selectedList.id) setItens(prev => [...prev, novoItem]);
    };
    const handleItemAtualizado = (itemAtualizado) => {
      if (selectedList && itemAtualizado.listId === selectedList.id) {
        setItens(prev => prev.map(i => i.id === itemAtualizado.id ? itemAtualizado : i));
      }
    };
    const handleItemDeletado = ({ listId, itemId }) => {
      if (selectedList && listId === selectedList.id) setItens(prev => prev.filter(i => i.id !== itemId));
    };
    
    socket.on('item_adicionado', handleItemAdicionado);
    socket.on('item_atualizado', handleItemAtualizado);
    socket.on('item_deletado', handleItemDeletado);
    socket.on('nova_lista_para_todos', handleNovaLista);
    socket.on('lista_removida_de_todos', handleListaRemovida);

    return () => {
      socket.off('item_adicionado', handleItemAdicionado);
      socket.off('item_atualizado', handleItemAtualizado);
      socket.off('item_deletado', handleItemDeletado);
      socket.off('nova_lista_para_todos', handleNovaLista);
      socket.off('lista_removida_de_todos', handleListaRemovida);
    };
  }, [selectedList, socket]);

  const handleSelectList = (lista) => {
    setSelectedList(lista);
    socket.emit('entrar_lista', lista.id);
    axios.get(`/api/items/${lista.id}`).then(res => setItens(res.data));
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !selectedList) return;
    socket.emit('adicionar_item', { listId: selectedList.id, nomeItem: newItemName });
    setNewItemName('');
  };
  
  const handleDeleteItem = (e, itemId) => {
    e.stopPropagation();
    if (selectedList) socket.emit('deletar_item', { listId: selectedList.id, itemId });
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (newListName.trim()) {
      try {
        const response = await axios.post('/api/lists/', { nome: newListName });
        fetchListas();
        setNewListName('');
        socket.emit('lista_criada', response.data);
      } catch (error) {
        alert("Não foi possível criar a lista.");
      }
    }
  };
  
  const handleDeleteList = async (e, listId) => {
    e.stopPropagation();
    try {
      await axios.delete(`/api/lists/${listId}`);
      setListas(prev => prev.filter(l => l.id !== listId));
      socket.emit('lista_deletada', { listId });
    } catch (error) {
      alert('Não foi possível apagar a lista.');
    }
  };

  const handleToggleItem = (item) => {
    if (selectedList) socket.emit('marcar_item', { listId: selectedList.id, itemId: item.id, checked: !item.checked });
  };

  const renderListSelection = () => (
    <div className="container">
      <Header title="Minhas Listas" showBackButton={false} />
      <ul className="list-selection">
        {listas.map(lista => (
          <li key={lista.id} onClick={() => handleSelectList(lista)}>
            <span>{lista.nome}</span>
            <button className="delete-btn" onClick={(e) => handleDeleteList(e, lista.id)}><FaTrash /></button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreateList} className="new-list-form">
        <input type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Nome da nova lista" />
        <button type="submit">Criar Lista</button>
      </form>
    </div>
  );

  const renderItemView = () => (
    <div className="container">
      <Header title={selectedList.nome} showBackButton={true} onBackClick={() => setSelectedList(null)} />
      <form onSubmit={handleAddItem} className="add-item-form">
        <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Adicionar novo item" />
        <button type="submit">Adicionar</button>
      </form>
      <ul className="item-list">
        {itens.map(item => (
          <li key={item.id} onClick={() => handleToggleItem(item)} className={`list-item ${item.checked ? 'checked' : ''}`}>
            <span>{item.nome}</span>
            <button className="delete-btn" onClick={(e) => handleDeleteItem(e, item.id)}><FaTrash /></button>
          </li>
        ))}
      </ul>
    </div>
  );

  return <div className="App">{!selectedList ? renderListSelection() : renderItemView()}</div>;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/*" element={<ProtectedRoute><MainListPage /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}

export default App;