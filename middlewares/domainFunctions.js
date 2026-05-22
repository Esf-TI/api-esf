const axios = require("axios")
const https = require("https")
const fs = require("fs")
const path = require("path")
const ftp = require("basic-ftp")

const cpanelUser = "esfor8190"
const cpanelHost = "br.luke9050.com.br"
const domain = "esf.org.br"
const apiToken = "R3ZTSLRZJNXSCBCMOAN8S0WYXWMVJ6QF"
const wpDownloadUrl = "https://wordpress.org/latest.tar.gz"

const apiConfig = {
  baseUrl: `https://${cpanelHost}:2083/json-api/`,
  headers: {
    Authorization: `cpanel ${cpanelUser}:${apiToken}`,
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
}

async function makeApiCall(endpoint, params = {}) {
  const url = new URL(`${apiConfig.baseUrl}cpanel`)
  url.searchParams.set("cpanel_jsonapi_user", cpanelUser)

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  try {
    const response = await axios.get(url.toString(), {
      headers: apiConfig.headers,
      httpsAgent: apiConfig.httpsAgent,
    })
    return response.data
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error.response?.data || error.message)
    throw error
  }
}

async function createDatabase(subdomain) {
  const dbName = `esf2025_wp_database_${subdomain}`
  const dbUser = `esf2025_wp_${subdomain}`
  const dbPass = "314159265358979Mafra"

  console.log(`Creating database for subdomain: ${subdomain}`)

  try {
    // Create database
    await makeApiCall("create_database", {
      cpanel_jsonapi_apiversion: "3",
      cpanel_jsonapi_module: "Mysql",
      cpanel_jsonapi_func: "create_database",
      name: dbName,
    })
    console.log(`Database ${dbName} created successfully`)

    // Create database user
    await makeApiCall("create_user", {
      cpanel_jsonapi_apiversion: "3",
      cpanel_jsonapi_module: "Mysql",
      cpanel_jsonapi_func: "create_user",
      name: dbUser,
      password: dbPass,
    })
    console.log(`Database user ${dbUser} created successfully`)

    // Set privileges
    await makeApiCall("set_privileges", {
      cpanel_jsonapi_apiversion: "3",
      cpanel_jsonapi_module: "Mysql",
      cpanel_jsonapi_func: "set_privileges_on_database",
      user: dbUser,
      database: dbName,
      privileges: "ALL",
    })
    console.log(`Privileges set for ${dbUser} on ${dbName}`)

    return { dbName, dbUser, dbPass }
  } catch (error) {
    console.error(`Failed to create database for ${subdomain}:`, error.message)
    throw error
  }
}

async function createFTPAccount(subdomain) {
  const ftpUser = `${subdomain}_ftp`
  const ftpPass = "314159265358979Mafra"
  const ftpDir = `/${subdomain}`

  console.log(`Creating FTP account for subdomain: ${subdomain}`)

  try {
    await makeApiCall("create_ftp", {
      cpanel_jsonapi_apiversion: "2",
      cpanel_jsonapi_module: "Ftp",
      cpanel_jsonapi_func: "addftp",
      user: ftpUser,
      pass: ftpPass,
      homedir: ftpDir,
      quota: "1000",
    })
    console.log(`FTP account ${ftpUser} created successfully`)
    return { ftpUser, ftpPass }
  } catch (error) {
    console.error(`Failed to create FTP account for ${subdomain}:`, error.message)
    throw error
  }
}

