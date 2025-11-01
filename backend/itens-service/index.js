// backend/itens-service/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
const PORT = 3002;
const MONGO_URL = process.env.MONGO_URL;

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
  _id: { type: String, required: true }, // Usaremos o itemId como _id do lock
  createdAt: { type: Date, expires: '10s', default: Date.now } // TTL: trava expira em 10s
});
const Lock = mongoose.model('Lock', LockSchema);

app.get('/items/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    const itensDoBanco = await Item.find({ listId: listId });
    const itensParaFrontend = itensDoBanco.map(item => ({
      id: item._id, nome: item.nome, checked: item.checked, listId: item.listId 
    }));
    res.json(itensParaFrontend);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar itens.' });
  }
});

app.delete('/items/by-list/:listId', async (req, res) => {
    try {
        const { listId } = req.params;
        const result = await Item.deleteMany({ listId: listId });
        console.log(`Deletados ${result.deletedCount} itens da lista ${listId} via HTTP.`);
        res.status(200).json({ message: `${result.deletedCount} itens deletados.` });
    } catch (error) {
        console.error('Erro ao deletar itens via HTTP:', error);
        res.status(500).json({ message: 'Erro ao deletar itens.' });
    }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Cliente conectado: ${socket.id}`);

  socket.on('entrar_lista', (listId) => {
    socket.join(listId);
    console.log(`[Socket.IO] Cliente ${socket.id} entrou na sala da lista ${listId}`);
  });

  socket.on('lista_criada', (novaLista) => {
    // Retransmite para todos os outros clientes
    socket.broadcast.emit('nova_lista_para_todos', novaLista);
  });

  socket.on('lista_deletada', ({ listId }) => {
    // Retransmite para todos os outros clientes
    socket.broadcast.emit('lista_removida_de_todos', { id: listId });
  });

  socket.on('adicionar_item', async ({ listId, nomeItem }) => {
    try {
      const newItemId = new Date().getTime().toString();
      const item = new Item({ _id: newItemId, nome: nomeItem, listId: listId });
      await item.save();
      const itemParaEmitir = { id: item._id, nome: item.nome, checked: item.checked, listId: item.listId };
      io.to(listId).emit('item_adicionado', itemParaEmitir);
    } catch (error) {
      console.error('[BACKEND] ERRO ao adicionar item:', error);
    }
  });

  socket.on('marcar_item', async ({ listId, itemId, checked }) => {
  console.log(`[Coordenação] Tentando adquirir lock para item ${itemId} por ${socket.id}`);
  try {
    // --- TENTA ADQUIRIR O LOCK ---
    await Lock.create({ _id: itemId });
    console.log(`[Coordenação] Lock adquirido para item ${itemId} por ${socket.id}`);

    // --- SE CONSEGUIU O LOCK, PROSSEGUE ---
    try {
      const itemAtualizado = await Item.findByIdAndUpdate(itemId, { checked: checked }, { new: true });

      if (itemAtualizado) {
        const itemParaEmitir = { id: itemAtualizado._id, nome: itemAtualizado.nome, checked: itemAtualizado.checked, listId: itemAtualizado.listId };
        io.to(listId).emit('item_atualizado', itemParaEmitir);
        console.log(`[Coordenação] Item ${itemId} atualizado e evento emitido.`);
      }
    } finally {
      // --- LIBERA O LOCK ---
      await Lock.deleteOne({ _id: itemId });
      console.log(`[Coordenação] Lock liberado para item ${itemId} por ${socket.id}`);
    }

  } catch (error) {
    // --- SE FALHOU EM ADQUIRIR O LOCK ---
    if (error.code === 11000) { 
      console.log(`[Coordenação] Falha ao adquirir lock para item ${itemId} (já bloqueado). Tentativa por ${socket.id}`);
    } else {
      console.error(`[Coordenação] Erro inesperado ao tentar bloquear item ${itemId}:`, error);
    }
  }
});

  socket.on('deletar_item', async ({ listId, itemId }) => {
    try {
      const deletedItem = await Item.findByIdAndDelete(itemId);
      if (deletedItem) {
        io.to(listId).emit('item_deletado', { listId, itemId });
      }
    } catch (error) {
      console.error(`[BACKEND] ERRO ao deletar o item ${itemId}:`, error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Cliente desconectado: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Serviço de Itens (Real-Time) rodando na porta ${PORT}`);
});