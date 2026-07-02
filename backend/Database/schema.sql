database
-- ========================================
-- EXTENSIONS
-- ========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================
-- ENUMS
-- ========================================
CREATE TYPE jour_semaine AS ENUM (
    'LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI'
);
CREATE TYPE semestre_enum   AS ENUM ('S1','S2');
CREATE TYPE statut_seance   AS ENUM ('ACTIVE','TERMINEE','PLANIFIE');
CREATE TYPE statut_presence AS ENUM ('PRESENT','ABSENT');
CREATE TYPE nature_seance   AS ENUM (
    'Cours','TD','TP','Cours/TD','Cours/TP','Cours/TD/TP'
);

-- ========================================
-- 1. Filiere
-- ========================================
CREATE TABLE filiere (
    id  SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL UNIQUE
);

-- ========================================
-- 2. Niveau
-- ========================================
CREATE TABLE niveau (
    id         SERIAL PRIMARY KEY,
    nom        VARCHAR(50) NOT NULL,
    filiere_id INT NOT NULL REFERENCES filiere(id) ON DELETE RESTRICT,
    CONSTRAINT unique_niveau_filiere UNIQUE (nom, filiere_id)
);

-- ========================================
-- 3. Groupe
-- ========================================
CREATE TABLE groupe (
    id        SERIAL PRIMARY KEY,
    nom       VARCHAR(50) NOT NULL,
    niveau_id INT NOT NULL REFERENCES niveau(id) ON DELETE RESTRICT,
    CONSTRAINT unique_groupe_niveau UNIQUE (nom, niveau_id)
);