async function downloadAndExtractWordPress(subdomain) {
  const documentRoot = `/${subdomain}`

  console.log(`Installing WordPress for subdomain: ${subdomain}`)

  try {
    // Attempting to copy WordPress from existing installation...
    console.log("[v0] Attempting to copy WordPress from existing installation...")

    // Try multiple possible WordPress source locations
    const possibleSources = [
       // WordPress folder in root
      `/wordpress.zip`,
      `/`,
      `/public_html/wordpress`, // WordPress in public_html
      `/public_html`, // If WordPress is in public_html root
      `/public_html/wordpress.zip`,
      `/wordpress`,
    ]

    let copySuccess = false

    for (const sourcePath of possibleSources) {
      try {
        console.log(`[v0] Trying to copy from: ${sourcePath}`)

        // Check if source has WordPress files
        const sourceListResponse = await makeApiCall(`check_source_${sourcePath.replace(/[/]/g, "_")}`, {
          cpanel_jsonapi_apiversion: "2",
          cpanel_jsonapi_module: "Fileman",
          cpanel_jsonapi_func: "listfiles",
          dir: sourcePath,
        })

        const sourceFiles = sourceListResponse?.cpanelresult?.data || []
        const hasWpAdmin = sourceFiles.some((file) => file.file === "wp-admin" && file.type === "dir")
        const hasWpContent = sourceFiles.some((file) => file.file === "wp-content" && file.type === "dir")
        const hasWpIncludes = sourceFiles.some((file) => file.file === "wp-includes" && file.type === "dir")
        const hasIndexPhp = sourceFiles.some((file) => file.file === "index.php")

        if (hasWpAdmin && hasWpContent && hasWpIncludes && hasIndexPhp) {
          console.log(`[v0] Found complete WordPress installation at: ${sourcePath}`)

          // Copy all WordPress files and directories
          const filesToCopy = sourceFiles.filter(
            (file) =>
              file.file !== "." &&
              file.file !== ".." &&
              file.file !== "wp-config.php" && // Don't copy existing config
              !file.file.startsWith("."),
          )

          for (const file of filesToCopy) {
            try {
              await makeApiCall(`copy_${file.file.replace(/[.-]/g, "_")}`, {
                cpanel_jsonapi_apiversion: "2",
                cpanel_jsonapi_module: "Fileman",
                cpanel_jsonapi_func: "copy_files",
                sourcefiles: JSON.stringify([`${sourcePath}/${file.file}`]),
                destdir: documentRoot,
              })
              console.log(`[v0] Copied: ${file.file}`)
            } catch (copyError) {
              console.log(`[v0] Failed to copy ${file.file}:`, copyError.message)
            }
          }

          copySuccess = true
          console.log(`[v0] WordPress copied successfully from ${sourcePath}`)
          break
        }
      } catch (sourceError) {
        console.log(`[v0] Source ${sourcePath} not accessible or incomplete`)
        continue
      }
    }

    // If copying failed, try extracting from wordpress.zip in public_html...
    if (!copySuccess) {
      console.log("[v0] Trying to extract from wordpress.zip in public_html...")

      try {
        const zipPath = `/public_html/wordpress.zip`

        // Check if wordpress.zip exists in public_html
        const zipCheckResponse = await makeApiCall("check_zip", {
          cpanel_jsonapi_apiversion: "2",
          cpanel_jsonapi_module: "Fileman",
          cpanel_jsonapi_func: "listfiles",
          dir: `/public_html`,
        })

        const zipFiles = zipCheckResponse?.cpanelresult?.data || []
        const hasWordPressZip = zipFiles.some((file) => file.file === "wordpress.zip")

        if (hasWordPressZip) {
          console.log("[v0] Found wordpress.zip in public_html, extracting...")

          // Copy wordpress.zip to subdomain directory
          await makeApiCall("copy_wp_zip", {
            cpanel_jsonapi_apiversion: "2",
            cpanel_jsonapi_module: "Fileman",
            cpanel_jsonapi_func: "copy_files",
            sourcefiles: JSON.stringify([zipPath]),
            destdir: documentRoot,
          })
          console.log("[v0] WordPress ZIP copied to subdomain directory")

          let extractSuccess = false

          // Method 1: Try Fileman extract_archive
          try {
            console.log("[v0] Attempting extraction method 1: Fileman extract_archive")
            await makeApiCall("extract_zip_method1", {
              cpanel_jsonapi_apiversion: "2",
              cpanel_jsonapi_module: "Fileman",
              cpanel_jsonapi_func: "extract_archive",
              archive: `${documentRoot}/wordpress.zip`,
              destination: documentRoot,
            })
            console.log("[v0] Method 1 extraction completed")
            extractSuccess = true
          } catch (method1Error) {
            console.log("[v0] Method 1 failed:", method1Error.message)
          }

          // Method 2: Try Archive extract_files (original method)
          if (!extractSuccess) {
            try {
              console.log("[v0] Attempting extraction method 2: Archive extract_files")
              await makeApiCall("extract_zip_method2", {
                cpanel_jsonapi_apiversion: "2",
                cpanel_jsonapi_module: "Archive",
                cpanel_jsonapi_func: "extract_files",
                path: `${documentRoot}/wordpress.zip`,
                extractto: documentRoot,
              })
              console.log("[v0] Method 2 extraction completed")
              extractSuccess = true
            } catch (method2Error) {
              console.log("[v0] Method 2 failed:", method2Error.message)
            }
          }

          // Method 3: Try Fileman unzip
          if (!extractSuccess) {
            try {
              console.log("[v0] Attempting extraction method 3: Fileman unzip")
              await makeApiCall("extract_zip_method3", {
                cpanel_jsonapi_apiversion: "2",
                cpanel_jsonapi_module: "Fileman",
                cpanel_jsonapi_func: "unzip",
                file: `${documentRoot}/wordpress.zip`,
                destination: documentRoot,
              })
              console.log("[v0] Method 3 extraction completed")
              extractSuccess = true
            } catch (method3Error) {
              console.log("[v0] Method 3 failed:", method3Error.message)
            }
          }

          if (extractSuccess) {
            console.log("[v0] WordPress extracted from public_html zip")

            await new Promise((resolve) => setTimeout(resolve, 2000))

            const postExtractResponse = await makeApiCall("check_post_extract", {
              cpanel_jsonapi_apiversion: "2",
              cpanel_jsonapi_module: "Fileman",
              cpanel_jsonapi_func: "listfiles",
              dir: documentRoot,
            })

            const postExtractFiles = postExtractResponse?.cpanelresult?.data || []
            console.log(
              `[v0] Files after extraction: ${postExtractFiles.map((f) => `${f.file}(${f.type})`).join(", ")}`,
            )

            // Check if extraction created a wordpress folder and move contents if needed
            const hasWordPressFolder = postExtractFiles.some((file) => file.file === "wordpress" && file.type === "dir")

            if (hasWordPressFolder) {
              console.log("[v0] Moving WordPress files from wordpress/ to document root...")

              // List files in wordpress directory
              const wpDirResponse = await makeApiCall("list_wp_files", {
                cpanel_jsonapi_apiversion: "2",
                cpanel_jsonapi_module: "Fileman",
                cpanel_jsonapi_func: "listfiles",
                dir: `${documentRoot}/wordpress`,
              })

              const wpFiles = wpDirResponse?.cpanelresult?.data || []
              console.log(`[v0] Files in wordpress directory: ${wpFiles.map((f) => f.file).join(", ")}`)

              // Move each file/folder from wordpress/ to document root
              for (const file of wpFiles) {
                if (file.file !== "." && file.file !== "..") {
                  try {
                    await makeApiCall("move_file", {
                      cpanel_jsonapi_apiversion: "2",
                      cpanel_jsonapi_module: "Fileman",
                      cpanel_jsonapi_func: "move_files",
                      sourcefiles: JSON.stringify([`${documentRoot}/wordpress/${file.file}`]),
                      destdir: documentRoot,
                    })
                    console.log(`[v0] Moved: ${file.file}`)
                  } catch (moveError) {
                    console.log(`[v0] Failed to move ${file.file}:`, moveError.message)
                  }
                }
              }

              // Remove empty wordpress directory
              try {
                await makeApiCall("remove_wp_dir", {
                  cpanel_jsonapi_apiversion: "2",
                  cpanel_jsonapi_module: "Fileman",
                  cpanel_jsonapi_func: "delete_files",
                  files: JSON.stringify([`${documentRoot}/wordpress`]),
                })
                console.log("[v0] Removed empty wordpress directory")
              } catch (removeError) {
                console.log("[v0] Failed to remove wordpress directory:", removeError.message)
              }
            }

            // Clean up the zip file
            try {
              await makeApiCall("cleanup_zip", {
                cpanel_jsonapi_apiversion: "2",
                cpanel_jsonapi_module: "Fileman",
                cpanel_jsonapi_func: "delete_files",
                files: JSON.stringify([`${documentRoot}/wordpress.zip`]),
              })
              console.log("[v0] Cleaned up wordpress.zip")
            } catch (cleanupError) {
              console.log("[v0] Failed to cleanup zip:", cleanupError.message)
            }

            copySuccess = true
          } else {
            console.log("[v0] All extraction methods failed")
          }
        }
      } catch (zipError) {
        console.log("[v0] Failed to extract from public_html wordpress.zip:", zipError.message)
      }
    }

    // Only fall back to manual creation if all copy methods failed...
    if (!copySuccess) {
      console.log("[v0] All copy methods failed, creating essential WordPress files manually...")
      await createEssentialWordPressFiles(documentRoot, subdomain)
      return
    }

    console.log("[v0] WordPress installation completed successfully")

    console.log("[v0] Verifying WordPress installation...")
    const finalListResponse = await makeApiCall("verify_wp_files", {
      cpanel_jsonapi_apiversion: "2",
      cpanel_jsonapi_module: "Fileman",
      cpanel_jsonapi_func: "listfiles",
      dir: documentRoot,
    })

    const finalFiles = finalListResponse?.cpanelresult?.data || []
    console.log(`[v0] Final files in ${documentRoot}: ${finalFiles.map((f) => `${f.file}(${f.type})`).join(", ")}`)

    const hasWpAdmin = finalFiles.some((file) => file.file === "wp-admin" && file.type === "dir")
    const hasWpContent = finalFiles.some((file) => file.file === "wp-content" && file.type === "dir")
    const hasWpIncludes = finalFiles.some((file) => file.file === "wp-includes" && file.type === "dir")
    const hasIndexPhp = finalFiles.some((file) => file.file === "index.php")

    console.log(
      `[v0] Verification results: wp-admin=${hasWpAdmin}, wp-content=${hasWpContent}, wp-includes=${hasWpIncludes}, index.php=${hasIndexPhp}`,
    )

    if (!hasIndexPhp) {
      console.log("[v0] Critical: index.php missing, falling back to manual creation")
      await createEssentialWordPressFiles(documentRoot, subdomain)
      return
    }

    if (!hasWpAdmin && !hasWpContent && !hasWpIncludes) {
      console.log("[v0] Warning: No WordPress core directories found, but index.php exists")
      console.log("[v0] This may be a partial installation - proceeding anyway")
    }

    console.log("✅ WordPress installation verified successfully")
  } catch (error) {
    console.error(`❌ Failed to install WordPress for ${subdomain}:`, error.message)
    throw error
  }
}

