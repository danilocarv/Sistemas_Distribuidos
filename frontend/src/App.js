/* --- IMPORTAÇÕES --- */
import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { useTheme } from './ThemeContext';
import { FaTrash, FaSignOutAlt, FaSun, FaMoon, FaEye, FaEyeSlash } from 'react-icons/fa';
import './App.css';

/* --- AUTH CONTEXT --- */
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
      const newSocket = io('/', { 
        auth: { token },
        transports: ['websocket', 'polling']
      });
      setSocket(newSocket);
      return () => newSocket.disconnect();
    } else {
      setSocket(null);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { user, token } = response.data;
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      setToken(token);
      navigate('/');
    } catch (error) {
      console.error("Erro no login:", error);
      throw error;
    }
  };

  const register = async (name, email, password) => {
    try {
      await axios.post('/api/auth/register', { name, email, password });
      navigate('/login');
    } catch (error) {
      console.error("Erro no registro:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setToken(null);
    if (socket) socket.disconnect();
    navigate('/login');
  };

  const value = { user, token, socket, isAuthenticated: !!token, isLoading, login, register, logout };
  if (isLoading) return <div>Carregando...</div>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const useAuth = () => useContext(AuthContext);

/* --- TEMA --- */
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

/* --- PÁGINAS DE LOGIN / REGISTRO --- */
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try { 
      await login(email, password); 
    } 
    catch (err) { setError('Falha ao logar. Verifique suas credenciais.'); }
  };

  return (
    <div className="auth-container">
      <div className="auth-header"><h1>Login</h1><ThemeSwitch /></div>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="error-message">{error}</p>}
        
        <label>Email</label>
        <input 
          type="email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          list="login-emails" /* Liga ao datalist */
          required 
          autoComplete="email"
          placeholder="Digite seu email..."
        />
        {/* Lista de Sugestões (Seta escondida pelo CSS) */}
        <datalist id="login-emails">
          <option value="danilo.teste@gmail.com" />
          <option value="admin@admin.com" />
          <option value="usuario@teste.com" />
        </datalist>

        <label>Senha</label>
        <div className="password-wrapper">
          <input 
            type={showPassword ? "text" : "password"} 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            autoComplete="current-password"
            placeholder="Digite sua senha..."
          />
          <button 
            type="button" 
            className="toggle-password" 
            onClick={() => setShowPassword(!showPassword)}
            tabIndex="-1"
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        <button type="submit" style={{marginTop: '10px'}}>Entrar</button>
      </form>
      <p className="auth-link">Não tem conta? <Link to="/register">Registre-se</Link></p>
    </div>
  );
}

function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await register(name, email, password); alert('Conta criada! Faça login.'); }
    catch (err) { alert('Erro ao registrar. Tente outro email.'); }
  };

  return (
    <div className="auth-container">
      <div className="auth-header"><h1>Registro</h1><ThemeSwitch /></div>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>Nome</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} required />
        
        <label>Email</label>
        <input 
          type="email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          list="register-emails"
          required 
        />
        <datalist id="register-emails">
           <option value="meuemail@exemplo.com" />
        </datalist>

        <label>Senha</label>
        <div className="password-wrapper">
          <input 
            type={showPassword ? "text" : "password"} 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            autoComplete="new-password"
          />
          <button 
            type="button" 
            className="toggle-password" 
            onClick={() => setShowPassword(!showPassword)}
            tabIndex="-1"
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        <button type="submit" style={{marginTop: '10px'}}>Criar</button>
      </form>
      <p className="auth-link"><Link to="/login">Voltar</Link></p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

/* --- HEADER --- */
const Header = ({ title, showBackButton, onBackClick }) => {
  const { logout, user } = useAuth();
  return (
    <div className="header">
      {showBackButton && <button className="back-button" onClick={onBackClick}>← Voltar</button>}
      <div className="header-center"><h1>{title}</h1><ThemeSwitch /></div>
      <div className="header-controls">
        <span style={{ marginRight: 10, fontSize: '0.9rem' }}>{user?.name}</span>
        <button className="logout-button" onClick={logout} title="Sair"><FaSignOutAlt /></button>
      </div>
    </div>
  );
};

