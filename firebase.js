const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
const BUCKET = 'gs://engenharia-sem-fronteira.appspot.com'
// Inicializa o Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://engenharia-sem-fronteira-default-rtdb.firebaseio.com/',
  storageBucket: BUCKET
});



module.exports = admin;