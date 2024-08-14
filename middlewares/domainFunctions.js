const axios = require("axios");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const FormData = require("form-data");
const ftp = require("basic-ftp");
const puppeteer = require("puppeteer");
const cpanelUser = "newtoo35";
const cpanelPass = "314159265358979Mafra";
const cpanelHost = "br1110.hostgator.com.br";
const domain = "esf.org.br";
const apiToken = "H1ZYLWZDMZB8WWOM4LEEVYFLBLDE63HM";
const wpDownloadUrl = "https://wordpress.org/latest.tar.gz";
const AdmZip = require("adm-zip");

async function createDatabase(subdomain) {
  const dbName = `newtoo35_wp_database_${subdomain}`;
  const dbUser = `newtoo35_wp_${subdomain}`;
  const dbPass = "314159265358979Mafra";

  // URL base para requisições API do cPanel
  const baseUrl = `https://${cpanelHost}:2083/json-api/`;

  // Criação do banco de dados
  const createDbUrl = `${baseUrl}cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=3&cpanel_jsonapi_module=Mysql&cpanel_jsonapi_func=create_database&name=${dbName}`;

  try {
    let response = await axios.get(createDbUrl, {
      headers: {
        Authorization: `cpanel ${cpanelUser}:${apiToken}`,
      },
    });
    console.log("Database creation response:", response.data);
  } catch (error) {
    console.error(
      "Error creating database:",
      error.response ? error.response.data : error.message
    );
    return;
  }

  // Criação do usuário do banco de dados
  const createDbUserUrl = `${baseUrl}cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=3&cpanel_jsonapi_module=Mysql&cpanel_jsonapi_func=create_user&name=${dbUser}&password=${dbPass}`;

  try {
    let response = await axios.get(createDbUserUrl, {
      headers: {
        Authorization: `cpanel ${cpanelUser}:${apiToken}`,
      },
    });
    console.log("Database user creation response:", response.data);
  } catch (error) {
    console.error(
      "Error creating database user:",
      error.response ? error.response.data : error.message
    );
    return;
  }

  // Concessão de privilégios ao usuário do banco de dados
  const addDbUserUrl = `${baseUrl}cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=3&cpanel_jsonapi_module=Mysql&cpanel_jsonapi_func=set_privileges_on_database&user=${dbUser}&database=${dbName}&privileges=ALL`;

  try {
    let response = await axios.get(addDbUserUrl, {
      headers: {
        Authorization: `cpanel ${cpanelUser}:${apiToken}`,
      },
    });
    console.log("Set privileges response:", response.data);
  } catch (error) {
    console.error(
      "Error setting privileges:",
      error.response ? error.response.data : error.message
    );
    return;
  }

  console.log("Database and user created successfully");

  return { dbName, dbUser, dbPass };
}