/* --- LISTAS E ITENS --- */
function MainListPage() {
  const { socket } = useAuth();
  const [listas, setListas] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [itens, setItens] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newListName, setNewListName] = useState('');

  // Busca as listas do usuário ao carregar
  useEffect(() => {
    axios.get('/api/lists/')
      .then(res => setListas(res.data))
      .catch(err => {
        console.error("Erro ao buscar listas:", err);
        if (err.response?.status === 403 || err.response?.status === 401) {
            alert("Sessão inválida. Faça login novamente.");
            window.location.href = '/login';
        }
      });
  }, []);

  // Configura os ouvintes do Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleItemAdd = (item) => {
        setItens(prev => {
            if (prev.some(i => i.id === item.id)) return prev; 
            return [...prev, item];
        });
    };

    const handleItemUpdate = (dadosAtualizados) => {
        setItens(prev => prev.map(item => 
            item.id === dadosAtualizados.id 
                ? { ...item, ...dadosAtualizados } 
                : item
        ));
    };

    const handleItemDelete = (data) => {
        const idParaDeletar = data.itemId || data.id; 
        setItens(prev => prev.filter(i => i.id !== idParaDeletar));
    };
    
    const handleListAdd = (lista) => setListas(prev => [...prev, lista]);
    const handleListDel = ({ id }) => setListas(prev => prev.filter(l => l.id !== id));

    socket.on('item_adicionado', handleItemAdd);
    socket.on('item_atualizado', handleItemUpdate);
    socket.on('item_deletado', handleItemDelete);
    socket.on('nova_lista_para_todos', handleListAdd);
    socket.on('lista_removida_de_todos', handleListDel);

    return () => {
        socket.off('item_adicionado', handleItemAdd);
        socket.off('item_atualizado', handleItemUpdate);
        socket.off('item_deletado', handleItemDelete);
        socket.off('nova_lista_para_todos', handleListAdd);
        socket.off('lista_removida_de_todos', handleListDel);
    };
  }, [socket]);

  // Selecionar uma lista
  const handleSelectList = (lista) => {
    setItens([]); 
    setSelectedList(lista);
    socket.emit('entrar_lista', lista.id); 
    
    axios.get(`/api/items/${lista.id}`)
        .then(res => setItens(res.data))
        .catch(err => console.error(err));
  };

  // Voltar para a seleção de listas
  const handleBack = () => {
    if (socket && selectedList) {
        socket.emit('sair_lista', selectedList.id);
    }
    setSelectedList(null);
    setItens([]);
  };

  // Criar nova lista
  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
        await axios.post('/api/lists/', { nome: newListName });
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
    } catch (err) {
        alert("Erro ao apagar lista.");
    }
  };

  // Adicionar Item
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    socket.emit('adicionar_item', { listId: selectedList.id, nomeItem: newItemName });
    setNewItemName('');
  };

  // Marcar/Desmarcar Item
  const handleToggleItem = (item) => {
    socket.emit('marcar_item', { listId: selectedList.id, itemId: item.id, checked: !item.checked });
  };

  // Deletar Item
  const handleDeleteItem = (e, itemId) => {
    e.stopPropagation();
    socket.emit('deletar_item', { listId: selectedList.id, itemId });
  };

  // --- RENDERIZAÇÃO ---
  
  // Tela de Seleção de Listas
  if (!selectedList) {
    return (
      <div className="container">
        <Header title="Minhas Listas" showBackButton={false} />
        <ul className="list-selection">
          {listas.length === 0 ? (
              <p style={{textAlign: 'center', color: '#888', marginTop: 20}}>Nenhuma lista encontrada. Crie uma abaixo!</p>
          ) : (
              listas.map(lista => (
                <li key={lista.id} onClick={() => handleSelectList(lista)}>
                  <span>{lista.nome}</span>
                  <button className="delete-btn" onClick={(e) => handleDeleteList(e, lista.id)}><FaTrash /></button>
                </li>
              ))
          )}
        </ul>
        <form onSubmit={handleCreateList} className="new-list-form">
          <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Nome da nova lista..." />
          <button type="submit">Criar</button>
        </form>
      </div>
    );
  }

  // Tela de Itens da Lista
  return (
    <div className="container">
      <Header title={selectedList.nome} showBackButton={true} onBackClick={handleBack} />
      <form onSubmit={handleAddItem} className="add-item-form">
        <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Novo item..." autoFocus />
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