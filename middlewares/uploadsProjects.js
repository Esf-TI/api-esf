const BUCKET = 'engenheiros-sem-fronteiras.appspot.com'
const admin = require('../firebase')
const FOLDER_NAME = 'imagens';

const bucket = admin.storage().bucket();
const uploadProjects = (req, res, next) => {
    if (!req.files) return next();
  
    const fotoCapa = req.files['fotoCapa'][0];
    const foto = req.files['fotos'];
  
    const uploads = [];
    let count = 0;
  
    const uploadToStorage = (image) => {
      const nomeArquivo = `${FOLDER_NAME}/${Date.now() + "." + image.originalname.split(".").pop()}`;
      const file = bucket.file(nomeArquivo);
      const stream = file.createWriteStream({
        metadata: {
          contentType: image.mimetype
        }
      });
  
      stream.on("error", (e) => {
        console.log(e)
      });
  
      stream.on("finish", async () => {
        try {
          await file.makePublic();
  
          const firebaseUrl = `https://storage.googleapis.com/${BUCKET}/${nomeArquivo}`;
          uploads.push({ filename: nomeArquivo, firebaseUrl: firebaseUrl });
  
          count++;
  
          if (count === foto.length) {
            fotoCapa.filename = nomeArquivo;
            fotoCapa.firebaseUri = firebaseUrl;
  
            req.files = {
              fotoCapa: fotoCapa,
              foto: uploads
            };
            next();
          }
        } catch (error) {
          console.log(error)
        }
      });
  
      stream.end(image.buffer);
    };
  
    uploadToStorage(fotoCapa);
    foto.forEach((image) => {
      uploadToStorage(image);
    });
  };

module.exports = uploadProjects;