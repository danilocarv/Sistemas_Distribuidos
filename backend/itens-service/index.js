const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO DO SOCKET.IO ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT"]
  }
});

const PORT = 3002;
const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "segredo_padrao_inseguro";

// --- Conexão com MongoDB ---
mongoose.connect(MONGO_URL)
  .then(() => console.log('Itens-service conectado ao MongoDB.'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// --- Modelo do Item ---
const ItemSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // <--- ESSENCIAL PARA UUID FUNCIONAR
  listId: { type: String, required: true },
  nome: { type: String, required: true },
  checked: { type: Boolean, default: false }
});
const Item = mongoose.model('Item', ItemSchema);

// --- Middleware de Autenticação para Socket.IO ---
// Isso permite saber QUEM está conectado
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log("Aviso: Conexão socket sem token.");
    return next(); 
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error("Token inválido"));
    socket.userId = decoded.id;
    next();
  });
});

// --- Lógica do Tempo Real ---
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  // IMPORTANTE: Entrar na sala da lista específica
  socket.on('entrar_lista', (listId) => {
    socket.join(listId);
    console.log(`Socket ${socket.id} entrou na sala ${listId}`);
  });

  // Adicionar Item
  socket.on('adicionar_item', async (data) => {
    try {
      // GERAÇÃO DE ID ÚNICO E SEGURO
      const newItemId = crypto.randomUUID();

      const novoItem = new Item({
        _id: newItemId,        // Adicionamos o ID manualmente aqui
        listId: data.listId,
        nome: data.nomeItem,
        checked: false
      });

      await novoItem.save();
      
      // Envia para TODOS na sala da lista
      io.to(data.listId).emit('item_adicionado', {
        id: novoItem._id,      // O frontend recebe o ID único gerado
        listId: novoItem.listId,
        nome: novoItem.nome,
        checked: novoItem.checked
      });

      console.log(`[Socket] Item adicionado: ${novoItem.nome} (ID: ${newItemId})`);

    } catch (error) {
      console.error("Erro ao adicionar item:", error);
    }
  });

  // Deletar Item
  socket.on('deletar_item', async (data) => {
    try {
      await Item.findByIdAndDelete(data.itemId);
      // Avisa todos na sala que o item sumiu
      io.to(data.listId).emit('item_deletado', data);
    } catch (error) {
      console.error("Erro ao deletar item:", error);
    }
  });

  // Marcar Item
  socket.on('marcar_item', async (data) => {
    try {
      await Item.findByIdAndUpdate(data.itemId, { checked: data.checked });
      io.to(data.listId).emit('item_atualizado', {
        id: data.itemId,
        listId: data.listId,
        checked: data.checked
      });
    } catch (error) {
      console.error("Erro ao atualizar item:", error);
    }
  });

  // --- EVENTOS GLOBAIS DE LISTA ---
  socket.on('lista_criada', (novaLista) => {
    socket.broadcast.emit('nova_lista_para_todos', novaLista);
  });

  socket.on('lista_deletada', (data) => {
    socket.broadcast.emit('lista_removida_de_todos', data);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// --- Rotas HTTP ---
app.get('/api/items/:listId', async (req, res) => {
  try {
    const itens = await Item.find({ listId: req.params.listId });
    const itensFormatados = itens.map(i => ({
      id: i._id,
      listId: i.listId,
      nome: i.nome,
      checked: i.checked
    }));
    res.json(itensFormatados);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar itens' });
  }
});

app.delete('/api/items/by-list/:listId', async (req, res) => {
  try {
    await Item.deleteMany({ listId: req.params.listId });
    res.status(200).send('Itens deletados');
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar itens' });
  }
});

// --- ROTAS INTERNAS PARA NOTIFICAÇÃO (CHAMADAS PELO LISTAS-SERVICE) ---

// Rota para avisar que uma lista foi criada
app.post('/internal/notify/list-created', (req, res) => {
  const lista = req.body;
  // Emite para TODOS os sockets conectados
  io.emit('nova_lista_para_todos', lista);
  console.log(`[Socket] Notificação de nova lista enviada: ${lista.nome}`);
  res.sendStatus(200);
});

// Rota para avisar que uma lista foi deletada
app.post('/internal/notify/list-deleted', (req, res) => {
  const { id } = req.body;
  // Emite para TODOS os sockets conectados
  io.emit('lista_removida_de_todos', { id });
  console.log(`[Socket] Notificação de lista removida enviada: ${id}`);
  res.sendStatus(200);
});

server.listen(PORT, () => {
  console.log(`Serviço de Itens rodando na porta ${PORT}`);
});