
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

app.use('/nucleos', NucleosRoutes);
app.use('/projetos', ProjectsRoutes);


app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
