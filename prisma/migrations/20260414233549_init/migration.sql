-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'admin',
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminToken" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "accessToken" VARCHAR(512) NOT NULL,
    "refreshToken" VARCHAR(512) NOT NULL,
    "accessTokenExpires" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" INTEGER,
    "details" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blog" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "image" VARCHAR(500),
    "author_id" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "views" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "meta_description" TEXT,
    "tags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nucleo" (
    "id" SERIAL NOT NULL,
    "Nome" VARCHAR(255) NOT NULL,
    "Email" VARCHAR(255) NOT NULL,
    "Senha" VARCHAR(255) NOT NULL,
    "Cidade" VARCHAR(255),
    "Estado" VARCHAR(255),
    "subdominio" VARCHAR(255),
    "Descricao" TEXT,
    "DataFundacao" DATE,
    "fotoCapa" VARCHAR(500),
    "foto1" VARCHAR(500),
    "foto2" VARCHAR(500),
    "foto3" VARCHAR(500),
    "linkDoacao" VARCHAR(255),
    "linkSite" VARCHAR(255),
    "linkLinkedin" VARCHAR(255),
    "linkFacebook" VARCHAR(255),
    "linkInstagram" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "Token" VARCHAR(512),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nucleo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NucleoToken" (
    "id" SERIAL NOT NULL,
    "nucleoId" INTEGER NOT NULL,
    "accessToken" VARCHAR(512) NOT NULL,
    "refreshToken" VARCHAR(512) NOT NULL,
    "accessTokenExpires" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpires" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NucleoToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projetos" (
    "id" SERIAL NOT NULL,
    "Nome" VARCHAR(255) NOT NULL,
    "NucleoResponsavel" INTEGER,
    "Descricao" TEXT,
    "Area" VARCHAR(255),
    "PessoasImpactadas" INTEGER,
    "DataFundacao" DATE,
    "Cidade" VARCHAR(255),
    "Estado" VARCHAR(255),
    "fotoCapa" VARCHAR(500),
    "foto1" VARCHAR(500),
    "foto2" VARCHAR(500),
    "foto3" VARCHAR(500),
    "foto4" VARCHAR(500),
    "foto5" VARCHAR(500),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anais" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "year" INTEGER NOT NULL,
    "event_name" VARCHAR(255),
    "pdf_url" VARCHAR(500) NOT NULL,
    "cover_image_url" VARCHAR(500),
    "authors" JSONB,
    "pages" INTEGER,
    "isbn" VARCHAR(50),
    "doi" VARCHAR(100),
    "keywords" JSONB,
    "category" VARCHAR(100) NOT NULL DEFAULT 'technical',
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "Anais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contato_messages" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(20),
    "assunto" VARCHAR(255),
    "mensagem" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'new',
    "replied_by" INTEGER,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contato_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Blog_slug_key" ON "Blog"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Nucleo_Email_key" ON "Nucleo"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "Nucleo_subdominio_key" ON "Nucleo"("subdominio");

-- AddForeignKey
ALTER TABLE "AdminToken" ADD CONSTRAINT "AdminToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nucleo" ADD CONSTRAINT "Nucleo_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NucleoToken" ADD CONSTRAINT "NucleoToken_nucleoId_fkey" FOREIGN KEY ("nucleoId") REFERENCES "Nucleo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projetos" ADD CONSTRAINT "Projetos_NucleoResponsavel_fkey" FOREIGN KEY ("NucleoResponsavel") REFERENCES "Nucleo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anais" ADD CONSTRAINT "Anais_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contato_messages" ADD CONSTRAINT "contato_messages_replied_by_fkey" FOREIGN KEY ("replied_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
