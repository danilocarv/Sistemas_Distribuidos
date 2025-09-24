// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './App.css';

const socket = io("http://localhost");

function App() {
  const [listas, setListas] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [itens, setItens] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newListName, setNewListName] = useState('');

  const fetchListas = () => {
    // CORRIGIDO: Rota para buscar as listas
    axios.get('/api/lists/').then(response => {
      setListas(response.data);
    }).catch(err => console.error("Falha ao buscar listas:", err));
  };

  useEffect(() => {
    fetchListas();
  }, []);

  useEffect(() => {
    socket.on('item_adicionado', (novoItem) => {
      // Garante que a atualização só aconteça se estivermos na lista correta
      if (selectedList && novoItem.listId === selectedList.id) {
        setItens(prevItens => [...prevItens, novoItem]);
      }
    });

    socket.on('item_atualizado', (itemAtualizado) => {
      if (selectedList && itemAtualizado.listId === selectedList.id) {
        setItens(prevItens => prevItens.map(item =>
          item.id === itemAtualizado.id ? itemAtualizado : item
        ));
      }
    });

    return () => {
      socket.off('item_adicionado');
      socket.off('item_atualizado');
    };
  }, [selectedList]);


  const handleSelectList = (lista) => {
    setSelectedList(lista);
    socket.emit('entrar_lista', lista.id);

    // CORRIGIDO: Rota para buscar os itens da lista selecionada
    axios.get(`/api/items/${lista.id}`).then(response => {
      setItens(response.data);
    }).catch(err => console.error("Falha ao buscar itens:", err));
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (newItemName.trim() && selectedList) {
      socket.emit('adicionar_item', { listId: selectedList.id, nomeItem: newItemName });
      setNewItemName('');
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (newListName.trim()) {
      await axios.post('/api/lists/', { nome: newListName });
      setNewListName('');
      fetchListas(); // Atualiza a lista de listas
    }
  };

  const handleToggleItem = (item) => {
    if (selectedList) {
      socket.emit('marcar_item', { listId: selectedList.id, itemId: item.id, checked: !item.checked });
    }
  };

  if (!selectedList) {
    return (
      <div className="App">
        <h1>Selecione ou Crie uma Lista</h1>
        <div className="list-selection">
          <ul>
            {listas.map(lista => (
              <li key={lista.id} onClick={() => handleSelectList(lista)}>
                {lista.nome}
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
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <button onClick={() => setSelectedList(null)}>← Voltar para Listas</button>
        <h1>{selectedList.nome}</h1>
      </header>
      <main>
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
            <li key={item.id} onClick={() => handleToggleItem(item)} className={item.checked ? 'checked' : ''}>
              {item.nome}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

export default App;