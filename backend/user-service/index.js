const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3003;
const JWT_SECRET = 'seu-segredo-super-secreto-temporario'; // Em produção, use variáveis de ambiente!

// Conexão com o banco de dados PostgreSQL do Docker
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Rota para registrar um novo usuário
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    try {
        // Criptografa a senha antes de salvar
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
            [email, hashedPassword]
        );

        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error(error.message);
        if (error.code === '23505') { // Código de violação de unicidade do PostgreSQL
            return res.status(409).json({ message: "Este e-mail já está cadastrado." });
        }
        res.status(500).send("Erro no servidor ao registrar usuário.");
    }
});

// Rota para fazer login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

     if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    try {
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const user = userResult.rows[0];

        // Compara a senha enviada com a senha criptografada no banco
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        // Cria e retorna o token JWT
        const payload = { user: { id: user.id, email: user.email } };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });

    } catch (error) {
        console.error(error.message);
        res.status(500).send("Erro no servidor");
    }
});

app.listen(PORT, () => {
    console.log(`Serviço de Usuários (Local) rodando na porta ${PORT}`);
});