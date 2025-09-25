// frontend/src/App.js (VERSÃO UNIFICADA)
import React, 'useState', useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useTheme } from './ThemeContext';
import { FaTrash, FaMoon, FaSun } from 'react-icons/fa';
import './App.css';

// ----- Componentes de Autenticação (Trazidos da versão do seu amigo) -----
// Para manter o App.js organizado, estes componentes poderiam viver em arquivos separados
// em uma pasta /components, mas por enquanto vamos mantê-los aqui.

const Login = ({ onLoginSuccess, switchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // ATENÇÃO: A rota da API de login precisa ser configurada no Nginx
      const response = await axios.post('/api/users/login', { email, password });
      localStorage.setItem('token', response.data.token);
      onLoginSuccess();
    } catch (err) {
      setError('Falha no login. Verifique suas credenciais.');
    }
  };

  return (
    <div className="auth-form-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
        <button type="submit">Entrar</button>
        {error && <p className="error">{error}</p>}
      </form>
      <p className="switch-auth-text">Não tem uma conta? <button onClick={switchToRegister} className="link-button">Registre-se</button></p>
    </div>
  );
};

const Register = ({ switchToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      // ATENÇÃO: A rota da API de registro precisa ser configurada no Nginx
      await axios.post('/api/users/register', { username, email, password });
      setMessage('Registro bem-sucedido! Você já pode fazer o login.');
      setTimeout(() => switchToLogin(), 2000); // Muda para a tela de login após 2s
    } catch (err) {
      setError('Falha no registro. Tente outro email ou usuário.');
    }
  };

  return (
    <div className="auth-form-container">
      <h2>Registro</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nome de usuário" required />
        <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
        <button type="submit">Registrar</button>
        {error && <p className="error">{error}</p>}
        {message && <p className="message">{message}</p>}
      </form>
      <p className="switch-auth-text">Já tem uma conta? <button onClick={switchToLogin} className="link-button">Faça Login</button></p>
    </div>
  );
};

// ----- Componente da Lista de Compras (Seu código, agora encapsulado) -----
const ShoppingListApp = ({ onLogout }) => {
  const [listas, setListas] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [itens, setItens] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newListName, setNewListName] = useState('');
  const socket = io(); // Conexão do socket dentro do componente que precisa dela

  const fetchListas = () => {
    axios.get('/api/lists/').then(response => {
      setListas(response.data);
    }).catch(err => console.error("Falha ao buscar listas:", err));
  };

  useEffect(() => {
    fetchListas();
  }, []);
  
  useEffect(() => {
    const handleItemAdicionado = (novoItem) => {
      if (selectedList && novoItem.listId === selectedList.id) {
        setItens(prevItens => [...prevItens, novoItem]);
      }
    };
    const handleItemAtualizado = (itemAtualizado) => {
      if (selectedList && itemAtualizado.listId === selectedList.id) {
        setItens(prevItens => prevItens.map(item =>
          item.id === itemAtualizado.id ? itemAtualizado : item
        ));
      }
    };
    const handleItemDeletado = ({ listId, itemId }) => {
      if (selectedList && listId === selectedList.id) {
        setItens(prevItens => prevItens.filter(item => item.id !== itemId));
      }
    };
    const handleNovaLista = (novaLista) => {
      setListas(prevListas => [...prevListas, novaLista]);
    };
    const handleListaRemovida = ({ id }) => {
      setListas(prevListas => prevListas.filter(lista => lista.id !== id));
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
  }, [selectedList]);

  // Todas as suas funções de handle (handleSelectList, handleAddItem, etc.) vêm aqui
  // ... (código das suas funções de handle - sem alterações)
  const handleSelectList = (lista) => { /* ... */ };
  const handleAddItem = (e) => { /* ... */ };
  const handleDeleteItem = (e, itemId) => { /* ... */ };
  const handleCreateList = async (e) => { /* ... */ };
  const handleDeleteList = async (e, listId) => { /* ... */ };
  const handleToggleItem = (item) => { /* ... */ };

  const ThemeToggleButton = () => {
    const { theme, toggleTheme } = useTheme();
    return (
      <button className="theme-toggle-button" onClick={toggleTheme} title="Alterar Tema">
        {theme === 'light' ? <FaMoon /> : <FaSun />}
      </button>
    );
  };

  const renderListSelection = () => (
    <div className="container">
      <div className="header">
        <h1>Minhas Listas</h1>
        <div>
          <ThemeToggleButton />
          <button onClick={onLogout} className="back-button" style={{ marginLeft: '1rem' }}>Sair</button>
        </div>
      </div>
      {/* ... (resto do seu JSX para a seleção de listas) */}
    </div>
  );

  const renderItemView = () => (
    <div className="container">
       <div className="header">
        <button className="back-button" onClick={() => setSelectedList(null)}>← Voltar para Listas</button>
        <h1>{selectedList.nome}</h1>
        <ThemeToggleButton />
      </div>
      {/* ... (resto do seu JSX para a visão de itens) */}
    </div>
  );

  return !selectedList ? renderListSelection() : renderItemView();
}


// ----- Componente Principal (Junção dos dois) -----
function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [showLogin, setShowLogin] = useState(true);

  const handleLoginSuccess = () => {
    setToken(localStorage.getItem('token'));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };
  
  // Se não há token, mostra as telas de autenticação
  if (!token) {
    return (
      <div className="auth-container">
        {showLogin ? (
          <Login onLoginSuccess={handleLoginSuccess} switchToRegister={() => setShowLogin(false)} />
        ) : (
          <Register switchToLogin={() => setShowLogin(true)} />
        )}
      </div>
    );
  }
  
  // Se há um token, mostra a aplicação de lista de compras
  return (
    <ShoppingListApp onLogout={handleLogout} />
  );
}

export default App;