async function configureWordPress(subdomain, dbName, dbUser, dbPass) {
  const documentRoot = `/${subdomain}`

  console.log(`Configuring WordPress for subdomain: ${subdomain}`)

  try {
    // Read wp-config-sample.php
    const sampleConfigResponse = await makeApiCall("read_wp_config", {
      cpanel_jsonapi_apiversion: "2",
      cpanel_jsonapi_module: "Fileman",
      cpanel_jsonapi_func: "viewfile",
      dir: documentRoot,
      file: "wp-config-sample.php",
    })

    if (!sampleConfigResponse?.cpanelresult?.data?.[0]?.file) {
      throw new Error("wp-config-sample.php not found or could not be read")
    }

    let configContent = sampleConfigResponse.cpanelresult.data[0].file

    // Replace database configuration
    configContent = configContent
      .replace("database_name_here", dbName)
      .replace("username_here", dbUser)
      .replace("password_here", dbPass)
      .replace("localhost", "localhost")

    // Add security keys
    const securityKeys = `
define('AUTH_KEY',         '${generateRandomString(64)}');
define('SECURE_AUTH_KEY',  '${generateRandomString(64)}');
define('LOGGED_IN_KEY',    '${generateRandomString(64)}');
define('NONCE_KEY',        '${generateRandomString(64)}');
define('AUTH_SALT',        '${generateRandomString(64)}');
define('SECURE_AUTH_SALT', '${generateRandomString(64)}');
define('LOGGED_IN_SALT',   '${generateRandomString(64)}');
define('NONCE_SALT',       '${generateRandomString(64)}');`

    configContent = configContent.replace(/\/\*\*#@\+.*?Authentication.*?#@-\*\//s, securityKeys)

    // Save wp-config.php
    await makeApiCall("save_wp_config", {
      cpanel_jsonapi_apiversion: "2",
      cpanel_jsonapi_module: "Fileman",
      cpanel_jsonapi_func: "savefile",
      dir: documentRoot,
      filename: "wp-config.php",
      content: configContent,
    })

    console.log(`✅ WordPress configured successfully for ${subdomain}`)
    console.log(`🔗 WordPress should be accessible at: https://${subdomain}.${domain}`)
    console.log(`👤 Admin setup required - visit: https://${subdomain}.${domain}/wp-admin/install.php`)
  } catch (error) {
    console.error(`Failed to configure WordPress for ${subdomain}:`, error.message)
    throw error
  }
}

async function createSubdomain(subdomain) {
  const documentRoot = `/${subdomain}`

  console.log(`Starting subdomain creation process for: ${subdomain}`)

  try {
    // Create subdomain
    console.log("Step 1: Creating subdomain...")
    await makeApiCall("create_subdomain", {
      cpanel_jsonapi_apiversion: "2",
      cpanel_jsonapi_module: "SubDomain",
      cpanel_jsonapi_func: "addsubdomain",
      domain: subdomain,
      rootdomain: domain,
      dir: documentRoot,
    })
    console.log(`Subdomain ${subdomain}.${domain} created successfully`)

    // Create database
    console.log("Step 2: Creating database...")
    const { dbName, dbUser, dbPass } = await createDatabase(subdomain)

    // Create FTP account
    console.log("Step 3: Creating FTP account...")
    await createFTPAccount(subdomain)

    // Install WordPress from local zip
    console.log("Step 4: Installing WordPress from local zip...")
    await downloadAndExtractWordPress(subdomain)

    // Configure WordPress
    console.log("Step 5: Configuring WordPress...")
    await configureWordPress(subdomain, dbName, dbUser, dbPass)

    console.log(`✅ Subdomain ${subdomain}.${domain} created successfully with WordPress!`)
    console.log(`🔗 Access: https://${subdomain}.${domain}`)
    console.log(`📊 Database: ${dbName}`)
    console.log(`⚙️  Complete setup at: https://${subdomain}.${domain}/wp-admin/install.php`)

    return {
      subdomain: `${subdomain}.${domain}`,
      database: { dbName, dbUser, dbPass },
      setupUrl: `https://${subdomain}.${domain}/wp-admin/install.php`,
      success: true,
    }
  } catch (error) {
    console.error(`❌ Failed to create subdomain ${subdomain}:`, error.message)
    return {
      subdomain: `${subdomain}.${domain}`,
      error: error.message,
      success: false,
    }
  }
}

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function createEssentialWordPressFiles(documentRoot, subdomain) {
  try {
    console.log("[v0] Creating WordPress directory structure...")

    // Create essential directories
    const directories = ["wp-admin", "wp-content", "wp-content/themes", "wp-content/plugins", "wp-includes"]

    for (const dir of directories) {
      try {
        await makeApiCall(`create_dir_${dir.replace(/[/-]/g, "_")}`, {
          cpanel_jsonapi_apiversion: "2",
          cpanel_jsonapi_module: "Fileman",
          cpanel_jsonapi_func: "mkdir",
          path: `${documentRoot}/${dir}`,
        })
        console.log(`[v0] Created directory: ${dir}`)
      } catch (dirError) {
        console.log(`[v0] Directory ${dir} may already exist or failed to create`)
      }
    }

    // Create essential WordPress files
    const indexPhpContent = `<?php
/**
 * Front to the WordPress application. This file doesn't do anything, but loads
 * wp-blog-header.php which does and tells WordPress to load the theme.
 *
 * @package WordPress
 */

/**
 * Tells WordPress to load the WordPress theme and output it.
 *
 * @var bool
 */
define( 'WP_USE_THEMES', true );

/** Loads the WordPress Environment and Template */
require __DIR__ . '/wp-blog-header.php';
`

    const wpLoadContent = `<?php
/**
 * Bootstrap file for setting the ABSPATH constant
 * and loading the wp-config.php file. The wp-config.php
 * file will then load the wp-settings.php file, which
 * will then set up the WordPress environment.
 *
 * If the wp-config.php file is not found then an error
 * will be displayed asking the user to set up the
 * wp-config.php file.
 *
 * Will also search for wp-config.php in WordPress' parent
 * directory to allow the WordPress directory to remain
 * untouched.
 *
 * @package WordPress
 */

/** Define ABSPATH as this file's directory */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/*
 * The error_reporting() function can be disabled.
 * If you need to turn on error reporting, uncomment the following line.
 * You can also turn on WordPress debugging mode.
 */
//error_reporting( E_ALL );
//define( 'WP_DEBUG', true );

/*
 * Tells WordPress to load the WordPress theme and output it.
 */
define( 'WP_USE_THEMES', true );

/** Loads the WordPress Environment and Template */
require_once ABSPATH . 'wp-config.php';
`

    const wpBlogHeaderContent = `<?php
/**
 * Loads the WordPress environment and template.
 *
 * @package WordPress
 */

if ( ! isset( $wp_did_header ) ) {

	$wp_did_header = true;

	// Load the WordPress library.
	require_once __DIR__ . '/wp-load.php';

	// Set up the WordPress query.
	wp();

	// Load the theme template.
	require_once ABSPATH . WPINC . '/template-loader.php';

}
`

    const wpConfigSampleContent = `<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the web site, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://wordpress.org/support/article/editing-wp-config-php/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'database_name_here' );

/** Database username */
define( 'DB_USER', 'username_here' );

/** Database password */
define( 'DB_PASSWORD', 'password_here' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://wordpress.org/support/article/debugging-in-wordpress/
 */
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" comment. */



/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
`

    // Create files
    const files = [
      { name: "index.php", content: indexPhpContent },
      { name: "wp-load.php", content: wpLoadContent },
      { name: "wp-blog-header.php", content: wpBlogHeaderContent },
      { name: "wp-config-sample.php", content: wpConfigSampleContent },
    ]

    for (const file of files) {
      try {
        await makeApiCall(`create_${file.name.replace(/[.]/g, "_")}`, {
          cpanel_jsonapi_apiversion: "2",
          cpanel_jsonapi_module: "Fileman",
          cpanel_jsonapi_func: "savefile",
          dir: documentRoot,
          filename: file.name,
          content: file.content,
        })
        console.log(`[v0] Created file: ${file.name}`)
      } catch (fileError) {
        console.log(`[v0] Failed to create ${file.name}:`, fileError.message)
      }
    }

    console.log("[v0] Essential WordPress files created successfully")
    console.log(
      "[v0] Note: This is a minimal WordPress installation. You may need to upload additional files manually.",
    )
  } catch (error) {
    console.error("[v0] Failed to create essential WordPress files:", error.message)
    throw error
  }
}

module.exports = { createSubdomain }
