# API ESF — Engenheiros Sem Fronteiras Brasil

Backend do site institucional: núcleos, projetos, blog, publicações, livros,
transparência, governança e contato.

O **frontend fica em outro repositório** (`Esf-TI/front-esf`, pasta local
`esf-livros-front/`). Esta API não serve nenhuma página — apenas JSON.

## Stack

- **Node.js 22** + Express
- **Prisma 7** com **PostgreSQL**
- **Supabase Storage** para imagens e PDFs
- **JWT** para autenticação (admin e núcleo)
- Deploy via **Docker/Coolify**

## Estrutura

```
index.js              Ponto de entrada: monta os routers e sobe o servidor
routes/               Uma rota por domínio; é aqui que fica a autenticação
controllers/          Regra de negócio e acesso ao banco
middlewares/          Autenticação, upload de imagem, cache
lib/                  Utilitários compartilhados (prisma, e-mail, datas, slug)
prisma/               schema.prisma e migrações
scripts/              Tarefas operacionais (seeds, migração de uploads)
```

### Como as rotas são montadas

| Prefixo | Arquivo | Observação |
|---|---|---|
| `/nucleos` | `NucleosRoutes.js` | Cadastro, login e edição de núcleo |
| `/projetos` | `ProjectsRoutes.js` | Projetos dos núcleos |
| `/admin` | `AdminRoutes.js` | Painel administrativo |
| `/auth` | `AuthRoutes.js` | Recuperação de senha |
| `/blog`, `/anais`, `/livros`, `/transparencia`, `/governanca`, `/resultados` | respectivos | Conteúdo institucional |
| `/materiais` | `MateriaisRoutes.js` | Acervo que os núcleos acessam depois do login |
| `/contato` | `ContatoRoutes.js` | Formulário de contato |
| `/api/upload` | `UploadRouter.js` | Upload de PDFs e capas |

> Atenção ao montar rotas: o prefixo se soma ao caminho do router. Por exemplo,
> `app.use("/nucleos", ...)` + `router.post("/nucleos")` resulta em
> `/nucleos/nucleos`.

### Autenticação

- `authenticateAdmin` — exige token de administrador
- `authenticateNucleo` — exige token de núcleo
- `authenticateAdminOrNucleo` — aceita os dois e popula `req.admin` ou `req.nucleo`
- `ensureNucleoSelf` — impede que um núcleo altere dados de outro
- `ensureProjetoDoNucleo` — garante que o projeto pertence ao núcleo autenticado

- `authenticateOpcional` — identifica o ator se houver token e deixa passar se não
  houver; usado pela listagem de materiais, que mostra menos para visitante
- `requireAdminRole(...papeis)` — vai **depois** de `authenticateAdmin` e restringe
  a rota a determinados papéis de admin

Toda rota que **escreve** dados precisa de um desses. Rotas de leitura pública
usam allow-list de campos (`NUCLEO_PUBLIC_SELECT`) para nunca vazar e-mail ou senha.

### Papéis de administrador

`Admin.role` existia desde o início e era devolvido no login, mas nenhuma rota o
consultava: na prática todo admin podia tudo. O vocabulário vive em
`lib/adminRoles.js`:

| Papel | Alcança |
|---|---|
| `superadmin` | Tudo |
| `conteudo` | Blog, publicações, livros, transparência, governança, resultados e uploads |
| `materiais` | Somente `/materiais` |

Contas criadas antes desta mudança têm `role = "admin"`, que é normalizado para
`superadmin` — ninguém perde acesso no deploy. `authenticateAdmin` carrega o papel
junto com o token (sem consulta extra) e recusa conta desativada.

## Rodando local

```bash
npm install
cp .env.example .env   # preencha os valores
npm run dev
```

O servidor sobe em `http://localhost:3000`. É necessário um PostgreSQL acessível
pela `DATABASE_URL` — não há modo offline.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe com nodemon |
| `npm start` | Aplica migrações e sobe (usado no deploy) |
| `npm run migrate` | Cria uma migração nova |
| `npm run studio` | Abre o Prisma Studio |
| `npm run seed` | Garante o admin padrão |

## Variáveis de ambiente

Veja `.env.example`. As essenciais:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Conexão com o Postgres |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Storage de imagens e PDFs |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | Assinatura dos JWTs |
| `EMAIL_TRANSPORTER` / `PASSWORD_TRANSPORTER` | Conta Gmail que envia (use **senha de app**) |
| `EMAIL_CONTATO` | Destino dos formulários de Contato e “Receba novidades” |
| `EMAIL_FUNDAR_NUCLEO` | Destino do formulário “Quero fundar um Núcleo” |
| `FRONTEND_URL` | Base dos links enviados por e-mail (ex.: redefinição de senha) |

> `FRONTEND_URL` é obrigatória para o "esqueci minha senha" funcionar: é ela que
> monta o link enviado ao usuário.

## Deploy

O Coolify observa a branch `main` e faz build pelo `Dockerfile`. As variáveis de
ambiente são injetadas pelo painel — o `.env` local não vai para o servidor.

Ao subir mudanças que dependem dos dois lados (por exemplo, uma rota que passa a
exigir autenticação e o front que precisa enviar o token), publique **os dois
repositórios juntos** para não deixar o painel quebrado no intervalo.