async function createFTPAccount(subdomain) {
  const ftpUser = `${subdomain}_ftp`;
  const ftpPass = "314159265358979Mafra";
  const ftpDir = `/`;

  const createFTPUrl = `https://${cpanelHost}:2083/json-api/cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Ftp&cpanel_jsonapi_func=addftp&user=${ftpUser}&pass=${ftpPass}&homedir=${ftpDir}&quota=1000`;

  try {
    const response = await axios.get(createFTPUrl, {
      auth: {
        username: cpanelUser,
        password: cpanelPass,
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    console.log("Conta FTP criada:", response.data);
  } catch (error) {
    console.error(
      "Erro ao criar conta FTP:",
      error.response ? error.response.data : error.message
    );
  }
}

async function configureWordPress(subdomain, dbName, dbUser, dbPass) {
  const wpConfigSamplePath = path.join(
    __dirname,
    "wordpress",
    "wp-config-sample.php"
  );
  const wpConfigPath = path.join(__dirname, "wordpress", "wp-config.php");

  try {
    let configFile = fs.readFileSync(wpConfigSamplePath, "utf8");

    configFile = configFile
      .replace("database_name_here", dbName)
      .replace("username_here", dbUser)
      .replace("password_here", dbPass);

    fs.writeFileSync(wpConfigPath, configFile, "utf8");
    console.log(`wp-config.php configured successfully for ${subdomain}`);
  } catch (error) {
    console.error(`Failed to configure wp-config.php for ${subdomain}:`, error);
  }
}

// async function finalizeInstallation(subdomain) {
//   const browser = await puppeteer.launch({ headless: true });
//   const page = await browser.newPage();
//   const url = `https://${subdomain}.${domain}/wp-admin/install.php`;

//   try {
//     await page.goto(url, { waitUntil: 'networkidle2' });

//     // Aguarda até que o elemento esteja disponível
//     await page.waitForSelector('#weblog_title');

//     // Preenche os campos do formulário
//     await page.type('#weblog_title', 'Your Blog Title');
//     await page.type('#user_login', 'admin');
//     await page.type('#pass1', 'adminPassword');
//     await page.type('#admin_email', 'youremail@example.com');

//     // Submete o formulário
//     await page.click('#submit');

//     // Aguarda até que a navegação seja concluída
//     await page.waitForNavigation();

//     console.log('WordPress installed successfully');
//   } catch (error) {
//     console.error('Error during installation:', error.message);
//   } finally {
//     await browser.close();
//   }
// }

async function extractZip(subdomain) {
  const extractUrl = `https://${cpanelHost}:2083/json-api/cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Archive&cpanel_jsonapi_func=extract&file=/home4/${cpanelUser}/${subdomain}/wordpress.zip&dest=/home4/${cpanelUser}/${subdomain}/&password=${cpanelPass}`;

  try {
    const response = await axios.get(extractUrl, {
      auth: {
        username: cpanelUser,
        password: cpanelPass,
      },
      httpsAgent: new (require("https").Agent)({ rejectUnauthorized: false }),
    });
    console.log("Extraction response:", response.data);
  } catch (error) {
    console.error(
      "Error during extraction:",
      error.response ? error.response.data : error.message
    );
  }
}

// async function uploadWordPress(subdomain, wordpressZipUrl) {
//   const client = new ftp.Client();
//   client.ftp.verbose = true;

//   // const zipPath = path.join(__dirname, 'wordpress.zip');
//   const extractTo = path.join(__dirname, "wordpress");

//   try {
//     // await unzipFile(zipPath, extractTo);
//     // console.log("WordPress files extracted successfully");

//     await client.access({
//       host: "br1110.hostgator.com.br",
//       user: `${subdomain}_ftp@newtoo.com.br`,
//       password: "314159265358979Mafra",
//       secure: true,
//     });
//     console.log("Connected to FTP server");

//     await client.ensureDir(`/${subdomain}`);
//     await client.clearWorkingDir();
//     await client.uploadFromDir(extractTo);
//     console.log("WordPress files uploaded successfully");
//   } catch (err) {
//     console.error("Error during operations:", err);
//   } finally {
//     client.close();
//     // Cleanup
//     // fs.unlinkSync(zipPath);
//     // fs.rmdirSync(extractTo, { recursive: true });
//   }
// }

async function uploadWordPress(subdomain) {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  // const extractTo = path.join(__dirname, "wordpress");
  const remoteZipPath = `/home4/${cpanelUser}/${subdomain}/wordpress.zip`;
  const remoteExtractPath = `/home4/${cpanelUser}/${subdomain}/`;

  try {
    await client.access({
      host: cpanelHost,
      user: `${subdomain}_ftp@newtoo.com.br`,
      password: cpanelPass,
      secure: true,
    });
    console.log("Connected to FTP server");

    const downloadUrl = `${cpanelHost}/download?url=${wpDownloadUrl}&path=${remoteZipPath}`;

    const downloadResponse = await axios.get(downloadUrl, {
      auth: {
        username: cpanelUser,
        password: cpanelPass,
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    if (downloadResponse.status === 200) {
      console.log("WordPress ZIP downloaded successfully");

      const extractUrl = `https://${cpanelHost}:2083/json-api/cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=extractfile&sourcefiles=${remoteZipPath}&destfiles=${remoteExtractPath}`;

      const extractResponse = await axios.get(extractUrl, {
        auth: {
          username: cpanelUser,
          password: cpanelPass,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });

      if (extractResponse.status === 200) {
        console.log("WordPress files extracted successfully");
      } else {
        console.error(
          "Error extracting WordPress files:",
          extractResponse.data
        );
      }
    } else {
      console.error("Error downloading WordPress ZIP:", downloadResponse.data);
    }
  } catch (err) {
    console.error("Error during operations:", err);
  } finally {
    client.close();
  }
}

const createSubdomain = async (subdomain) => {
  const documentRoot = `/home4/${cpanelUser}/${subdomain}`;
  const createSubdomainUrl = `https://${cpanelHost}:2083/json-api/cpanel?cpanel_jsonapi_user=${cpanelUser}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=SubDomain&cpanel_jsonapi_func=addsubdomain&domain=${subdomain}&rootdomain=${domain}&dir=${documentRoot}`;

  try {
    const response = await axios.get(createSubdomainUrl, {
      auth: {
        username: cpanelUser,
        password: cpanelPass,
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    console.log("Subdomínio criado:", response.data);

    const { dbName, dbUser, dbPass } = await createDatabase(subdomain);
    await createFTPAccount(subdomain);
    await uploadWordPress(subdomain);
    await extractZip(subdomain);
    await configureWordPress(subdomain, dbName, dbUser, dbPass);
  } catch (error) {
    console.error(
      "Erro ao criar subdomínio:",
      error.response ? error.response.data : error.message
    );
  }
};

module.exports = { createSubdomain };