-- ========================================
-- 4. Prof
-- ========================================
CREATE TABLE prof (
    id                   SERIAL PRIMARY KEY,
    nom                  VARCHAR(100) NOT NULL,
    prenom               VARCHAR(100) NOT NULL,
    email                VARCHAR(150) NOT NULL UNIQUE,
    password_hash        VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ========================================
-- 5. Matiere
-- ========================================
CREATE TABLE matiere (
    id  SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL UNIQUE
);

-- ========================================
-- 6. Etudiant
-- ========================================
CREATE TABLE etudiant (
    id                   SERIAL PRIMARY KEY,
    nom                  VARCHAR(100) NOT NULL,
    prenom               VARCHAR(100) NOT NULL,
    email                VARCHAR(150) NOT NULL UNIQUE,
    password_hash        VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN      NOT NULL DEFAULT TRUE,
    niveau_id            INT NOT NULL REFERENCES niveau(id)  ON DELETE RESTRICT,
    groupe_id            INT          REFERENCES groupe(id)  ON DELETE SET NULL
);

-- ========================================
-- 7. Admin
-- ========================================
CREATE TABLE admin (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

-- ========================================
-- 8. Creneau  (slot horaire récurrent)
-- ========================================
CREATE TABLE creneau (
    id                  SERIAL PRIMARY KEY,
    jour                jour_semaine  NOT NULL,
    heure_debut         TIME          NOT NULL,
    heure_fin           TIME          NOT NULL,
    semestre            semestre_enum NOT NULL,
    annee_universitaire VARCHAR(9)    NOT NULL,
    niveau_id           INT NOT NULL REFERENCES niveau(id) ON DELETE RESTRICT,

    CHECK (heure_fin > heure_debut),
    CHECK (annee_universitaire ~ '^[0-9]{4}-[0-9]{4}$'),

    CONSTRAINT unique_creneau_niveau
        UNIQUE (jour, heure_debut, niveau_id, semestre, annee_universitaire)
);

-- ========================================
-- 9. Creneau_Groupe
--    1 ligne = 1 matiere pour 1 groupe
--    sur 1 creneau horaire
--    groupe_id NULL = tout le niveau
-- ========================================
CREATE TABLE creneau_groupe (
    id         SERIAL PRIMARY KEY,
    creneau_id INT NOT NULL REFERENCES creneau(id)  ON DELETE CASCADE,
    groupe_id  INT          REFERENCES groupe(id)   ON DELETE SET NULL,
    matiere_id INT NOT NULL REFERENCES matiere(id)  ON DELETE RESTRICT,
    prof_id    INT          REFERENCES prof(id)      ON DELETE RESTRICT,
    salle      VARCHAR(50),
    nature     nature_seance NOT NULL DEFAULT 'Cours',

    CONSTRAINT unique_groupe_creneau UNIQUE (creneau_id, groupe_id)
);

-- ========================================
-- 10. Seance  (occurrence réelle)
--     creneau_groupe_id : SET NULL si emploi du temps supprimé
-- ========================================
CREATE TABLE seance (
    id                SERIAL PRIMARY KEY,
    date              DATE          NOT NULL,
    heure_debut       TIME          NOT NULL,
    heure_fin         TIME          NOT NULL,
    salle             VARCHAR(50),
    statut            statut_seance NOT NULL DEFAULT 'ACTIVE',

    -- SET NULL : si le créneau est supprimé, la séance est conservée
    creneau_groupe_id INT REFERENCES creneau_groupe(id) ON DELETE SET NULL,

    -- dénormalisation pour requêtes rapides
    matiere_id INT NOT NULL REFERENCES matiere(id)  ON DELETE RESTRICT,
    prof_id    INT NOT NULL REFERENCES prof(id)      ON DELETE RESTRICT,
    niveau_id  INT NOT NULL REFERENCES niveau(id)    ON DELETE RESTRICT,
    groupe_id  INT          REFERENCES groupe(id)    ON DELETE SET NULL,

    CHECK (heure_fin > heure_debut),

    CONSTRAINT unique_seance_cg_date UNIQUE (creneau_groupe_id, date)
);

-- ========================================
-- 11. QRCode
--     seance_id : SET NULL si séance supprimée
-- ========================================
CREATE TABLE qrcode (
    id              SERIAL PRIMARY KEY,
    token           UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    date_generation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiration      TIMESTAMPTZ NOT NULL,

    -- SET NULL : conserver le QR code même si la séance est supprimée
    seance_id INT REFERENCES seance(id) ON DELETE SET NULL,

    CONSTRAINT check_qrcode_expiration
        CHECK (expiration > date_generation)
);

-- ========================================
-- 12. Presence
--     seance_id : SET NULL si séance supprimée
-- ========================================
CREATE TABLE presence (
    id           SERIAL PRIMARY KEY,
    statut       statut_presence NOT NULL DEFAULT 'ABSENT',
    date_scan    TIMESTAMPTZ,
    localisation VARCHAR(200),
    etudiant_id  INT NOT NULL REFERENCES etudiant(id) ON DELETE RESTRICT,

    -- SET NULL : conserver l'enregistrement même si la séance est supprimée
    seance_id   INT REFERENCES seance(id)  ON DELETE SET NULL,
    qrcode_id   INT REFERENCES qrcode(id)  ON DELETE SET NULL,

    CONSTRAINT unique_presence_etudiant_seance
        UNIQUE (etudiant_id, seance_id)
);

-- ========================================
-- 13. Face Enrollment
-- ========================================
CREATE TABLE face_enrollment (
    id          SERIAL PRIMARY KEY,
    etudiant_id INT NOT NULL REFERENCES etudiant(id) ON DELETE CASCADE,
    position    VARCHAR(20) NOT NULL, -- 'face','droite','gauche','haut','bas'
    embedding   FLOAT8[]    NOT NULL, -- 512 nombres
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_etudiant_position
        UNIQUE (etudiant_id, position)
);

-- ========================================
-- INDEX
-- ========================================
CREATE INDEX idx_niveau_filiere    ON niveau(filiere_id);
CREATE INDEX idx_groupe_niveau     ON groupe(niveau_id);
CREATE INDEX idx_etudiant_niveau   ON etudiant(niveau_id);
CREATE INDEX idx_etudiant_groupe   ON etudiant(groupe_id);
CREATE INDEX idx_creneau_niveau    ON creneau(niveau_id);
CREATE INDEX idx_cg_creneau        ON creneau_groupe(creneau_id);
CREATE INDEX idx_cg_groupe         ON creneau_groupe(groupe_id);
CREATE INDEX idx_cg_prof           ON creneau_groupe(prof_id);
CREATE INDEX idx_seance_cg         ON seance(creneau_groupe_id);
CREATE INDEX idx_seance_prof       ON seance(prof_id);
CREATE INDEX idx_seance_niveau     ON seance(niveau_id);
CREATE INDEX idx_seance_date       ON seance(date);
CREATE INDEX idx_presence_seance   ON presence(seance_id);
CREATE INDEX idx_presence_etudiant ON presence(etudiant_id);
CREATE INDEX idx_qrcode_seance     ON qrcode(seance_id);
CREATE INDEX idx_qrcode_token      ON qrcode(token);

-- ========================================
-- TRIGGER : cohérence séance
--   Skip si creneau_groupe_id est NULL
--   (emploi du temps supprimé)
-- ========================================
CREATE OR REPLACE FUNCTION check_seance_coherence()
RETURNS TRIGGER AS $$
DECLARE
    cg_prof_id   INT;
    cg_niveau_id INT;
    cg_groupe_id INT;
BEGIN
    -- Si le créneau a été supprimé (SET NULL), skip la vérification
    IF NEW.creneau_groupe_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT cg.prof_id, cr.niveau_id, cg.groupe_id
    INTO   cg_prof_id, cg_niveau_id, cg_groupe_id
    FROM   creneau_groupe cg
    JOIN   creneau cr ON cr.id = cg.creneau_id
    WHERE  cg.id = NEW.creneau_groupe_id;

    IF NEW.prof_id != cg_prof_id THEN
        RAISE EXCEPTION 'Prof incohérent (attendu: %)', cg_prof_id;
    END IF;
    IF NEW.niveau_id != cg_niveau_id THEN
        RAISE EXCEPTION 'Niveau incohérent (attendu: %)', cg_niveau_id;
    END IF;
    IF NEW.groupe_id IS DISTINCT FROM cg_groupe_id THEN
        RAISE EXCEPTION 'Groupe incohérent (attendu: %)', cg_groupe_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_seance
BEFORE INSERT OR UPDATE ON seance
FOR EACH ROW EXECUTE FUNCTION check_seance_coherence();

-- ========================================
-- TRIGGER : cohérence présence
--   Skip si seance_id est NULL
--   (séance supprimée)
-- ========================================
CREATE OR REPLACE FUNCTION check_presence_coherence()
RETURNS TRIGGER AS $$
DECLARE
    s_niveau_id INT;
    s_groupe_id INT;
    e_niveau_id INT;
    e_groupe_id INT;
BEGIN
    -- Si la séance a été supprimée (SET NULL), skip la vérification
    IF NEW.seance_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- infos séance
    SELECT niveau_id, groupe_id
    INTO s_niveau_id, s_groupe_id
    FROM seance
    WHERE id = NEW.seance_id;

    -- infos étudiant
    SELECT niveau_id, groupe_id
    INTO e_niveau_id, e_groupe_id
    FROM etudiant
    WHERE id = NEW.etudiant_id;

    -- vérification niveau
    IF e_niveau_id != s_niveau_id THEN
        RAISE EXCEPTION 'Étudiant hors niveau';
    END IF;

    -- vérification groupe
    IF s_groupe_id IS NOT NULL
       AND e_groupe_id IS DISTINCT FROM s_groupe_id THEN
        RAISE EXCEPTION 'Étudiant hors groupe';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_presence
BEFORE INSERT ON presence
FOR EACH ROW EXECUTE FUNCTION check_presence_coherence();

-- ========================================
-- VUE : emploi du temps lisible
-- ========================================
CREATE VIEW vue_emploi_du_temps AS
SELECT
    cr.id                            AS creneau_id,
    cg.id                            AS creneau_groupe_id,
    f.nom                            AS filiere,
    cl.nom                           AS niveau,
    cr.semestre,
    cr.annee_universitaire,
    cr.jour,
    cr.heure_debut,
    cr.heure_fin,
    m.nom                            AS matiere,
    cg.nature,
    p.nom || ' ' || p.prenom         AS professeur,
    cg.salle,
    COALESCE(g.nom, 'Niveau entière') AS groupe
FROM  creneau cr
JOIN  niveau        cl ON cl.id = cr.niveau_id
JOIN  filiere       f  ON f.id  = cl.filiere_id
JOIN  creneau_groupe cg ON cg.creneau_id = cr.id
JOIN  matiere       m  ON m.id  = cg.matiere_id
LEFT JOIN prof      p  ON p.id  = cg.prof_id
LEFT JOIN groupe    g  ON g.id  = cg.groupe_id
ORDER BY cr.jour, cr.heure_debut, cl.nom, g.nom;

-- ========================================
-- RÉSUMÉ DES COMPORTEMENTS ON DELETE
-- ========================================
--
-- filiere          → DELETE RESTRICT  (protégé par niveau)
-- niveau           → DELETE RESTRICT  (protégé par groupe, etudiant, creneau)
-- groupe           → etudiant.groupe_id       SET NULL
--                    creneau_groupe.groupe_id  SET NULL
--                    seance.groupe_id          SET NULL
-- prof             → creneau_groupe.prof_id    RESTRICT
--                    seance.prof_id            RESTRICT
-- matiere          → creneau_groupe.matiere_id RESTRICT
--                    seance.matiere_id         RESTRICT
-- creneau          → creneau_groupe            CASCADE  (supprime les lignes)
-- creneau_groupe   → seance.creneau_groupe_id  SET NULL (séance conservée orpheline)
-- seance           → presence.seance_id        SET NULL (présence conservée orpheline)
--                    qrcode.seance_id          SET NULL (QR code conservé orphelin)
-- etudiant         → presence.etudiant_id      RESTRICT
--                    face_enrollment           CASCADE
-- qrcode           → presence.qrcode_id        SET NULL
--



-- 1. Rendre nullable
ALTER TABLE seance
    ALTER COLUMN creneau_groupe_id DROP NOT NULL;

-- 2. Vérifier le nom exact de la contrainte
SELECT conname 
FROM pg_constraint 
WHERE conrelid = 'seance'::regclass 
  AND contype = 'f'
  AND conname ILIKE '%creneau_groupe%';

-- 3. SET NULL
ALTER TABLE seance
    DROP CONSTRAINT seance_creneau_groupe_id_fkey,
    ADD CONSTRAINT seance_creneau_groupe_id_fkey
        FOREIGN KEY (creneau_groupe_id)
        REFERENCES creneau_groupe(id)
        ON DELETE SET NULL;

-- 4. Guard trigger
CREATE OR REPLACE FUNCTION check_seance_coherence()
RETURNS TRIGGER AS $$
DECLARE
    cg_prof_id   INT;
    cg_niveau_id INT;
    cg_groupe_id INT;
BEGIN
    IF NEW.creneau_groupe_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT cg.prof_id, cr.niveau_id, cg.groupe_id
    INTO   cg_prof_id, cg_niveau_id, cg_groupe_id
    FROM   creneau_groupe cg
    JOIN   creneau cr ON cr.id = cg.creneau_id
    WHERE  cg.id = NEW.creneau_groupe_id;

    IF NEW.prof_id != cg_prof_id THEN
        RAISE EXCEPTION 'Prof incohérent (attendu: %)', cg_prof_id;
    END IF;
    IF NEW.niveau_id != cg_niveau_id THEN
        RAISE EXCEPTION 'Niveau incohérent (attendu: %)', cg_niveau_id;
    END IF;
    IF NEW.groupe_id IS DISTINCT FROM cg_groupe_id THEN
        RAISE EXCEPTION 'Groupe incohérent (attendu: %)', cg_groupe_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
