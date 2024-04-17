const connection = require('../connection');
const BUCKET = 'engenheiros-sem-fronteiras.appspot.com'

const CreateBlog = async (req, res) => {
  const { title, description } = req.body;
  const upload = req.file;

  if (!title || !description) {
    return res.status(400).send('Por favor, preencha todos os campos');
  }

  if (!upload || !upload.filename) {
    return res.status(400).send('Imagem não foi enviada corretamente');
  }

  const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`;

  const inserirBlog = 'INSERT INTO Blog (title, description, image) VALUES (?, ?, ?)';

  connection.query(inserirBlog, [title, description, image], async (err, result) => {
    if (err) {
      console.error('Erro ao inserir o post:', err);
      return res.status(500).send('Erro interno do servidor');
    }

    // Verifica se o post foi inserido com sucesso
    if (result.affectedRows === 1) {
      // Retorna o status 201 (Created) e uma mensagem de sucesso
      return res.status(201).send('Post criado com sucesso');
    } else {
      // Retorna o status 500 (Internal Server Error) se ocorrer um erro inesperado
      return res.status(500).send('Erro ao criar o post');
    }
  });

}

const returnAllBlog = (req, res) => {
  const selectBlogsQuery = 'SELECT * FROM Blog';

  connection.query(selectBlogsQuery, (err, rows) => {
    if (err) {
      console.error('Erro ao buscar blogs:', err);
      return res.status(500).send('Erro interno do servidor');
    }


    // Retorna os blogs encontrados
    res.status(200).json(rows);
  });
}

const returnBlogById = (req, res) => {
  const { id } = req.params;
  const selectBlogQuery = 'SELECT * FROM Blog WHERE id = ?';

  connection.query(selectBlogQuery, [id], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar blog por ID:', err);
      return res.status(500).send('Erro interno do servidor');
    }

    // Verifica se o blog foi encontrado
    if (rows.length === 0) {
      return res.status(404).send('Blog não encontrado');
    }

    // Retorna as informações do blog encontrado
    res.status(200).json(rows[0]);
  });
}

const updateBlog = (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  const upload = req.file;
  console.log(upload);
  // Verifica se o ID do blog é fornecido
  if (!id) {
    return res.status(400).send('ID do blog não fornecido');
  }

  // Verifica se pelo menos um dos campos (título, descrição, imagem) foi fornecido
  if (!title && !description && !upload) {
    return res.status(400).send('Por favor, forneça pelo menos um dos campos: título, descrição ou imagem');
  }

  // Constrói a consulta de atualização com base nos campos fornecidos
  let updateBlogQuery = 'UPDATE Blog SET';
  const queryParams = [];

  if (title) {
    updateBlogQuery += ' title = ?,';
    queryParams.push(title);
  }

  if (description) {
    updateBlogQuery += ' description = ?,';
    queryParams.push(description);
  }

  if (upload && upload.filename) {
    const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`;
    updateBlogQuery += ' image = ?,';
    queryParams.push(image);
  }

  // Remove a última vírgula da consulta de atualização
  updateBlogQuery = updateBlogQuery.slice(0, -1);

  updateBlogQuery += ' WHERE id = ?';
  queryParams.push(id);

  // Executa a consulta de atualização
  connection.query(updateBlogQuery, queryParams, (err, result) => {
    if (err) {
      console.error('Erro ao atualizar o blog:', err);
      return res.status(500).send('Erro interno do servidor');
    }

    // Verifica se o blog foi atualizado com sucesso
    if (result.affectedRows === 0) {
      return res.status(404).send('Blog não encontrado');
    }

    // Retorna uma mensagem de sucesso
    res.status(200).send('Blog atualizado com sucesso');
  });

}


const deleteBlog = (req, res) => {
  const { id } = req.params;

  // Verifica se o ID do post é fornecido
  if (!id) {
    return res.status(400).send('ID do post não fornecido');
  }

  // Query para deletar o post do banco de dados
  const deletePostQuery = 'DELETE FROM Blog WHERE id = ?';

  connection.query(deletePostQuery, [id], (err, result) => {
    if (err) {
      console.error('Erro ao deletar o post:', err);
      return res.status(500).send('Erro interno do servidor');
    }

    // Verifica se o post foi deletado com sucesso
    if (result.affectedRows === 0) {
      return res.status(404).send('Post não encontrado');
    }

    // Retorna uma mensagem de sucesso
    res.status(200).send('Post deletado com sucesso');
  });
}
module.exports = { CreateBlog, returnAllBlog, updateBlog, deleteBlog, returnBlogById }