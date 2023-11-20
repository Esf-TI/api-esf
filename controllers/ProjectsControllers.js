const connection = require('../connection');
const BUCKET = 'engenharia-sem-fronteira.appspot.com'

const createProject = (req, res) => {
    const { titulo, descricao, nucleoResponsavel, area } = req.body;
    const uploads = req.file;

    // Verificar se todos os campos obrigatórios estão presentes
    if (!titulo || !descricao || !nucleoResponsavel || !uploads || !area) {
        res.status(400).send('Todos os campos são obrigatórios');
        return;
    }

    // Assegurar que a imagem foi enviada corretamente
    if (!uploads || !uploads.filename) {
        res.status(400).send('Imagem não foi enviada corretamente');
        return;
    }

    const image = `https://storage.googleapis.com/${BUCKET}/${uploads.filename}`;

    const sql = 'INSERT INTO projetos (titulo, descricao, nucleoResponsavel, image, area) VALUES (?, ?, ?, ?,?)';
    connection.query(sql, [titulo, descricao, nucleoResponsavel, image, area], (error, results, fields) => {

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

