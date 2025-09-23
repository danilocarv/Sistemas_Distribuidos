// backend/index.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Em produção, restrinja para o seu domínio
        methods: ["GET", "POST"]
    }
});

// Conexão com o MongoDB (será o nome do serviço no Docker Compose)
mongoose.connect('mongodb://db:27017/shoppinglist')
  .then(() => console.log('MongoDB conectado.'))
  .catch(err => console.error(err));

// Lógica da API e do Socket.IO (exemplo)
io.on('connection', (socket) => {
    console.log('Um usuário conectou:', socket.id);

    socket.on('add_item', (item) => {
        // Aqui você salvaria o item no DB
        console.log('Novo item recebido:', item);
        // E depois notificaria todos os outros clientes
        io.emit('item_added', item);
    });

    socket.on('disconnect', () => {
        console.log('Usuário desconectou:', socket.id);
    });
});

// Rotas da API REST para obter dados iniciais
app.get('/api/items', async (req, res) => {
    // Aqui você buscaria os itens do DB
    const items = [{ id: 1, name: 'Leite' }, { id: 2, name: 'Pão' }];
    res.json(items);
});


const PORT = 5000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));