const BUCKET = 'engenharia-sem-fronteira.appspot.com'
const admin = require('../firebase')
const FOLDER_NAME = 'imagens';

const bucket = admin.storage().bucket();
const uploadProjects = (req, res, next) => {
    const uploads = req.files;
    
    // Verificar se há uploads de arquivos
    if (!uploads) {
        return next();
    }

    // Processar cada arquivo
    const promises = Object.keys(uploads).map((key) => {
        const image = uploads[key];
        return new Promise((resolve, reject) => {
            if (!image) {
                resolve(); // Pular se o arquivo não estiver presente
                return;
            }
            const nomeArquivo = `${FOLDER_NAME}/${Date.now() + "." + image.originalname.split(".").pop()}`;
            const file = bucket.file(nomeArquivo);
            const stream = file.createWriteStream({
                metadata: {
                    contentType: image.mimetype
                }
            });
            stream.on("error", (e) => {
                console.log(e);
                reject(e);
            });
            stream.on("finish", async () => {
                try {
                    await file.makePublic();
                    const firebaseUrl = `https://storage.googleapis.com/${BUCKET}/${nomeArquivo}`;
                    // Substituir o objeto do arquivo com a URL do Firebase
                    req.files[key] = firebaseUrl;
                    resolve();
                } catch (error) {
                    console.log(error);
                    reject(error);
                }
            });
            stream.end(image.buffer);
        });
    });

    // Aguardar todas as promessas serem resolvidas antes de prosseguir
    Promise.all(promises)
        .then(() => {
            next();
        })
        .catch((error) => {
            console.error('Erro ao processar imagens: ' + error);
            res.status(400).send('Erro ao processar imagens');
        });
};

module.exports = uploadProjects;