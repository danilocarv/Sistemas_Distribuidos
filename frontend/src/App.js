// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

// A URL do backend será gerenciada pelo Nginx
const socket = io('http://localhost:80'); // Conecta na porta do Nginx

function App() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    // Busca a lista inicial de itens
    axios.get('/api/items')
      .then(response => setItems(response.data))
      .catch(error => console.error("Erro ao buscar itens:", error));

    // Ouve por novos itens adicionados em tempo real
    socket.on('item_added', (item) => {
      setItems((prevItems) => [...prevItems, item]);
    });

    // Limpa o listener quando o componente é desmontado
    return () => socket.off('item_added');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const itemToAdd = { id: Date.now(), name: newItem }; // ID temporário
    socket.emit('add_item', itemToAdd);
    setNewItem('');
  };

  return (
    <div>
      <h1>Lista de Compras Compartilhada</h1>
      <ul>
        {items.map(item => <li key={item.id}>{item.name}</li>)}
      </ul>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Adicionar item"
        />
        <button type="submit">Adicionar</button>
      </form>
    </div>
  );
}

export default App;