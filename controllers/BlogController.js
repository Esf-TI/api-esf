const connection = require('../connection');
const BUCKET = 'engenheiros-sem-fronteiras.appspot.com'

const CreateBlog = async (req, res) => {
  const {title, description} = req.body;
  const upload = req.file

  if (!title || !description) {
    return res.status(400).send('Por favor, preencha todos os campos');
  }

  if (!upload || !upload.filename) {
    res.status(400).send('Imagem não foi enviada corretamente');
    return;
  }

  const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`;

  const inserirBlog =  'INSERT INTO Blog (title,description,image) VALUES (?, ?, ?)';

  connection.query(inserirBlog,[title,description,image], async (err, result) => {
    if (err) {
      console.log(err);
    }
  })

}

module.exports = { CreateBlog }