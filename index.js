
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();

// Configuração dos middlewares
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors({
    origin: '*'
}));

//IMPORTAÇÃO DAS ROTAS
const NucleosRoutes = require('../backend/routes/NucleosRoutes');
const ProjectsRoutes = require('../backend/routes/ProjectsRoutes');
const BlogRoutes = require('./routes/BlogRoutes');
const AdminRoutes = require('./routes/AdminRoutes');
const ContatoRoutes = require('./routes/ContatoRoutes')

app.use('/nucleos', NucleosRoutes);
app.use('/projetos', ProjectsRoutes);
app.use('/blog', BlogRoutes);
app.use('/admin', AdminRoutes);
app.use('/contato', ContatoRoutes);


app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
