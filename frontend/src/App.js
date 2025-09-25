// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useTheme } from './ThemeContext'; // Importa nosso hook de tema
import { FaTrash, FaMoon, FaSun } from 'react-icons/fa'; // Importa os ícones
import './App.css';

const socket = io("http://localhost");

// Componente do botão de tema
const ThemeToggleButton = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button className="theme-toggle-button" onClick={toggleTheme} title="Alterar Tema">
      {theme === 'light' ? <FaMoon /> : <FaSun />}
    </button>
  );
};

function App() {
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

    socket.on('item_adicionado', handleItemAdicionado);
    socket.on('item_atualizado', handleItemAtualizado);
    socket.on('item_deletado', handleItemDeletado);

    return () => {
      socket.off('item_adicionado', handleItemAdicionado);
      socket.off('item_atualizado', handleItemAtualizado);
      socket.off('item_deletado', handleItemDeletado);
    };
  }, [selectedList]);

  const handleSelectList = (lista) => {
    if (!lista || !lista.id) {
      console.error("Tentativa de selecionar uma lista inválida:", lista);
      return;
    }
    setSelectedList(lista);
    socket.emit('entrar_lista', lista.id);
    axios.get(`/api/items/${lista.id}`).then(response => {
      setItens(response.data);
    }).catch(err => console.error("Falha ao buscar itens:", err));
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !selectedList) return;
    const payload = { listId: selectedList.id, nomeItem: newItemName };
    socket.emit('adicionar_item', payload);
    setNewItemName('');
  };

  const handleDeleteItem = (e, itemId) => {
    e.stopPropagation();
    if (selectedList) {
      socket.emit('deletar_item', { listId: selectedList.id, itemId: itemId });
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (newListName.trim()) {
      try {
        await axios.post('/api/lists/', { nome: newListName });
        setNewListName('');
        fetchListas();
      } catch (error) {
        console.error("Falha ao criar lista:", error);
        alert("Não foi possível criar a lista.");
      }
    }
  };

  const handleDeleteList = async (e, listId) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja apagar esta lista e todos os seus itens?')) {
      try {
        await axios.delete(`/api/lists/${listId}`);
        setListas(prevListas => prevListas.filter(lista => lista.id !== listId));
      } catch (error) {
        console.error("Falha ao deletar a lista:", error);
        alert('Não foi possível apagar a lista.');
      }
    }
  };

  const handleToggleItem = (item) => {
    if (selectedList) {
      socket.emit('marcar_item', { listId: selectedList.id, itemId: item.id, checked: !item.checked });
    }
  };

  const renderListSelection = () => (
    <div className="container">
      <div className="header">
        <h1>Minhas Listas</h1>
        <ThemeToggleButton />
      </div>
      <ul className="list-selection">
        {listas.map(lista => (
          <li key={lista.id} onClick={() => handleSelectList(lista)}>
            <span>{lista.nome}</span>
            <button className="delete-btn" onClick={(e) => handleDeleteList(e, lista.id)} title="Excluir lista">
              <FaTrash />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreateList} className="new-list-form">
        <input 
          type="text"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          placeholder="Nome da nova lista"
        />
        <button type="submit">Criar Lista</button>
      </form>
    </div>
  );

  const renderItemView = () => (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => setSelectedList(null)}>← Voltar para Listas</button>
        <h1>{selectedList.nome}</h1>
        <ThemeToggleButton />
      </div>
      <form onSubmit={handleAddItem} className="add-item-form">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Adicionar novo item"
        />
        <button type="submit">Adicionar</button>
      </form>
      <ul className="item-list">
        {itens.map(item => (
          <li key={item.id} onClick={() => handleToggleItem(item)} className={`list-item ${item.checked ? 'checked' : ''}`}>
            <span>{item.nome}</span>
            <button className="delete-btn" onClick={(e) => handleDeleteItem(e, item.id)} title="Excluir item">
              <FaTrash />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="App">
      {!selectedList ? renderListSelection() : renderItemView()}
    </div>
  );
}

export default App;