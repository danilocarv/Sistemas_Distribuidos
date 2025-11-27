const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// 1. CORS PERMISSIVO
app.use(cors({
  origin: '*', 
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] } 
});

const PORT = 3002;
const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "segredo_padrao_inseguro";

mongoose.connect(MONGO_URL)
  .then(() => console.log('Itens-service conectado ao MongoDB.'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));
  
const ItemSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nome: { type: String, required: true },
  checked: { type: Boolean, default: false },
  listId: { type: String, required: true, index: true }
});
const Item = mongoose.model('Item', ItemSchema);

const LockSchema = new mongoose.Schema({
  _id: { type: String, required: true }, 
  createdAt: { type: Date, expires: '10s', default: Date.now } 
});
const Lock = mongoose.model('Lock', LockSchema);

// 2. MIDDLEWARE DE SEGURANÇA
const verificarToken = (req, res, next) => {
  const tokenHeader = req.headers['authorization'];
  if (!tokenHeader) return res.status(401).json({ message: 'Sem token.' });
  const token = tokenHeader.startsWith('Bearer ') ? tokenHeader.slice(7) : tokenHeader;
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token inválido.' });
    req.userId = decoded.id;
    next();
  });
};

// 3. ROTAS HTTP (COM /api/items)
app.get('/api/items/:listId', verificarToken, async (req, res) => {
  try {
    const { listId } = req.params;
    const itens = await Item.find({ listId: listId });
    // Mapeia para o formato que o frontend espera
    const itensFormatados = itens.map(i => ({
      id: i._id,
      nome: i.nome,
      checked: i.checked,
      listId: i.listId
    }));
    res.json(itensFormatados);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar itens.' });
  }
});

app.delete('/api/items/by-list/:listId', async (req, res) => {
    try {
        const { listId } = req.params;
        await Item.deleteMany({ listId: listId });
        res.status(200).json({ message: `Itens deletados.` });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao deletar itens.' });
    }
});

// 4. SOCKET.IO (SIMPLIFICADO)
io.on('connection', (socket) => {
  console.log(`[Socket] Conectado: ${socket.id}`);

  socket.on('entrar_lista', (listId) => {
    socket.join(listId);
    console.log(`[Socket] ${socket.id} entrou na lista ${listId}`);
  });

  socket.on('sair_lista', (listId) => {
    socket.leave(listId);
    console.log(`[Socket] ${socket.id} saiu da lista ${listId}`);
  });

  // Adicionar item
  socket.on('adicionar_item', async ({ listId, nomeItem }) => {
    try {
      const newItemId = new Date().getTime().toString();
      const item = new Item({ _id: newItemId, nome: nomeItem, listId: listId });
      await item.save();
      
      const itemParaEmitir = { 
          id: item._id, 
          nome: item.nome, 
          checked: item.checked, 
          listId: item.listId 
      };
      
      // Envia para TODOS na sala da lista
      io.to(listId).emit('item_adicionado', itemParaEmitir);
      console.log(`[Socket] Item enviado para sala ${listId}`);
    } catch (error) {
      console.error('[Erro] Falha ao adicionar item:', error);
    }
  });

  // Marcar item (com Lock)
  socket.on('marcar_item', async ({ listId, itemId, checked }) => {
    try {
      await Lock.create({ _id: itemId }); // Tenta bloquear
      
      // MODO DEMONSTRAÇÃO (Descomente para a apresentação)
      // await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const item = await Item.findByIdAndUpdate(itemId, { checked: checked }, { new: true });
        if (item) {
          const itemFormatado = { id: item._id, nome: item.nome, checked: item.checked, listId: item.listId };
          io.to(listId).emit('item_atualizado', itemFormatado);
        }
      } finally {
        await Lock.deleteOne({ _id: itemId }); // Libera
      }
    } catch (error) {
      if (error.code !== 11000) console.error('Erro no lock:', error);
    }
  });

  // Deletar item
  socket.on('deletar_item', async ({ listId, itemId }) => {
      await Item.findByIdAndDelete(itemId);
      io.to(listId).emit('item_deletado', { listId, itemId });
  });
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