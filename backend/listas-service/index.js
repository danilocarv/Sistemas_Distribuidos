// backend/listas-service/index.js

const express = require('express');
const cors = require('cors');
const http = require('http'); // <-- ADICIONADO

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app); // <-- ADICIONADO: Criamos o servidor a partir do app

const PORT = 3001;

// Banco de dados em memória (sem alterações aqui)
let listas = {
  '1': { id: '1', nome: 'Compras da Semana' },
  '2': { id: '2', nome: 'Churrasco Fim de Ano' }
};
let nextListId = 3;

// Rotas (sem alterações aqui)
app.get('/listas', (req, res) => {
  res.json(Object.values(listas));
});

app.post('/listas', (req, res) => {
  const { nome } = req.body;
  if (!nome) {
    return res.status(400).json({ message: 'O nome da lista é obrigatório.' });
  }
  const newListId = (nextListId++).toString();
  const novaLista = { id: newListId, nome };
  listas[newListId] = novaLista;
  console.log(`Lista criada: ${nome} (ID: ${newListId})`);
  res.status(201).json(novaLista);
});

// MUDANÇA: Usamos server.listen em vez de app.listen
server.listen(PORT, () => {
  console.log(`Serviço de Listas rodando na porta ${PORT}`);
});