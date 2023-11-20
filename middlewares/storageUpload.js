const BUCKET = 'engenharia-sem-fronteira.appspot.com'
const admin = require('../firebase')
const FOLDER_NAME = 'imagens';

const bucket = admin.storage().bucket();
const uploadImage = (req, res, next) => {
if (!req.file) return next();
console.log(req.file)
const image = req.file;
const uploadToStorage = () => {
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
        const uploadedImage = { filename: nomeArquivo, firebaseUrl: firebaseUrl };
        req.file = uploadedImage;
        next();
      } catch (error) {
        console.log(error)
      }
    });
    stream.end(image.buffer);
  };
uploadToStorage();
};
module.exports = uploadImage;