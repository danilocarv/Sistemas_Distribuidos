// backend/itens-service/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3002;

let itens = {
  '1': [
    { id: '101', nome: 'Leite', checked: false },
    { id: '102', nome: 'Pão', checked: true }
  ],
  '2': []
};
let nextItemId = 103;

app.get('/items/:listId', (req, res) => {
  const { listId } = req.params;
  res.json(itens[listId] || []);
});

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('entrar_lista', (listId) => {
    socket.join(listId);
    console.log(`Cliente ${socket.id} entrou na sala da lista ${listId}`);
  });

  socket.on('adicionar_item', ({ listId, nomeItem }) => {
    const newItem = { 
      id: (nextItemId++).toString(), 
      nome: nomeItem, 
      checked: false,
      listId: listId // <-- CORREÇÃO: Adicionamos o listId
    };
    if (!itens[listId]) {
      itens[listId] = [];
    }
    itens[listId].push(newItem);

    io.to(listId).emit('item_adicionado', newItem);
    console.log(`Item '${nomeItem}' adicionado à lista ${listId}`);
  });

  socket.on('marcar_item', ({ listId, itemId, checked }) => {
    const lista = itens[listId];
    const item = lista ? lista.find(i => i.id === itemId) : null;
    if (item) {
      item.checked = checked;

      const itemAtualizado = {
        ...item,
        listId: listId // <-- CORREÇÃO: Adicionamos o listId
      };

      io.to(listId).emit('item_atualizado', itemAtualizado);
      console.log(`Item '${item.nome}' na lista ${listId} atualizado para checked=${checked}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Serviço de Itens (Real-Time) rodando na porta ${PORT}`);
});