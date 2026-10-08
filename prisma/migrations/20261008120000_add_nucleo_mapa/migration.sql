-- CreateTable
CREATE TABLE "nucleo_mapa" (
    "id" SERIAL NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "cidade" VARCHAR(120) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nucleo_mapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nucleo_mapa_uf_cidade_key" ON "nucleo_mapa"("uf", "cidade");

-- Seed: lista que antes ficava fixa na pagina Quem Somos
INSERT INTO "nucleo_mapa" ("uf", "cidade", "ordem") VALUES
    ('SP', 'ABC Paulista', 0),
    ('SP', 'Araras', 1),
    ('SP', 'Campina do Monte Alegre', 2),
    ('SP', 'Ilha Solteira', 3),
    ('SP', 'Itapetininga', 4),
    ('SP', 'Limeira', 5),
    ('SP', 'Lorena', 6),
    ('SP', 'Piracicaba', 7),
    ('SP', 'São Carlos', 8),
    ('PA', 'Belém', 9),
    ('PA', 'Marabá', 10),
    ('PA', 'Tucuruí', 11),
    ('MG', 'Belo Horizonte', 12),
    ('MG', 'Divinópolis', 13),
    ('MG', 'Ituiutaba', 14),
    ('MG', 'João Monlevade', 15),
    ('MG', 'Juiz de Fora', 16),
    ('MG', 'Lavras', 17),
    ('MG', 'Viçosa', 18),
    ('MG', 'Ouro Branco', 19),
    ('MG', 'Ouro Preto', 20),
    ('MG', 'Patos de Minas', 21),
    ('MG', 'Rio Paranaíba', 22),
    ('MG', 'Sete Lagoas', 23),
    ('PB', 'Campina Grande', 24),
    ('PB', 'João Pessoa', 25),
    ('PB', 'Pombal', 26),
    ('PR', 'Curitiba', 27),
    ('PR', 'Maringá', 28),
    ('SC', 'Florianópolis', 29),
    ('SC', 'Joinville', 30),
    ('RS', 'Porto Alegre', 31),
    ('RS', 'Santa Maria', 32),
    ('DF', 'Brasília', 33),
    ('BA', 'Ilhéus', 34),
    ('RN', 'Natal', 35),
    ('RJ', 'Itaperuna', 36),
    ('RJ', 'Rio das Ostras', 37),
    ('RJ', 'Rio de Janeiro', 38),
    ('ES', 'Vitória', 39)
ON CONFLICT DO NOTHING;
