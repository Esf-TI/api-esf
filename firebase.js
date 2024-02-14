const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
const BUCKET = 'gs://engenheiros-sem-fronteiras.appspot.com'
// Inicializa o Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://engenheiros-sem-fronteiras.firebaseapp.com/',
  storageBucket: BUCKET
});



module.exports = admin;