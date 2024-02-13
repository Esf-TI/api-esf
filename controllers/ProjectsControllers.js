const connection = require('../connection');
const BUCKET = 'engenharia-sem-fronteira.appspot.com'

const createProject = (req, res) => {
    const { Nome, NucleoResponsavel, Area, descricao, PessoasImpactadas, DataFundacao, Cidade, fotoCapa, foto1, foto2, foto3, foto4, foto5 } = req.body;
    const uploads = req.files;

    // Verificar se todos os campos obrigatórios estão presentes
    if (!Nome || !descricao || !NucleoResponsavel || !uploads || !PessoasImpactadas || !DataFundacao || !Cidade || !fotoCapa || !foto1) {
        res.status(400).send('Todos os campos são obrigatórios');
        return;
    }

    const processedImages = {};
    const promises = Object.keys(uploads).map(async (key) => {
        const upload = uploads[key];
        if (!upload || !upload.filename) {
            return Promise.reject(`A imagem ${key} não foi enviada corretamente`);
        }
        // Aqui você processa a imagem e a armazena onde for necessário
        const imageUrl = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`;
        processedImages[key] = imageUrl;
    });


    const sql = 'INSERT INTO projetos (Nome, NucleoResponsavel, Descricao, Area, PessoasImpactadas, DataFundacao, Cidade, fotoCapa, foto1, foto2, foto3, foto4, foto5) VALUES (?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql, [Nome, NucleoResponsavel, descricao,Area, PessoasImpactadas, DataFundacao, Cidade, processedImages.fotoCapa, processedImages.foto1, processedImages.foto2, processedImages.foto3, processedImages.foto4, processedImages.foto5], (error, results, fields) => {

        if (error) {
            console.error('Erro ao criar Projeto: ' + error.message);
            res.status(500).send('Erro ao criar Projeto');
            return;
        }
        console.log('Projeto criado com sucesso!');
        res.status(200).send('Projeto criado com sucesso!');
    });
};

const returnProjects = (req, res) => {
    const sql = 'SELECT * FROM projetos';

    connection.query(sql, (error, results, fields) => {
        if (error) {
            console.error('Erro ao buscar projetos: ' + error.message);
            res.status(500).send('Erro ao buscar projetos');
            return;
        }
        // Objeto para armazenar os projetos agrupados por área
        const projetosPorArea = {};

        // Organizando os projetos por área
        results.forEach((projeto) => {
            const { area, Titulo, Image, Id, Descricao, NucleoResponsavel } = projeto;

            if (!projetosPorArea[area]) {
                projetosPorArea[area] = [];
            }

            projetosPorArea[area].push({
                Titulo,
                Image,
                Id,
                Descricao,
                NucleoResponsavel
            });
        });

        const projetosAgrupados = Object.keys(projetosPorArea).map((area) => ({
            area,
            projetos: projetosPorArea[area],
        }));
        res.status(200).json(projetosAgrupados); // Retorna os projetos organizados por área
    });
};

// retorna o projeto pelo id
const returnProjectById = (req, res) => {
    const projectId = req.params.id; // Obtém o ID do projeto a partir dos parâmetros da rota
    console.log(projectId)
    const sql = 'SELECT * FROM projetos WHERE id = ?';

    connection.query(sql, [projectId], (error, results, fields) => {
        if (error) {
            console.error('Erro ao buscar o projeto: ' + error.message);
            res.status(500).send('Erro ao buscar o projeto');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('Projeto não encontrado');
            return;
        }

        console.log('Projeto encontrado:', results[0]);
        res.status(200).json(results[0]); // Retorna o projeto encontrado como JSON
    });
};

//editar um projeto
const editProjectById = (req, res) => {
    const projectId = req.params.id;
    const { titulo, descricao, nucleoResponsavel } = req.body;
    let image = null;

    if (req.file) {
        const uploads = req.file;
        image = `https://storage.googleapis.com/${BUCKET}/${uploads.filename}`;
    }

    let sql;
    let params;

    if (image) {
        sql = 'UPDATE projetos SET titulo = ?, descricao = ?, nucleoResponsavel = ?, image = ? WHERE id = ?';
        params = [titulo, descricao, nucleoResponsavel, image, projectId];
    } else {
        sql = 'UPDATE projetos SET titulo = ?, descricao = ?, nucleoResponsavel = ? WHERE id = ?';
        params = [titulo, descricao, nucleoResponsavel, projectId];
    }

    connection.query(sql, params, (error, results, fields) => {
        if (error) {
            console.error('Erro ao editar o projeto: ' + error.message);
            res.status(500).send('Erro ao editar o projeto');
            return;
        }

        if (results.affectedRows === 0) {
            res.status(404).send('Projeto não encontrado');
            return;
        }

        console.log('Projeto editado com sucesso!');
        res.status(200).send('Projeto editado com sucesso!');
    });
};

const deleteProjectById = (req, res) => {
    const projectId = req.params.id; // Obtém o ID do projeto a partir dos parâmetros da rota

    const sql = 'DELETE FROM projetos WHERE id = ?';

    connection.query(sql, [projectId], (error, results, fields) => {
        if (error) {
            console.error('Erro ao excluir o projeto: ' + error.message);
            res.status(500).send('Erro ao excluir o projeto');
            return;
        }

        if (results.affectedRows === 0) {
            res.status(404).send('Projeto não encontrado');
            return;
        }

        console.log('Projeto excluído com sucesso!');
        res.status(200).send('Projeto excluído com sucesso!');
    });
};


module.exports = { createProject, returnProjects, returnProjectById, editProjectById, deleteProjectById }

