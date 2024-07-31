const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const FormData = require('form-data');
const ftp = require("basic-ftp");
const puppeteer = require('puppeteer');
const cpanelUser = 'newtoo35';
const cpanelPass = '314159265358979Mafra';
const cpanelHost = 'br1110.hostgator.com.br';
const domain = 'newtoo.com.br';
const apiToken = 'WH1BO3YR8ZD7W8CZOI2BXCGRNJWUE6ZC';
const wpDownloadUrl = 'https://wordpress.org/latest.tar.gz';
const AdmZip = require('adm-zip');

async function createDatabase(subdomain) {
  const dbName = `wp_database_${subdomain}`;
  const dbUser = `wp_${subdomain}`;
  const dbPass = '314159265358979Mafra';

  const url = `https://${cpanelHost}:2083/cpsessXXXXXX/json-api/cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Mysql&cpanel_jsonapi_func=create_db&db=${dbName}`;
  
  await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `cpanel ${cpanelUser}:${apiToken}`
    }
  });
  
  const createDbUserUrl = `https://${cpanelHost}:2083/cpsessXXXXXX/json-api/cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Mysql&cpanel_jsonapi_func=create_user&user=${dbUser}&password=${dbPass}`;
  
  await fetch(createDbUserUrl, {
    method: 'GET',
    headers: {
      'Authorization': `cpanel ${cpanelUser}:${apiToken}`
    }
  });

  const addDbUserUrl = `https://${cpanelHost}:2083/cpsessXXXXXX/json-api/cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Mysql&cpanel_jsonapi_func=set_privileges_on_database&user=${dbUser}&database=${dbName}&privileges=ALL%20PRIVILEGES`;

  await fetch(addDbUserUrl, {
    method: 'GET',
    headers: {
      'Authorization': `cpanel ${cpanelUser}:${apiToken}`
    }
  });
  
  console.log("Database and user created successfully");

  return { dbName, dbUser, dbPass };
}

async function createFTPAccount(subdomain) {
  const ftpUser = `${subdomain}_ftp`;
  const ftpPass = '314159265358979Mafra';
  const ftpDir = `/`;

  const createFTPUrl = `https://${cpanelHost}:2083/json-api/cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Ftp&cpanel_jsonapi_func=addftp&user=${ftpUser}&pass=${ftpPass}&homedir=${ftpDir}&quota=1000`;

  try {
    const response = await axios.get(createFTPUrl, {
      auth: {
        username: cpanelUser,
        password: cpanelPass
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    console.log('Conta FTP criada:', response.data);
  } catch (error) {
    console.error('Erro ao criar conta FTP:', error.response ? error.response.data : error.message);
  }
}

async function configureWordPress(subdomain, dbName, dbUser, dbPass) {
  const wpConfigSamplePath = path.join(__dirname, "wordpress", 'wp-config-sample.php');
  const wpConfigPath = path.join(__dirname, "wordpress", 'wp-config.php');

  try {
    let configFile = fs.readFileSync(wpConfigSamplePath, 'utf8');

    configFile = configFile.replace('database_name_here', dbName)
                           .replace('username_here', dbUser)
                           .replace('password_here', dbPass);

    fs.writeFileSync(wpConfigPath, configFile, 'utf8');
    console.log(`wp-config.php configured successfully for ${subdomain}`);
  } catch (error) {
    console.error(`Failed to configure wp-config.php for ${subdomain}:`, error);
  }
}

async function finalizeInstallation(subdomain) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://${subdomain}.${domain}/wp-admin/install.php`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Aguarda até que o elemento esteja disponível
    await page.waitForSelector('#weblog_title');

    // Preenche os campos do formulário
    await page.type('#weblog_title', 'Your Blog Title');
    await page.type('#user_login', 'admin');
    await page.type('#pass1', 'adminPassword');
    await page.type('#admin_email', 'youremail@example.com');

    // Submete o formulário
    await page.click('#submit');

    // Aguarda até que a navegação seja concluída
    await page.waitForNavigation();

    console.log('WordPress installed successfully');
  } catch (error) {
    console.error('Error during installation:', error.message);
  } finally {
    await browser.close();
  }
}

async function extractZip(subdomain) {
  const cPanelHost = 'your-cpanel-host';
  const cPanelUser = 'your-cpanel-user';
  const cPanelPass = 'your-cpanel-pass';

  const extractUrl = `https://${cPanelHost}:2083/json-api/cpanel?cpanel_jsonapi_user=${cPanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Archive&cpanel_jsonapi_func=extract&file=/home/${cPanelUser}/${subdomain}/wordpress.zip&dest=/home/${cPanelUser}/${subdomain}/&password=${cPanelPass}`;

  try {
    const response = await axios.get(extractUrl, {
      auth: {
        username: cPanelUser,
        password: cPanelPass
      },
      httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false })
    });
    console.log('Extraction response:', response.data);
  } catch (error) {
    console.error('Error during extraction:', error.response ? error.response.data : error.message);
  }
}

async function uploadWordPress(subdomain, wordpressZipUrl) {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  // const zipPath = path.join(__dirname, 'wordpress.zip');
  const extractTo = path.join(__dirname, 'wordpress');

  try {

    // await unzipFile(zipPath, extractTo);
    // console.log("WordPress files extracted successfully");

    await client.access({
      host: "br1110.hostgator.com.br",
      user: `${subdomain}_ftp@newtoo.com.br`,
      password: '314159265358979Mafra',
      secure: true
    });
    console.log("Connected to FTP server");

    await client.ensureDir(`/${subdomain}`);
    await client.clearWorkingDir();
    await client.uploadFromDir(extractTo);
    console.log("WordPress files uploaded successfully");

  } catch (err) {
    console.error("Error during operations:", err);
  } finally {
    client.close();
    // Cleanup
    // fs.unlinkSync(zipPath);
    // fs.rmdirSync(extractTo, { recursive: true });
  }
}

const createSubdomain = async (subdomain) => {
  const documentRoot = `/home4/${cpanelUser}/${subdomain}`;
  const createSubdomainUrl = `https://${cpanelHost}:2083/json-api/cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=SubDomain&cpanel_jsonapi_func=addsubdomain&domain=${subdomain}&rootdomain=${domain}&dir=${documentRoot}`;

  try {
    const response = await axios.get(createSubdomainUrl, {
      auth: {
        username: cpanelUser,
        password: cpanelPass
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    console.log('Subdomínio criado:', response.data);

    const { dbName, dbUser, dbPass } = await createDatabase(subdomain);
    await createFTPAccount(subdomain);
    await uploadWordPress(subdomain);
    await configureWordPress(subdomain, dbName, dbUser, dbPass);
    await finalizeInstallation(subdomain);
  } catch (error) {
    console.error('Erro ao criar subdomínio:', error.response ? error.response.data : error.message);
  }
}

module.exports = { createSubdomain };
